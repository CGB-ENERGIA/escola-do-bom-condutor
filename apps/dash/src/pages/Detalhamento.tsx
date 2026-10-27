import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CATEGORIAS, CRITERIOS_PRATICOS, NATUREZAS, VEICULOS,
  type Categoria, type CruzamentoRes, type DashboardPraticaRes, type DetalheTeoricaRes, type NaturezaInfracao, type RegistroCruzamento,
  type RegistroPratico, type RegistroTeoricoDetalhe, type ResumoAvaliacao,
} from "@ebc/shared";
import { Check } from "../components/Icones";
import { baixarCsv } from "../lib/csv";
import { CabecalhoPagina } from "../components/Layout";
import { Vazio, fmt } from "../components/Graficos";
import { api, useAtualizacao } from "../lib/api";
import { BarraFiltros, Indicadores, agrupar, derivar, useFiltros, type Filtravel } from "../lib/filtros";

type Aba = "cruzamento" | "questoes" | "infracoes" | "inaptos";
type Res = { kind: "t"; d: DetalheTeoricaRes } | { kind: "p"; d: DashboardPraticaRes } | { kind: "c"; d: CruzamentoRes };

const ESCOLA = "Escola do Bom Condutor";
const OLHO = "De Olho na Condução";

const ABAS: { id: Aba; rot: string; desc: string }[] = [
  { id: "cruzamento", rot: "Teórica × Prática", desc: "Quem falta fazer cada etapa" },
  { id: "questoes", rot: "Questões mais erradas", desc: "Avaliação teórica · Escola do Bom Condutor" },
  { id: "infracoes", rot: "Infrações mais cometidas", desc: "Avaliação prática" },
  { id: "inaptos", rot: "Inaptos e suas infrações", desc: "Avaliação prática" },
];

const COR_NAT: Record<NaturezaInfracao, string> = { gravissima: "var(--d)", grave: "var(--o)", media: "var(--w)", leve: "var(--i)" };
const ORDEM_NAT: NaturezaInfracao[] = ["gravissima", "grave", "media", "leve"];
const CRITERIO = new Map(CRITERIOS_PRATICOS.map((c) => [c.id, c]));

const normalizar = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
/** Busca por nome/matrícula: todas as palavras digitadas precisam aparecer. */
const casa = (l: { colabNome: string; matricula: string | null }, termo: string) => {
  const t = normalizar(termo);
  if (!t) return true;
  const alvo = normalizar(`${l.colabNome} ${l.matricula ?? ""}`);
  return t.split(/\s+/).every((p) => alvo.includes(p));
};
const grupoDe = (c: Categoria) => (c === "moto" ? "moto" : "carro");
const sel = "inp !py-2.5 !text-sm";

/** Relatório de detalhamento: questões mais erradas, infrações mais cometidas e inaptos com suas infrações. */
export default function Detalhamento() {
  const [params] = useSearchParams();
  const demo = params.get("demo") === "1";
  const [aba, setAba] = useState<Aba>("cruzamento");

  // Só busca os dados da aba aberta; `kind` evita desenhar uma aba com os dados da outra.
  const tipoDado = aba === "questoes" ? "t" : aba === "cruzamento" ? "c" : "p";
  const { dados: res, erro, atualizadoEm } = useAtualizacao<Res>(
    async () => tipoDado === "t" ? { kind: "t", d: await api.teoricaDetalhe(demo) }
      : tipoDado === "c" ? { kind: "c", d: await api.cruzamento(demo) }
      : { kind: "p", d: await api.pratica(demo) },
    `${tipoDado}-${demo}`,
  );

  return (
    <section className="space-y-5">
      <CabecalhoPagina titulo="Relatório de" destaque="Detalhamento" atualizadoEm={atualizadoEm} demo={demo}
        sub="Onde estão os erros e as infrações · use os filtros e clique nos nomes para aprofundar." />

      <div className="au d1 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" role="tablist" aria-label="Visões do detalhamento">
        {ABAS.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
            className="opt relative flex-col gap-0.5 !py-3" style={{ alignItems: "flex-start" }}>
            {aba === a.id && <span className="sel-marca"><Check width={11} height={11} strokeWidth={3} /> Selecionado</span>}
            <span className="text-sm font-extrabold" style={aba === a.id ? { color: "var(--p)" } : undefined}>{a.rot}</span>
            <span className="faint text-xs font-semibold">{a.desc}</span>
          </button>
        ))}
      </div>

      {demo && <p className="chip chip-warn af">DADOS DE DEMONSTRAÇÃO (fictícios)</p>}
      {erro && <p className="alert af" role="alert">{erro}</p>}
      {!res && !erro && <div className="grid gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((n) => <div key={n} className="skel" style={{ height: 96 }} />)}</div>}

      {res?.kind === "c" && aba === "cruzamento" && <Cruzamento dados={res.d} />}
      {res?.kind === "t" && aba === "questoes" && <Questoes dados={res.d} />}
      {res?.kind === "p" && aba === "infracoes" && <Infracoes dados={res.d} />}
      {res?.kind === "p" && aba === "inaptos" && <Inaptos dados={res.d} />}
    </section>
  );
}

