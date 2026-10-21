import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { RegistroTeorico } from "@ebc/shared";
import { CabecalhoPagina } from "../components/Layout";
import { Barras, Linha as GraficoLinha, ListaContagem, Painel, Pizza } from "../components/Graficos";
import { api, useAtualizacao } from "../lib/api";
import { BarraFiltros, Indicadores, agrupar, chaveMes, derivar, rotuloMes, useFiltros, type Filtravel } from "../lib/filtros";

/** Horas de treinamento contabilizadas por participação na Escola do Bom Condutor. */
const HORAS_POR_PARTICIPACAO = 8;

type Linha = RegistroTeorico & Filtravel;

/** Visão geral: participação dos colaboradores na Escola do Bom Condutor (uma participação = uma avaliação teórica finalizada). */
export default function Dash() {
  const [params] = useSearchParams();
  const demo = params.get("demo") === "1";
  const { dados, erro, atualizadoEm } = useAtualizacao(() => api.teorica(demo), `d-${demo}`);
  const ctl = useFiltros<Linha>();
  const { f, set, alternar, passa } = ctl;

  const todas: Linha[] = useMemo(() => (dados?.registros ?? []).map((r) => ({
    ...r, ...derivar(r.finalizadaEm, r.gerencia, r.base), ok: r.aprovado,
  })), [dados]);

  const linhas = todas.filter((l) => passa(l));
  const colaboradores = new Set(linhas.map((l) => l.colaboradorId)).size;

  const porMes = agrupar(todas.filter((l) => passa(l, "ano") && passa(l, "mes") && l.ano), (l) => chaveMes(l.ano, l.mes))
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ chave: k, rotulo: rotuloMes(k), valor: v.length }));
  const horasMes = porMes.map((m) => ({ ...m, valor: m.valor * HORAS_POR_PARTICIPACAO }));
  const mesSel = f.ano && f.mes ? chaveMes(Number(f.ano), Number(f.mes)) : undefined;
  const selecionarMes = (k: string) => (mesSel === k ? set({ ano: "", mes: "" }) : set({ ano: String(Number(k.slice(0, 4))), mes: String(Number(k.slice(5))) }));

  const por = (campo: "baseK" | "gerenciaK", ign: "base" | "gerencia") =>
    agrupar(todas.filter((l) => passa(l, ign)), (l) => l[campo])
      .map(([k, v]) => ({ chave: k, rotulo: k, valor: v.length })).sort((a, b) => b.valor - a.valor);

  const participacao = agrupar(linhas, (l) => l.colaboradorId)
    .map(([k, v]) => ({ chave: k, rotulo: v[0]!.nome, valor: v.length }))
    .sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo));

  return (
    <section className="space-y-5">
      <CabecalhoPagina titulo="Escola do" destaque="Bom Condutor" sub="Participação dos colaboradores · clique nos gráficos para filtrar." atualizadoEm={atualizadoEm} demo={demo} />
      <BarraFiltros todas={todas} ctl={ctl} />

      {demo && <p className="chip chip-warn af">DADOS DE DEMONSTRAÇÃO (fictícios)</p>}
      {erro && <p className="alert af" role="alert">{erro}</p>}
      {!dados && !erro && <div className="grid gap-4 lg:grid-cols-4">{[0, 1].map((n) => <div key={n} className="skel" style={{ height: 96 }} />)}</div>}

      {dados && todas.length === 0 && (
        <div className="card au p-8 text-center">
          <p className="text-lg font-bold">Ainda não há participações registradas</p>
          <p className="muted mx-auto mt-1 max-w-md text-sm">Cada prova teórica finalizada conta como uma participação. Este painel se atualiza sozinho.</p>
        </div>
      )}

      {dados && todas.length > 0 && (
        <>
          <Indicadores itens={[
            { rot: "Colaboradores", val: String(colaboradores), cor: "var(--p)" },
            { rot: "Horas treinadas", val: String(linhas.length * HORAS_POR_PARTICIPACAO), cor: "var(--i)" },
          ]} />

          <div className="grid gap-4 lg:grid-cols-12">
            <Painel titulo="Participantes por Mês" className="lg:col-span-3">
              <Barras itens={porMes} selecionado={mesSel} onSelecionar={selecionarMes} />
            </Painel>
            <Painel titulo="Participantes por Base" className="lg:col-span-3">
              <Barras itens={por("baseK", "base")} selecionado={f.base} onSelecionar={(k) => alternar("base", k)} />
            </Painel>
            <Painel titulo="Participantes por Gerência" className="lg:col-span-3">
              <Barras itens={por("gerenciaK", "gerencia")} selecionado={f.gerencia} onSelecionar={(k) => alternar("gerencia", k)} />
            </Painel>
            <Painel titulo="Participação na Escola" className="row-span-2 lg:col-span-3">
              <ListaContagem itens={participacao} cor="var(--d)" altura="32rem" />
            </Painel>

            <Painel titulo="Horas por Mês" className="lg:col-span-3">
              <GraficoLinha itens={horasMes} selecionado={mesSel} onSelecionar={selecionarMes} />
            </Painel>
            <Painel titulo="Participantes por Base" className="lg:col-span-3">
              <Pizza itens={por("baseK", "base")} selecionado={f.base} onSelecionar={(k) => alternar("base", k)} />
            </Painel>
            <Painel titulo="Participantes por Gerência" className="lg:col-span-3">
              <Pizza itens={por("gerenciaK", "gerencia")} selecionado={f.gerencia} onSelecionar={(k) => alternar("gerencia", k)} />
            </Painel>
          </div>
          <p className="faint text-xs">Cada avaliação teórica finalizada conta como uma participação ({HORAS_POR_PARTICIPACAO} h de treinamento).</p>
        </>
      )}
    </section>
  );
}
