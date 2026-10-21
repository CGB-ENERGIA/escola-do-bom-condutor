import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { RegistroPratico } from "@ebc/shared";
import { CabecalhoPagina } from "../components/Layout";
import { Barras, BarrasDuplas, ListaContagem, Painel, Rosca } from "../components/Graficos";
import { api, useAtualizacao } from "../lib/api";
import { BarraFiltros, Indicadores, agrupar, chaveMes, derivar, rotuloMes, useFiltros, type Filtravel } from "../lib/filtros";

type Linha = RegistroPratico & Filtravel;

/** Avaliação prática: indicadores e gráficos que se atualizam quando o instrutor registra uma avaliação. */
export default function Pratica() {
  const [params] = useSearchParams();
  const demo = params.get("demo") === "1";
  const { dados, erro, atualizadoEm } = useAtualizacao(() => api.pratica(demo), `p-${demo}`);
  const ctl = useFiltros<Linha>();
  const { f, set, alternar, passa } = ctl;

  const todas: Linha[] = useMemo(() => (dados?.registros ?? []).map((r) => ({
    ...r, ...derivar(r.realizadaEm, r.gerencia, r.base), ok: r.apto,
  })), [dados]);

  const linhas = todas.filter((l) => passa(l));
  const aptos = linhas.filter((l) => l.ok).length;
  const inaptos = linhas.length - aptos;
  const pctInaptos = linhas.length ? (inaptos / linhas.length) * 100 : 0;

  const porMes = agrupar(todas.filter((l) => passa(l, "ano") && passa(l, "mes") && l.ano), (l) => chaveMes(l.ano, l.mes))
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ chave: k, rotulo: rotuloMes(k), valor: v.length }));
  const mesSel = f.ano && f.mes ? chaveMes(Number(f.ano), Number(f.mes)) : undefined;

  const duplas = (campo: "baseK" | "gerenciaK", ign: "base" | "gerencia") =>
    agrupar(todas.filter((l) => passa(l, ign)), (l) => l[campo])
      .map(([k, v]) => ({ chave: k, rotulo: k, a: v.filter((l) => l.ok).length, b: v.filter((l) => !l.ok).length }))
      .sort((x, y) => y.a + y.b - (x.a + x.b));

  /** Lista de colaboradores com a quantidade de avaliações que atendem ao critério. */
  const lista = (ls: Linha[]) => agrupar(ls, (l) => l.colaboradorId)
    .map(([k, v]) => ({ chave: k, rotulo: v[0]!.nome, valor: v.length }))
    .sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo));

  return (
    <section className="space-y-5">
      <CabecalhoPagina titulo="Avaliação" destaque="Prática" sub="Resultados das avaliações práticas · clique nos gráficos para filtrar." atualizadoEm={atualizadoEm} demo={demo} />
      <BarraFiltros todas={todas} ctl={ctl} situacao={{ sim: "Aptos", nao: "Inaptos" }} />

      {demo && <p className="chip chip-warn af">DADOS DE DEMONSTRAÇÃO (fictícios)</p>}
      {erro && <p className="alert af" role="alert">{erro}</p>}
      {!dados && !erro && <div className="grid gap-4 lg:grid-cols-4">{[0, 1, 2].map((n) => <div key={n} className="skel" style={{ height: 96 }} />)}</div>}

      {dados && todas.length === 0 && (
        <div className="card au p-8 text-center">
          <p className="text-lg font-bold">Ainda não há avaliações práticas</p>
          <p className="muted mx-auto mt-1 max-w-md text-sm">Assim que o instrutor registrar uma avaliação, este painel se atualiza sozinho.</p>
        </div>
      )}

      {dados && todas.length > 0 && (
        <>
          <Indicadores itens={[
            { rot: "Qnt Colab AP", val: String(linhas.length), cor: "var(--fg-muted)" },
            { rot: "Aptos AP", val: String(aptos), cor: "var(--p)" },
            { rot: "Inaptos AP", val: String(inaptos), cor: "var(--d)" },
            { rot: "Reteste", val: String(linhas.filter((l) => l.tipo === "reteste").length), cor: "var(--w)" },
          ]} />

          <div className="grid gap-4 lg:grid-cols-12">
            <Painel titulo="Avaliação por mês" className="lg:col-span-4">
              <Barras itens={porMes} selecionado={mesSel}
                onSelecionar={(k) => (mesSel === k ? set({ ano: "", mes: "" }) : set({ ano: String(Number(k.slice(0, 4))), mes: String(Number(k.slice(5))) }))} />
            </Painel>
            <Painel titulo="Aptos vs Inaptos por Base" className="lg:col-span-4">
              <BarrasDuplas itens={duplas("baseK", "base")} rotA="Aptos" rotB="Inaptos" selecionado={f.base} onSelecionar={(k) => alternar("base", k)} />
            </Painel>
            <Painel titulo="Aptos vs Inaptos por Gerência" className="lg:col-span-4">
              <BarrasDuplas itens={duplas("gerenciaK", "gerencia")} rotA="Aptos" rotB="Inaptos" selecionado={f.gerencia} onSelecionar={(k) => alternar("gerencia", k)} />
            </Painel>

            <Painel titulo="% de Inaptos" className="lg:col-span-3">
              <Rosca pct={pctInaptos} rotulo={`${inaptos} de ${linhas.length}`} />
            </Painel>
            <Painel titulo="Colaboradores Aptos" className="lg:col-span-3">
              <ListaContagem itens={lista(linhas.filter((l) => l.ok))} cor="var(--p)" />
            </Painel>
            <Painel titulo="Colaboradores Inaptos" className="lg:col-span-3">
              <ListaContagem itens={lista(linhas.filter((l) => !l.ok))} cor="var(--d)" />
            </Painel>
            <Painel titulo="Colaboradores Reteste" className="lg:col-span-3">
              <ListaContagem itens={lista(linhas.filter((l) => l.tipo === "reteste"))} cor="var(--w)" />
            </Painel>
          </div>
        </>
      )}
    </section>
  );
}
