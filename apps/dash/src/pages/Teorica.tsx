import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { REGRAS, type RegistroTeorico } from "@ebc/shared";
import { CabecalhoPagina } from "../components/Layout";
import { Barras, BarrasDuplas, Painel, Ranking, Rosca, fmt } from "../components/Graficos";
import { api, useAtualizacao } from "../lib/api";
import { BarraFiltros, Indicadores, agrupar, chaveMes, derivar, media, rotuloMes, useFiltros, type Filtravel } from "../lib/filtros";

type Linha = RegistroTeorico & Filtravel;

/** Avaliação teórica: indicadores e gráficos que se atualizam quando o colaborador finaliza a prova. */
export default function Teorica() {
  const [params] = useSearchParams();
  const demo = params.get("demo") === "1";
  const { dados, erro, atualizadoEm } = useAtualizacao(() => api.teorica(demo), `t-${demo}`);
  const ctl = useFiltros<Linha>();
  const { f, set, alternar, passa } = ctl;

  const todas: Linha[] = useMemo(() => (dados?.registros ?? []).map((r) => ({
    ...r, ...derivar(r.finalizadaEm, r.gerencia, r.base), ok: r.aprovado,
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
  const mediaPor = (campo: "baseK" | "gerenciaK", ign: "base" | "gerencia") =>
    agrupar(todas.filter((l) => passa(l, ign)), (l) => l[campo])
      .map(([k, v]) => ({ chave: k, rotulo: k, valor: media(v.map((l) => l.pontos)) })).sort((x, y) => y.valor - x.valor);
  const ranking = agrupar(linhas, (l) => l.colaboradorId)
    .map(([, v]) => ({ chave: v[0]!.colaboradorId, rotulo: v[0]!.nome, valor: media(v.map((l) => l.pontos)) }))
    .sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo));

  return (
    <section className="space-y-5">
      <CabecalhoPagina titulo="Avaliação" destaque="Teórica" sub="Resultados das provas teóricas · clique nos gráficos para filtrar." atualizadoEm={atualizadoEm} demo={demo} />
      <BarraFiltros todas={todas} ctl={ctl} situacao={{ sim: "Aptos", nao: "Inaptos" }} />

      {demo && <p className="chip chip-warn af">DADOS DE DEMONSTRAÇÃO (fictícios)</p>}
      {erro && <p className="alert af" role="alert">{erro}</p>}
      {!dados && !erro && <div className="grid gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((n) => <div key={n} className="skel" style={{ height: 96 }} />)}</div>}

      {dados && todas.length === 0 && (
        <div className="card au p-8 text-center">
          <p className="text-lg font-bold">Ainda não há provas finalizadas</p>
          <p className="muted mx-auto mt-1 max-w-md text-sm">Assim que um colaborador finalizar a prova teórica, este painel se atualiza sozinho.</p>
        </div>
      )}

      {dados && todas.length > 0 && (
        <>
          <Indicadores itens={[
            { rot: "Avaliados", val: String(linhas.length), cor: "var(--i)" },
            { rot: "Aptos", val: String(aptos), cor: "var(--p)" },
            { rot: "Inaptos", val: linhas.length ? String(inaptos) : "—", cor: "var(--d)" },
            { rot: "Média AT", val: linhas.length ? fmt(media(linhas.map((l) => l.pontos))) : "—", cor: "var(--fg-muted)" },
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
            <Painel titulo="Média por Base" className="lg:col-span-3">
              <Barras itens={mediaPor("baseK", "base")} selecionado={f.base} onSelecionar={(k) => alternar("base", k)} cor="var(--p-h)" />
            </Painel>
            <Painel titulo="Média por Gerência" className="lg:col-span-3">
              <Barras itens={mediaPor("gerenciaK", "gerencia")} selecionado={f.gerencia} onSelecionar={(k) => alternar("gerencia", k)} cor="var(--p-h)" />
            </Painel>
            <Painel titulo="Média de Avaliação" className="lg:col-span-3">
              <Ranking itens={ranking} minimo={REGRAS.teorica.acertosMinimos} max={REGRAS.teorica.totalQuestoes} />
            </Painel>
          </div>
          <p className="faint text-xs">Apto: {REGRAS.teorica.acertosMinimos} ou mais acertos de {REGRAS.teorica.totalQuestoes}. Barras vermelhas no ranking = abaixo do mínimo.</p>
        </>
      )}
    </section>
  );
}
