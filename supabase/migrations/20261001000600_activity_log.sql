-- Journal d'activité (étape 9) : trace des actions significatives, écrit
-- uniquement par le service role (aucune policy d'écriture pour les
-- utilisateurs authentifiés, même admins).

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid null references public.profiles (id) on delete set null,
  actor_email text null,
  action text not null
    check (action ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$')
    check (char_length(action) <= 80),
  entity_type text null,
  entity_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.activity_log is
  'Journal d''activité applicatif (append-only, écrit par le service role uniquement).';
comment on column public.activity_log.actor_email is
  'Copie de l''email de l''acteur au moment de l''action, conservée même si le profil est supprimé.';
comment on column public.activity_log.action is
  'Action au format "domaine.action" en minuscules (ex. auth.login, app.status_changed).';

create index if not exists activity_log_created_at_idx
  on public.activity_log (created_at desc);
create index if not exists activity_log_actor_id_idx on public.activity_log (actor_id);

alter table public.activity_log enable row level security;

-- Lecture réservée aux admins. Aucune policy INSERT/UPDATE/DELETE : seules
-- les écritures effectuées avec le service role (qui contourne la RLS) sont
-- possibles, ce qui garantit que le journal n'est jamais falsifiable
-- depuis le client.
create policy "activity_log_select_admin_only"
  on public.activity_log
  for select
  to authenticated
  using (public.is_admin());
