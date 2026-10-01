-- Signalements de bugs et demandes (étape 8), avec suivi des changements
-- (report_events) qui prépare le futur outil SAV.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('bug', 'request')),
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 4000),
  app_id uuid null references public.apps (id) on delete set null,
  page_url text null check (page_url is null or char_length(page_url) <= 500),
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'resolved')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high')),
  assigned_to uuid null references public.profiles (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz null
);

comment on table public.reports is
  'Signalements de bugs ou demandes créés par les utilisateurs, suivis par les admins.';

drop trigger if exists set_reports_updated_at on public.reports;
create trigger set_reports_updated_at
  before update on public.reports
  for each row
  execute function public.set_updated_at();

create index if not exists reports_status_created_at_idx
  on public.reports (status, created_at desc);
create index if not exists reports_created_by_idx on public.reports (created_by);

create table if not exists public.report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  actor_id uuid null references public.profiles (id) on delete set null,
  kind text not null
    check (kind in ('created', 'status_changed', 'priority_changed', 'assigned', 'comment')),
  from_value text null,
  to_value text null,
  comment text null check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);

comment on table public.report_events is
  'Historique des changements et commentaires d''un signalement (append-only).';

create index if not exists report_events_report_id_created_at_idx
  on public.report_events (report_id, created_at);

alter table public.reports enable row level security;
alter table public.report_events enable row level security;

-- Un utilisateur actif peut créer un signalement en son propre nom (jamais
-- au nom d'un autre), voir ses propres signalements ; un admin voit tout.
-- Les mises à jour (statut, priorité, assignation) sont réservées aux admins.
create policy "reports_insert_self_only"
  on public.reports
  for insert
  to authenticated
  with check (public.is_active_user() and created_by = auth.uid());

create policy "reports_select_own_or_admin"
  on public.reports
  for select
  to authenticated
  using (created_by = auth.uid() or public.is_admin());

create policy "reports_update_admin_only"
  on public.reports
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "reports_delete_admin_only"
  on public.reports
  for delete
  to authenticated
  using (public.is_admin());

-- Le journal de suivi d'un signalement n'est visible et modifiable que par
-- les admins (l'auteur du signalement voit son évolution via le statut
-- exposé sur `reports`, pas directement sur ce journal dans cette étape).
create policy "report_events_all_admin_only"
  on public.report_events
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
