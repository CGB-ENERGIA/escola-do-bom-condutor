-- Tabelas da Escola do Bom Condutor no Supabase.
-- Rode uma vez em: Supabase > SQL Editor > New query > Run.
-- O RLS fica ligado e sem políticas: a chave pública (anon) não enxerga nada; só a API (service_role) acessa.

create table if not exists public.colaboradores (
  id text primary key, dados jsonb not null, atualizado_em timestamptz not null default now());
create table if not exists public.tentativas (
  id text primary key, colaborador_id text not null, categoria text not null,
  iniciada_em timestamptz not null, finalizada_em timestamptz, dados jsonb not null);
create table if not exists public.avaliacoes_praticas (
  id text primary key, realizada_em timestamptz, dados jsonb not null);
create table if not exists public.evidencias (
  id text primary key, meta jsonb not null, imagem text not null); -- imagem em base64

alter table public.colaboradores enable row level security;
alter table public.tentativas enable row level security;
alter table public.avaliacoes_praticas enable row level security;
alter table public.evidencias enable row level security;

notify pgrst, 'reload schema';