/* ───────────────────────── peças comuns ───────────────────────── */

/** Item de ranking: posição, título, barra proporcional e números à direita. */
function ItemRank({ pos, titulo, meta, valor, sub, frac, cor, children }: {
  pos: number; titulo: ReactNode; meta?: ReactNode; valor: string; sub: string; frac: number; cor: string; children?: ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-[var(--r)] p-3" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <span className="grid shrink-0 place-items-center rounded-lg text-xs font-extrabold"
        style={{ width: 28, height: 28, background: pos <= 3 ? cor : "var(--surface-3)", color: pos <= 3 ? "var(--surface)" : "var(--fg-muted)" }}>{pos}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug" style={{ overflowWrap: "anywhere" }}>{titulo}</p>
        {meta && <p className="faint mt-0.5 text-xs leading-snug">{meta}</p>}
        <div className="bar mt-2"><span style={{ width: `${Math.max(2, Math.min(100, frac * 100))}%`, background: cor }} /></div>
        {children}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xl font-extrabold leading-tight" style={{ color: cor, fontVariantNumeric: "tabular-nums" }}>{valor}</p>
        <p className="muted text-[0.7rem] font-semibold">{sub}</p>
      </div>
    </li>
  );
}

/** Lista com "ver todas" quando passa de `limite`. */
function ListaRank({ total, limite = 10, titulo, children }: { total: number; limite?: number; titulo: string; children: (max: number) => ReactNode }) {
  const [tudo, setTudo] = useState(false);
  const max = tudo ? total : limite;
  return (
    <section className="card au p-4 sm:p-5">
      <h3 className="mb-3 text-center text-[0.95rem] font-bold tracking-tight" style={{ color: "var(--p)" }}>{titulo}</h3>
      {total === 0 ? <Vazio /> : <ul className="space-y-2.5">{children(max)}</ul>}
      {total > limite && (
        <div className="mt-4 text-center">
          <button type="button" className="btn btn-g !py-2 !text-sm" onClick={() => setTudo((v) => !v)}>
            {tudo ? "Mostrar só as primeiras" : `Ver todas (${total})`}
          </button>
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── 1. questões mais erradas ───────────────────────── */

type LT = RegistroTeoricoDetalhe & Filtravel;

function Questoes({ dados }: { dados: DetalheTeoricaRes }) {
  const ctl = useFiltros<LT>();
  const { passa } = ctl;
  const [categoria, setCategoria] = useState("");
  const [busca, setBusca] = useState("");
  const [textoQ, setTextoQ] = useState("");
  const [ordem, setOrdem] = useState<"erros" | "pct">("erros");

  const todasAll: LT[] = useMemo(() => dados.registros.map((r) => ({
    ...r, ...derivar(r.finalizadaEm, r.gerencia, r.base, r.coordenador), ok: r.aprovado, colabId: r.colaboradorId, colabNome: r.nome,
  })), [dados]);
  const base = todasAll.filter((l) => (!categoria || l.categoria === categoria) && casa(l, busca));
  const linhas = base.filter((l) => passa(l));

  const ranking = useMemo(() => {
    const provas = { carro: 0, moto: 0 };
    const stats = new Map<string, { erros: number; brancos: number; marcadas: Map<string, number> }>();
    for (const l of linhas) {
      provas[grupoDe(l.categoria)]++;
      for (const [qid, resp] of l.erros) {
        const s = stats.get(qid) ?? stats.set(qid, { erros: 0, brancos: 0, marcadas: new Map() }).get(qid)!;
        s.erros++;
        if (resp === null) s.brancos++; else s.marcadas.set(resp, (s.marcadas.get(resp) ?? 0) + 1);
      }
    }
    const t = normalizar(textoQ);
    return dados.questoes
      .filter((q) => stats.has(q.id) && (!t || normalizar(q.enunciado).includes(t)))
      .map((q) => {
        const s = stats.get(q.id)!;
        const n = provas[q.grupo];
        const top = [...s.marcadas.entries()].sort((a, b) => b[1] - a[1])[0];
        return { q, ...s, n, pct: n ? s.erros / n : 0, top };
      })
      .sort((a, b) => (ordem === "pct" ? b.pct - a.pct || b.erros - a.erros : b.erros - a.erros || b.pct - a.pct));
  }, [linhas, dados.questoes, textoQ, ordem]);

  const totalErros = linhas.reduce((s, l) => s + l.erros.length, 0);
  const maior = ranking[0];
  const letra = (q: { alternativas: { id: string }[] }, id: string) => String.fromCharCode(65 + Math.max(0, q.alternativas.findIndex((a) => a.id === id)));
  const texto = (q: { alternativas: { id: string; texto: string }[] }, id: string) => q.alternativas.find((a) => a.id === id)?.texto ?? "";

  return (
    <>
      <BarraFiltros todas={todasAll} ctl={ctl} situacao={{ sim: "Aprovados", nao: "Reprovados" }} busca={{ valor: busca, onChange: setBusca }}
        campos={
          <>
            <label className="text-xs font-semibold">Categoria da prova
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={`${sel} mt-1`}>
                <option value="">Todas</option>
                {(Object.keys(CATEGORIAS) as Categoria[]).map((k) => <option key={k} value={k}>{CATEGORIAS[k]}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold">Ordenar por
              <select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)} className={`${sel} mt-1`}>
                <option value="erros">Nº de erros</option>
                <option value="pct">% de erro</option>
              </select>
            </label>
            <label className="col-span-2 text-xs font-semibold">Buscar no enunciado
              <input value={textoQ} onChange={(e) => setTextoQ(e.target.value)} placeholder="Ex.: sinalização" className={`${sel} mt-1`} />
            </label>
          </>
        } />

      {todasAll.length === 0 ? (
        <div className="card au p-8 text-center">
          <p className="text-lg font-bold">Ainda não há provas finalizadas</p>
          <p className="muted mx-auto mt-1 max-w-md text-sm">Quando os colaboradores finalizarem a prova teórica, as questões mais erradas aparecem aqui.</p>
        </div>
      ) : (
        <>
          <Indicadores itens={[
            { rot: "Provas analisadas", val: String(linhas.length), cor: "var(--i)" },
            { rot: "Erros no total", val: String(totalErros), cor: "var(--d)" },
            { rot: "Média de erros por prova", val: linhas.length ? fmt(totalErros / linhas.length) : "—", cor: "var(--w)" },
            { rot: "Questão mais errada", val: maior ? `Q${maior.q.numero} · ${fmt(maior.pct * 100, 0)}%` : "—", cor: "var(--o)" },
          ]} />

          <ListaRank titulo="Ranking das questões mais erradas" total={ranking.length}>
            {(max) => ranking.slice(0, max).map((r, i) => (
              <ItemRank key={r.q.id} pos={i + 1} cor="var(--d)" frac={r.pct}
                valor={`${r.erros} erro${r.erros === 1 ? "" : "s"}`} sub={`${fmt(r.pct * 100, 0)}% de ${r.n} prova${r.n === 1 ? "" : "s"}`}
                titulo={<><span style={{ color: "var(--p)" }}>Q{r.q.numero}.</span> {r.q.enunciado}</>}
                meta={<>{r.q.grupo === "moto" ? "Motocicleta" : "Carro/Caminhão"}{r.brancos > 0 && ` · ${r.brancos} em branco`}</>}>
                <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                  <p><span className="chip chip-ok !py-0.5">Correta</span> <strong>{letra(r.q, r.q.correta)})</strong> <span className="muted">{texto(r.q, r.q.correta)}</span></p>
                  {r.top && (
                    <p><span className="chip chip-bad !py-0.5">Mais marcada ({r.top[1]}×)</span> <strong>{letra(r.q, r.top[0])})</strong> <span className="muted">{texto(r.q, r.top[0])}</span></p>
                  )}
                </div>
              </ItemRank>
            ))}
          </ListaRank>
        </>
      )}
    </>
  );
}

/* ───────────────────────── filtros comuns da prática ───────────────────────── */

type LP = RegistroPratico & Filtravel;

function usePratica(dados: DashboardPraticaRes) {
  const ctl = useFiltros<LP>();
  const [tipo, setTipo] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [natureza, setNatureza] = useState<"" | NaturezaInfracao>("");
  const [busca, setBusca] = useState("");
  const [programa, setPrograma] = useState(ESCOLA);
  const todasAll: LP[] = useMemo(() => dados.registros.map((r) => ({
    ...r, ...derivar(r.realizadaEm, r.gerencia, r.base, r.coordenador), ok: r.apto, colabId: r.colaboradorId, colabNome: r.nome,
  })), [dados]);
  const base = todasAll.filter((l) => (!programa || l.programa === programa) && (!tipo || l.tipo === tipo) && (!veiculo || l.veiculo === veiculo) && casa(l, busca));
  const campos = (
    <>
      <label className="text-xs font-semibold">Programa
        <select value={programa} onChange={(e) => setPrograma(e.target.value)} className={`${sel} mt-1`}>
          <option value={ESCOLA}>{ESCOLA}</option>
          <option value={OLHO}>{OLHO}</option>
          <option value="">Todos</option>
        </select>
      </label>
      <label className="text-xs font-semibold">Avaliação
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${sel} mt-1`}>
          <option value="">Todas</option><option value="primeira">1ª avaliação</option><option value="reteste">Reteste</option>
        </select>
      </label>
      <label className="text-xs font-semibold">Veículo
        <select value={veiculo} onChange={(e) => setVeiculo(e.target.value)} className={`${sel} mt-1`}>
          <option value="">Todos</option>
          {(Object.keys(VEICULOS) as (keyof typeof VEICULOS)[]).map((k) => <option key={k} value={k}>{VEICULOS[k]}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold">Natureza da infração
        <select value={natureza} onChange={(e) => setNatureza(e.target.value as typeof natureza)} className={`${sel} mt-1`}>
          <option value="">Todas</option>
          {ORDEM_NAT.map((n) => <option key={n} value={n}>{NATUREZAS[n].rotulo}</option>)}
        </select>
      </label>
    </>
  );
  return { ctl, todasAll, base, campos, natureza, setNatureza, busca, setBusca };
}

const rotuloNat = (n: NaturezaInfracao) => (n === "gravissima" ? "Eliminatória" : NATUREZAS[n].rotulo.replace("Infração ", ""));

/* ───────────────────────── 2. infrações mais cometidas ───────────────────────── */

function Infracoes({ dados }: { dados: DashboardPraticaRes }) {
  const { ctl, todasAll, base, campos, natureza, setNatureza, busca, setBusca } = usePratica(dados);
  const linhas = base.filter((l) => ctl.passa(l));

  const porCriterio = useMemo(() => {
    const m = new Map<string, { ocorrencias: number; avaliacoes: number }>();
    for (const l of linhas) for (const o of l.ocorrencias) {
      if (o.quantidade <= 0) continue;
      const s = m.get(o.criterioId) ?? m.set(o.criterioId, { ocorrencias: 0, avaliacoes: 0 }).get(o.criterioId)!;
      s.ocorrencias += o.quantidade; s.avaliacoes++;
    }
    return m;
  }, [linhas]);

  const todasInfr = [...porCriterio.entries()].flatMap(([id, s]) => { const c = CRITERIO.get(id); return c ? [{ c, ...s }] : []; });
  const ranking = todasInfr.filter((r) => !natureza || r.c.natureza === natureza)
    .sort((a, b) => b.ocorrencias - a.ocorrencias || b.avaliacoes - a.avaliacoes);
  const total = todasInfr.reduce((s, r) => s + r.ocorrencias, 0);
  const porNat = (n: NaturezaInfracao) => todasInfr.filter((r) => r.c.natureza === n).reduce((s, r) => s + r.ocorrencias, 0);
  const max = ranking[0]?.ocorrencias ?? 1;
  const comEliminatoria = linhas.filter((l) => l.ocorrencias.some((o) => o.quantidade > 0 && CRITERIO.get(o.criterioId)?.natureza === "gravissima")).length;

  return (
    <>
      <BarraFiltros todas={todasAll} ctl={ctl} situacao={{ sim: "Aptos", nao: "Inaptos" }} busca={{ valor: busca, onChange: setBusca }} campos={campos} />

      {todasAll.length === 0 ? (
        <div className="card au p-8 text-center"><p className="text-lg font-bold">Ainda não há avaliações práticas</p></div>
      ) : (
        <>
          <Indicadores itens={[
            { rot: "Avaliações analisadas", val: String(linhas.length), cor: "var(--i)" },
            { rot: "Infrações no total", val: String(total), cor: "var(--d)" },
            { rot: "Avaliações com eliminatória", val: String(comEliminatoria), cor: "var(--o)" },
            { rot: "Média de infrações por avaliação", val: linhas.length ? fmt(total / linhas.length) : "—", cor: "var(--w)" },
          ]} />

          <div className="au d2 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {ORDEM_NAT.map((n) => (
              <button key={n} type="button" onClick={() => setNatureza(natureza === n ? "" : n)} aria-pressed={natureza === n}
                className="card relative p-3 text-left transition-all" style={{
                  borderRadius: "var(--r)", cursor: "pointer", font: "inherit", color: "inherit",
                  opacity: !natureza || natureza === n ? 1 : 0.45, borderColor: natureza === n ? COR_NAT[n] : undefined,
                  boxShadow: natureza === n ? `0 0 0 3px color-mix(in srgb, ${COR_NAT[n]} 25%, transparent)` : undefined,
                }}>
                {natureza === n && <span className="sel-marca sel-alt">Filtro ativo</span>}
                <p className="text-xs font-bold" style={{ color: COR_NAT[n] }}>{rotuloNat(n)}</p>
                <p className="text-2xl font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>{porNat(n)}</p>
                <p className="faint text-[0.7rem] font-semibold">infrações · clique para filtrar</p>
              </button>
            ))}
          </div>

          <ListaRank titulo="Ranking das infrações mais cometidas" total={ranking.length}>
            {(lim) => ranking.slice(0, lim).map((r, i) => (
              <ItemRank key={r.c.id} pos={i + 1} cor={COR_NAT[r.c.natureza]} frac={r.ocorrencias / max}
                valor={`${r.ocorrencias}×`} sub={`${r.avaliacoes} avaliação(ões) · ${linhas.length ? fmt((r.avaliacoes / linhas.length) * 100, 0) : 0}%`}
                titulo={r.c.descricao}
                meta={<span className="chip !py-0.5" style={{ background: "var(--surface-3)", color: COR_NAT[r.c.natureza] }}>{NATUREZAS[r.c.natureza].rotulo}</span>} />
            ))}
          </ListaRank>
        </>
      )}
    </>
  );
}

/* ───────────────────────── 3. inaptos e suas infrações (tabela) ───────────────────────── */

type ColOrd = "nome" | "base" | "data" | "pontos";

function Inaptos({ dados }: { dados: DashboardPraticaRes }) {
  const { ctl, todasAll, base, campos, natureza, busca, setBusca } = usePratica(dados);
  const [limite, setLimite] = useState(25);
  const [ord, setOrd] = useState<{ col: ColOrd; asc: boolean }>({ col: "nome", asc: true });
  const { f, alternar } = ctl;

  // aqui só interessam os inaptos; o filtro de natureza mantém quem cometeu infração daquela natureza
  const linhas = base
    .filter((l) => !l.ok && ctl.passa(l, "situacao"))
    .filter((l) => !natureza || l.ocorrencias.some((o) => o.quantidade > 0 && CRITERIO.get(o.criterioId)?.natureza === natureza))
    .sort((a, b) => {
      const d = ord.col === "nome" ? a.nome.localeCompare(b.nome)
        : ord.col === "base" ? a.baseK.localeCompare(b.baseK) || a.nome.localeCompare(b.nome)
        : ord.col === "pontos" ? a.pontos - b.pontos
        : (a.realizadaEm ?? "").localeCompare(b.realizadaEm ?? "");
      return ord.asc ? d : -d;
    });

  const infracoes = (l: LP) => l.ocorrencias.filter((o) => o.quantidade > 0)
    .flatMap((o) => { const c = CRITERIO.get(o.criterioId); return c ? [{ o, c }] : []; })
    .sort((a, b) => ORDEM_NAT.indexOf(a.c.natureza) - ORDEM_NAT.indexOf(b.c.natureza));

  const totalInfr = linhas.reduce((s, l) => s + l.ocorrencias.reduce((x, o) => x + o.quantidade, 0), 0);
  const colaboradores = agrupar(linhas, (l) => l.colabId);
  const reincidentes = colaboradores.filter(([, v]) => v.length > 1).length;

  const ordenar = (col: ColOrd) => setOrd((o) => (o.col === col ? { col, asc: !o.asc } : { col, asc: col === "nome" || col === "base" }));
  const seta = (col: ColOrd) => (ord.col === col ? (ord.asc ? " ▲" : " ▼") : "");
  const Th = ({ col, children }: { col: ColOrd; children: ReactNode }) => (
    <th className="ord" onClick={() => ordenar(col)} aria-sort={ord.col === col ? (ord.asc ? "ascending" : "descending") : "none"}>{children}{seta(col)}</th>
  );

  const exportar = () => baixarCsv("colaboradores-inaptos",
    ["Colaborador", "Matrícula", "Base", "Gerência", "Coordenador", "Programa", "Data", "Avaliação", "Veículo", "Pontos", "Infrações", "Observação do instrutor"],
    linhas.map((l) => [l.nome, l.matricula, l.baseK, l.gerencia, l.coordenador, l.programa, l.realizadaEm ? new Date(l.realizadaEm).toLocaleDateString("pt-BR") : "",
      l.tipo === "reteste" ? "Reteste" : "1ª avaliação", l.veiculo ? VEICULOS[l.veiculo] : "", l.pontos,
      infracoes(l).map(({ o, c }) => `${o.quantidade}x ${c.descricao} (${rotuloNat(c.natureza)})`).join(" | "), l.descricao]));

  return (
    <>
      <BarraFiltros todas={todasAll} ctl={ctl} busca={{ valor: busca, onChange: setBusca }} campos={campos} />

      {todasAll.length === 0 ? (
        <div className="card au p-8 text-center"><p className="text-lg font-bold">Ainda não há avaliações práticas</p></div>
      ) : (
        <>
          <Indicadores itens={[
            { rot: "Avaliações inaptas", val: String(linhas.length), cor: "var(--d)" },
            { rot: "Colaboradores inaptos", val: String(colaboradores.length), cor: "var(--o)" },
            { rot: "Infrações cometidas", val: String(totalInfr), cor: "var(--w)" },
            { rot: "Inaptos mais de uma vez", val: String(reincidentes), cor: "var(--i)" },
          ]} />

          <section className="card au p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[0.95rem] font-bold tracking-tight" style={{ color: "var(--p)" }}>Colaboradores inaptos e suas infrações</h3>
              <button type="button" className="btn btn-g !py-2 !text-sm" onClick={exportar} disabled={linhas.length === 0}>Exportar CSV (Excel)</button>
            </div>
            {linhas.length === 0 ? <Vazio /> : (
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead>
                    <tr>
                      <Th col="nome">Colaborador</Th>
                      <Th col="base">Base</Th>
                      <th>Gerência</th><th>Coordenador</th>
                      <Th col="data">Data</Th>
                      <Th col="pontos">Pontos</Th>
                      <th style={{ minWidth: "22rem" }}>Infrações cometidas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.slice(0, limite).map((l) => {
                      const infr = infracoes(l);
                      const selecionado = f.colaborador === l.colabId;
                      return (
                        <tr key={l.id} style={selecionado ? { background: "var(--p-tint)" } : undefined}>
                          <td style={{ minWidth: "13rem" }}>
                            <button type="button" onClick={() => alternar("colaborador", l.colabId)} title="Filtrar por este colaborador"
                              className="link text-left" style={{ color: "var(--fg)" }}>{l.nome}</button>
                            <p className="faint text-[0.7rem]">{[l.matricula && `Mat. ${l.matricula}`, l.tipo === "reteste" ? "Reteste" : "1ª avaliação", l.programa === OLHO && "De Olho na Condução"].filter(Boolean).join(" · ")}</p>
                          </td>
                          <td className="whitespace-nowrap font-semibold">{l.baseK}</td>
                          <td className="whitespace-nowrap">{l.gerencia ?? "—"}</td>
                          <td className="whitespace-nowrap">{l.coordenador ?? "—"}</td>
                          <td className="whitespace-nowrap">{l.realizadaEm ? new Date(l.realizadaEm).toLocaleDateString("pt-BR") : "—"}</td>
                          <td className="whitespace-nowrap"><span className="chip chip-bad !py-0.5">{l.pontos}</span></td>
                          <td>
                            {infr.length > 0 ? (
                              <ul className="grid gap-1">
                                {infr.map(({ o, c }) => (
                                  <li key={c.id} className="flex items-start gap-2 leading-snug">
                                    <span className="mt-1.5 shrink-0 rounded-full" style={{ width: 8, height: 8, background: COR_NAT[c.natureza] }} />
                                    <span style={{ overflowWrap: "anywhere" }}><strong>{o.quantidade}×</strong> {c.descricao} <span className="faint text-[0.7rem]">({rotuloNat(c.natureza)})</span></span>
                                  </li>
                                ))}
                              </ul>
                            ) : <span className="faint">Sem infrações detalhadas</span>}
                            {l.descricao && <p className="muted mt-1.5 text-[0.72rem] italic">{l.descricao}</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {linhas.length > limite && (
              <div className="mt-4 text-center">
                <button type="button" className="btn btn-g !py-2 !text-sm" onClick={() => setLimite((n) => n + 25)}>Mostrar mais ({linhas.length - limite} restantes)</button>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

/* ───────────────────────── 4. teórica × prática ───────────────────────── */

type Situ = "falta-pratica" | "falta-teorica" | "completo" | "so-olho";
type LC = RegistroCruzamento & Filtravel & { situ: Situ };

const SITU: Record<Situ, { rot: string; desc: string; cor: string; ordem: number }> = {
  "falta-pratica": { rot: "Teórica feita, prática pendente", desc: "Fez a teórica e ainda não fez a prática da Escola", cor: "var(--o)", ordem: 0 },
  "falta-teorica": { rot: "Prática feita, teórica pendente", desc: "Fez a prática da Escola e ainda não fez a teórica", cor: "var(--w)", ordem: 1 },
  completo: { rot: "Completos", desc: "Fez a teórica e a prática da Escola", cor: "var(--p)", ordem: 2 },
  "so-olho": { rot: "Só De Olho na Condução", desc: "Fez só a prática do De Olho na Condução (não exige teórica)", cor: "var(--i)", ordem: 3 },
};
const SITUS = Object.keys(SITU) as Situ[];
const dataBr = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "sem data");

function Etapa({ r, pos, neg }: { r: ResumoAvaliacao | null; pos: string; neg: string }) {
  if (!r) return <span className="faint text-xs">— não fez</span>;
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className={`chip ${r.ok ? "chip-ok" : "chip-bad"} !py-0.5`}>{r.ok ? pos : neg}</span>
      <span className="faint text-xs">{dataBr(r.ultima)}{r.qtd > 1 && ` · ${r.qtd}×`}</span>
    </div>
  );
}

/** Cruza quem fez a teórica (só Escola) e a prática (Escola e De Olho na Condução) e destaca o que falta. */
function Cruzamento({ dados }: { dados: CruzamentoRes }) {
  const ctl = useFiltros<LC>();
  const { f, alternar, passa } = ctl;
  const [busca, setBusca] = useState("");
  const [situ, setSitu] = useState<"" | Situ>("");
  const [limite, setLimite] = useState(30);

  const todasAll: LC[] = useMemo(() => dados.registros.map((r) => {
    const situ: Situ = r.teorica && r.praticaEscola ? "completo" : r.teorica ? "falta-pratica" : r.praticaEscola ? "falta-teorica" : "so-olho";
    const ultima = [r.teorica?.ultima, r.praticaEscola?.ultima, r.praticaOlho?.ultima].filter((x): x is string => !!x).sort().pop() ?? null;
    return { ...r, ...derivar(ultima, r.gerencia, r.base, r.coordenador), ok: situ === "completo", colabId: r.colaboradorId, colabNome: r.nome, situ };
  }), [dados]);

  const base = todasAll.filter((l) => casa(l, busca));
  const visiveis = base.filter((l) => passa(l));
  const conta = (s: Situ) => visiveis.filter((l) => l.situ === s).length;
  const linhas = visiveis.filter((l) => !situ || l.situ === situ)
    .sort((a, b) => SITU[a.situ].ordem - SITU[b.situ].ordem || a.nome.localeCompare(b.nome));
  const semTeorica = todasAll.length > 0 && todasAll.every((l) => !l.teorica);

  const exportar = () => baixarCsv("teorica-x-pratica",
    ["Colaborador", "Matrícula", "Base", "Gerência", "Coordenador", "Situação", "Teórica", "Data teórica", "Prática (Escola)", "Data prática", "Prática (De Olho na Condução)", "Data De Olho"],
    linhas.map((l) => [l.nome, l.matricula, l.baseK, l.gerencia, l.coordenador, SITU[l.situ].rot,
      l.teorica ? (l.teorica.ok ? "Aprovado" : "Reprovado") : "Não fez", l.teorica ? dataBr(l.teorica.ultima) : "",
      l.praticaEscola ? (l.praticaEscola.ok ? "Apto" : "Inapto") : "Não fez", l.praticaEscola ? dataBr(l.praticaEscola.ultima) : "",
      l.praticaOlho ? (l.praticaOlho.ok ? "Apto" : "Inapto") : "Não fez", l.praticaOlho ? dataBr(l.praticaOlho.ultima) : ""]));

  return (
    <>
      <BarraFiltros todas={todasAll} ctl={ctl} busca={{ valor: busca, onChange: setBusca }}
        campos={
          <label className="col-span-2 text-xs font-semibold">Situação
            <select value={situ} onChange={(e) => setSitu(e.target.value as typeof situ)} className={`${sel} mt-1`}>
              <option value="">Todas</option>
              {SITUS.map((s) => <option key={s} value={s}>{SITU[s].rot}</option>)}
            </select>
          </label>
        } />

      <p className="muted text-xs">
        <strong style={{ color: "var(--fg)" }}>Teórica:</strong> só para quem participa da Escola do Bom Condutor. {" "}
        <strong style={{ color: "var(--fg)" }}>Prática:</strong> vale para a Escola do Bom Condutor e para o De Olho na Condução.
        Período = data da última avaliação do colaborador.
      </p>

      {semTeorica && !dados.demo && (
        <p className="alert af" role="status" style={{ background: "var(--w-tint)", color: "var(--w)", borderColor: "color-mix(in srgb, var(--w) 25%, transparent)" }}>
          Ainda não há provas teóricas registradas (o histórico anterior não foi importado). Por isso quem já fez a prática aparece com a teórica pendente.
        </p>
      )}

      {todasAll.length === 0 ? (
        <div className="card au p-8 text-center"><p className="text-lg font-bold">Ainda não há avaliações registradas</p></div>
      ) : (
        <>
          <div className="au d2 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {SITUS.map((s) => (
              <button key={s} type="button" onClick={() => setSitu(situ === s ? "" : s)} aria-pressed={situ === s}
                className="card relative overflow-hidden p-4 text-left transition-all" style={{
                  borderRadius: "var(--r)", cursor: "pointer", font: "inherit", color: "inherit",
                  opacity: !situ || situ === s ? 1 : 0.45, borderColor: situ === s ? SITU[s].cor : undefined,
                  boxShadow: situ === s ? `0 0 0 3px color-mix(in srgb, ${SITU[s].cor} 25%, transparent)` : undefined,
                }}>
                {situ === s && <span className="sel-marca sel-alt">Filtro ativo</span>}
                <span className="absolute inset-y-0 left-0" style={{ width: 4, background: SITU[s].cor }} />
                <p className="pl-2 text-xs font-bold" style={{ color: SITU[s].cor }}>{SITU[s].rot}</p>
                <p className="pl-2 text-4xl font-extrabold leading-tight" style={{ fontVariantNumeric: "tabular-nums" }}>{conta(s)}</p>
                <p className="faint pl-2 text-[0.7rem] font-semibold leading-snug">{SITU[s].desc}</p>
              </button>
            ))}
          </div>

          <section className="card au p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[0.95rem] font-bold tracking-tight" style={{ color: "var(--p)" }}>
                Colaboradores e etapas realizadas <span className="faint font-semibold">· {linhas.length}</span>
              </h3>
              <button type="button" className="btn btn-g !py-2 !text-sm" onClick={exportar} disabled={linhas.length === 0}>Exportar CSV (Excel)</button>
            </div>
            {linhas.length === 0 ? <Vazio /> : (
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Colaborador</th><th>Base</th><th>Gerência</th><th>Coordenador</th><th>Teórica</th><th>Prática (Escola)</th><th>Prática (De Olho)</th><th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.slice(0, limite).map((l) => (
                      <tr key={l.colaboradorId} style={f.colaborador === l.colabId ? { background: "var(--p-tint)" } : undefined}>
                        <td style={{ minWidth: "13rem" }}>
                          <button type="button" onClick={() => alternar("colaborador", l.colabId)} title="Filtrar por este colaborador"
                            className="link text-left" style={{ color: "var(--fg)" }}>{l.nome}</button>
                          {l.matricula && <p className="faint text-[0.7rem]">Mat. {l.matricula}</p>}
                        </td>
                        <td className="whitespace-nowrap font-semibold">{l.baseK}</td>
                        <td className="whitespace-nowrap">{l.gerencia ?? "—"}</td>
                          <td className="whitespace-nowrap">{l.coordenador ?? "—"}</td>
                        <td><Etapa r={l.teorica} pos="Aprovado" neg="Reprovado" /></td>
                        <td><Etapa r={l.praticaEscola} pos="Apto" neg="Inapto" /></td>
                        <td><Etapa r={l.praticaOlho} pos="Apto" neg="Inapto" /></td>
                        <td><span className="chip !py-0.5" style={{ background: "var(--surface-3)", color: SITU[l.situ].cor }}>{SITU[l.situ].rot}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {linhas.length > limite && (
              <div className="mt-4 text-center">
                <button type="button" className="btn btn-g !py-2 !text-sm" onClick={() => setLimite((n) => n + 30)}>Mostrar mais ({linhas.length - limite} restantes)</button>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}