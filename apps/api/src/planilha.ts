import { inflateRawSync } from "node:zlib";

/** Uma tabela lida de uma planilha: linhas de células (texto, número ou vazio). */
export type Tabela = (string | number | null)[][];

const dec = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const utf8 = new TextDecoder("utf-8");
const MAX_DESCOMPRIMIDO = 40 * 1024 * 1024;

/** Lista as entradas de um .zip (um .xlsx é um zip) e devolve funções que descomprimem cada uma sob demanda. */
function lerZip(buf: Uint8Array): Map<string, () => Uint8Array> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let fim = buf.length - 22;
  while (fim >= 0 && dv.getUint32(fim, true) !== 0x06054b50) fim--;
  if (fim < 0) throw new Error("O arquivo não é uma planilha .xlsx válida.");
  const total = dv.getUint16(fim + 10, true);
  let pos = dv.getUint32(fim + 16, true);
  const entradas = new Map<string, () => Uint8Array>();
  for (let i = 0; i < total; i++) {
    if (dv.getUint32(pos, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(pos + 10, true);
    const tamComp = dv.getUint32(pos + 20, true);
    const nomeLen = dv.getUint16(pos + 28, true);
    const extraLen = dv.getUint16(pos + 30, true);
    const comLen = dv.getUint16(pos + 32, true);
    const local = dv.getUint32(pos + 42, true);
    const nome = utf8.decode(buf.subarray(pos + 46, pos + 46 + nomeLen));
    const inicio = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    entradas.set(nome, () => {
      const dados = buf.subarray(inicio, inicio + tamComp);
      return metodo === 0 ? dados : new Uint8Array(inflateRawSync(dados, { maxOutputLength: MAX_DESCOMPRIMIDO }));
    });
    pos += 46 + nomeLen + extraLen + comLen;
  }
  return entradas;
}

const colunaNum = (ref: string) => ref.replace(/\d+/g, "").split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/** Lê a aba "Base" (ou a primeira aba) de um .xlsx. */
export function lerXlsx(buf: Uint8Array, abaPreferida = "Base"): Tabela {
  const zip = lerZip(buf);
  const texto = (nome: string) => { const e = zip.get(nome); return e ? utf8.decode(e()) : undefined; };

  const wb = texto("xl/workbook.xml");
  const rels = texto("xl/_rels/workbook.xml.rels");
  if (!wb || !rels) throw new Error("O arquivo não é uma planilha .xlsx válida.");
  const abas = [...wb.matchAll(/<sheet\b[^>]*?name="([^"]*)"[^>]*?r:id="([^"]*)"/g)].map((m) => ({ nome: dec(m[1]!), rid: m[2]! }));
  const alvo = abas.find((a) => a.nome.toLowerCase() === abaPreferida.toLowerCase()) ?? abas[0];
  if (!alvo) throw new Error("A planilha não tem nenhuma aba.");
  const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${alvo.rid}"`));
  const destino = rel && /Target="([^"]*)"/.exec(rel)?.[1];
  if (!destino) throw new Error("Não foi possível localizar a aba da planilha.");
  const caminho = destino.startsWith("/") ? destino.slice(1) : `xl/${destino}`;
  const folha = texto(caminho);
  if (!folha) throw new Error("Não foi possível ler a aba da planilha.");

  const compartilhadas = [...(texto("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    dec([...m[1]!.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));

  const linhas: Tabela = [];
  for (const r of folha.matchAll(/<row\b[^>]*?r="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const cels: (string | number | null)[] = [];
    for (const c of (r[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /\br="([A-Z]+\d+)"/.exec(c[1]!)?.[1];
      if (!ref) continue;
      const tipo = /\bt="(\w+)"/.exec(c[1]!)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(c[2] ?? "")?.[1];
      const inline = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(c[2] ?? "")?.[1];
      let val: string | number | null = null;
      if (tipo === "s" && v !== undefined) val = compartilhadas[Number(v)] ?? null;
      else if (tipo === "inlineStr") val = dec(inline ?? "");
      else if (v !== undefined) val = tipo === "str" ? dec(v) : /^-?\d+(\.\d+)?(E[+-]?\d+)?$/.test(v) ? Number(v) : dec(v);
      cels[colunaNum(ref)] = val;
    }
    linhas.push(Array.from(cels, (x) => x ?? null));
  }
  return linhas;
}

/** Lê um CSV (separador ; , ou tab; aspas; BOM). */
export function lerCsv(buf: Uint8Array): Tabela {
  let txt = utf8.decode(buf);
  if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1);
  const primeira = txt.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", ",", "\t"].map((s) => [s, primeira.split(s).length] as const).sort((a, b) => b[1] - a[1])[0]![0];
  const linhas: Tabela = [];
  let linha: (string | null)[] = [], campo = "", aspas = false;
  const fechaCampo = () => { linha.push(campo === "" ? null : campo); campo = ""; };
  const fechaLinha = () => { fechaCampo(); if (linha.some((c) => c !== null)) linhas.push(linha); linha = []; };
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i]!;
    if (aspas) {
      if (ch === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) fechaCampo();
    else if (ch === "\n") fechaLinha();
    else if (ch !== "\r") campo += ch;
  }
  if (campo !== "" || linha.length) fechaLinha();
  return linhas;
}

/** Descobre o formato pelo conteúdo (um .xlsx começa com "PK") e lê a tabela. */
export function lerPlanilha(buf: Uint8Array): Tabela {
  return buf[0] === 0x50 && buf[1] === 0x4b ? lerXlsx(buf) : lerCsv(buf);
}
