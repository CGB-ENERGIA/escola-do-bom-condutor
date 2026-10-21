# Escola do Bom Condutor

Programa de reorientação de colaboradores envolvidos em sinistro de trânsito no turno de trabalho.

## Avaliação
1. **Teórica** (digital, por link): 30 questões de 1 ponto, por categoria (**Carro/Caminhonete** ou **Motocicleta**).
   **Aprovado com 20 ou mais acertos; menos que 20 = reprovado.** (`packages/shared/src/config.ts`)
2. **Prática** (preenchida pelo instrutor de trânsito Inaldo Costa): 34 critérios. Leve=3 pts, média=4, grave=5, gravíssima=**eliminatória**.
   **Apto**: nenhuma infração, ou apenas 1 leve e nada mais. **Inapto**: 2+ leves, qualquer média/grave, ou qualquer gravíssima.

## Fluxo atual (modo teste)
1. `/` — o colaborador digita o nome (ou matrícula), seleciona-se na lista e escolhe a categoria.
2. `/prova` — responde uma questão por vez (o gabarito nunca vai para o navegador).
3. `/resultado` — vê a pontuação e o status (APROVADO / REPROVADO).

Sem senha por enquanto (modo teste); o colaborador pode refazer a prova. Resultados de teste:
`GET /api/admin/resultados` com o header `x-admin-key: teste` (variável `ADMIN_KEY`).

## Área do instrutor (`/instrutor`)
Login do instrutor (senha definida em `apps/api/src/auth.ts`, sobrescrevível pela variável `INSTRUTOR_SENHA`) → ficha de avaliação prática (contador por infração,
Apto/Inapto ao vivo, descrição e link de evidência) → lista de resultados (inclui as 126 avaliações já realizadas, importadas do Forms).

## Estrutura
- `packages/shared` — tipos, regras e correção (usados por web e api)
- `apps/api` — Bun + Hono. `src/data/` tem as questões/gabarito e a lista TEMPORÁRIA de colaboradores
- `apps/web` — React + Vite + Tailwind

## Rodando
```bash
bun install
bun run dev          # api :3001 + web :5173  ->  http://localhost:5173
```

## Pendências
- Substituir `colaboradores.ts` pela base oficial; banco de dados; autenticação real
- Upload de evidência (hoje é link); relatórios/consolidado teórica+prática; prova teórica para Caminhão
- Matrículas divergentes entre as planilhas: EDIVALDO SILVA DO NASCIMENTO, JOÃO PEREIRA DA SILVA, RONALDO CABRAL TOME, SERGIO DA SILVA BARROS
