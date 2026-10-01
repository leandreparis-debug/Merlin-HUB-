-- Catalogue des applications internes Carrefour Property, leur statut
-- (en ligne / hors ligne / maintenance) et l'historique de ces statuts.

create table if not exists public.apps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
    check (char_length(slug) between 2 and 60),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 200),
  icon text not null default 'app-window'
    check (icon ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  category text not null default 'Général'
    check (char_length(category) between 1 and 40),
  url text null
    check (url is null or url ~ '^https?://')
    check (url is null or char_length(url) <= 500),
  version text null check (version is null or char_length(version) <= 30),
  is_new boolean not null default false,
  owner_name text null check (owner_name is null or char_length(owner_name) <= 80),
  owner_email text null
    check (owner_email is null or char_length(owner_email) <= 254),
  doc_url text null
    check (doc_url is null or doc_url ~ '^https?://')
    check (doc_url is null or char_length(doc_url) <= 500),
  status text not null default 'offline'
    check (status in ('online', 'offline', 'maintenance')),
  status_message text null
    check (status_message is null or char_length(status_message) <= 200),
  status_updated_at timestamptz not null default now(),
  sort_order integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.apps is
  'Catalogue des applications internes Carrefour Property affichées dans Merlin.';
comment on column public.apps.status is
  'Statut affiché : online, offline ou maintenance. Modifié via public.set_app_status().';
comment on column public.apps.sort_order is
  'Ordre d''affichage des cartes. Réattribué via public.reorder_apps().';
comment on column public.apps.icon is
  'Nom d''icône lucide-react en kebab-case (ex. "app-window").';

drop trigger if exists set_apps_updated_at on public.apps;
create trigger set_apps_updated_at
  before update on public.apps
  for each row
  execute function public.set_updated_at();

create index if not exists apps_sort_order_idx on public.apps (sort_order);
create index if not exists apps_is_hidden_idx on public.apps (is_hidden);

-- Historique des changements de statut d'une application (étape 4 : journal
-- des changements affiché dans le catalogue / l'administration).
create table if not exists public.app_status_events (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  previous_status text null check (previous_status in ('online', 'offline', 'maintenance')),
  new_status text not null check (new_status in ('online', 'offline', 'maintenance')),
  note text null check (note is null or char_length(note) <= 300),
  changed_by uuid null references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);

comment on table public.app_status_events is
  'Historique des changements de statut d''une application (append-only).';

create index if not exists app_status_events_app_id_changed_at_idx
  on public.app_status_events (app_id, changed_at desc);

-- Change le statut d'une application et journalise l'événement en une seule
-- transaction implicite (le corps de la fonction s'exécute atomiquement).
-- SECURITY DEFINER : exécutée avec les droits du propriétaire de la table
-- pour pouvoir écrire malgré la RLS, mais ses privilèges d'exécution sont
-- restreints au service role ci-dessous (ni anon, ni authenticated).
-- Portabilité V2 : à porter en procédure stockée SQL Server (voir
-- docs/DATA-MODEL.md § Notes de migration V2).
create or replace function public.set_app_status(
  p_app_id uuid,
  p_new_status text,
  p_note text default null,
  p_changed_by uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_status text;
begin
  if p_new_status not in ('online', 'offline', 'maintenance') then
    raise exception 'Statut invalide : %', p_new_status
      using errcode = '22023';
  end if;

  select status into v_previous_status
  from public.apps
  where id = p_app_id
  for update;

  if not found then
    raise exception 'Application introuvable : %', p_app_id
      using errcode = 'P0002';
  end if;

  update public.apps
  set
    status = p_new_status,
    status_message = p_note,
    status_updated_at = case
      when v_previous_status is distinct from p_new_status then now()
      else status_updated_at
    end
  where id = p_app_id;

  if v_previous_status is distinct from p_new_status then
    insert into public.app_status_events (
      app_id, previous_status, new_status, note, changed_by
    ) values (
      p_app_id, v_previous_status, p_new_status, p_note, p_changed_by
    );
  end if;
end;
$$;

comment on function public.set_app_status(uuid, text, text, uuid) is
  'Met à jour le statut d''une application et journalise l''événement si le statut change.';

revoke all on function public.set_app_status(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.set_app_status(uuid, text, text, uuid)
  to service_role;

-- Réattribue l'ordre d'affichage (0, 1, 2, …) selon l'ordre fourni.
-- Atomique et tout-ou-rien : la validation des identifiants se fait avant
-- toute écriture, donc une erreur ne laisse aucune modification partielle.
create or replace function public.reorder_apps(p_ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_index integer := 0;
begin
  if exists (
    select 1
    from unnest(p_ordered_ids) as ids (id)
    where not exists (select 1 from public.apps a where a.id = ids.id)
  ) then
    raise exception 'Un ou plusieurs identifiants d''application sont inconnus'
      using errcode = 'P0002';
  end if;

  foreach v_id in array p_ordered_ids loop
    update public.apps
    set sort_order = v_index
    where id = v_id;
    v_index := v_index + 1;
  end loop;
end;
$$;

comment on function public.reorder_apps(uuid[]) is
  'Réattribue sort_order (0..n) selon l''ordre d''identifiants fourni.';

revoke all on function public.reorder_apps(uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_apps(uuid[]) to service_role;

alter table public.apps enable row level security;
alter table public.app_status_events enable row level security;

-- Lecture : un utilisateur actif voit les applications non masquées ; un
-- admin voit tout, y compris les applications masquées.
create policy "apps_select_visible_or_admin"
  on public.apps
  for select
  to authenticated
  using (public.is_active_user() and (is_hidden = false or public.is_admin()));

-- Écritures directes réservées aux admins (défense en profondeur : en usage
-- normal, les écritures passent par le service role depuis du code serveur
-- qui a déjà vérifié le rôle admin).
create policy "apps_write_admin_only"
  on public.apps
  for insert
  to authenticated
  with check (public.is_admin());

create policy "apps_update_admin_only"
  on public.apps
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "apps_delete_admin_only"
  on public.apps
  for delete
  to authenticated
  using (public.is_admin());

-- Historique des statuts : réservé aux admins (lecture et écriture directe ;
-- l'écriture normale passe par set_app_status via le service role).
create policy "app_status_events_select_admin_only"
  on public.app_status_events
  for select
  to authenticated
  using (public.is_admin());

create policy "app_status_events_insert_admin_only"
  on public.app_status_events
  for insert
  to authenticated
  with check (public.is_admin());
