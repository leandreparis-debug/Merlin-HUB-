-- Annonces épinglables affichées sur la page d'accueil de Merlin (étape 7).

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  is_pinned boolean not null default false,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.announcements is
  'Annonces internes, épinglables, affichées aux utilisateurs actifs.';

drop trigger if exists set_announcements_updated_at on public.announcements;
create trigger set_announcements_updated_at
  before update on public.announcements
  for each row
  execute function public.set_updated_at();

create index if not exists announcements_pinned_published_idx
  on public.announcements (is_pinned desc, published_at desc);

alter table public.announcements enable row level security;

-- Lecture : un utilisateur actif voit les annonces publiées ; un admin voit
-- aussi les brouillons (non publiées).
create policy "announcements_select_published_or_admin"
  on public.announcements
  for select
  to authenticated
  using (public.is_active_user() and (is_published = true or public.is_admin()));

create policy "announcements_insert_admin_only"
  on public.announcements
  for insert
  to authenticated
  with check (public.is_admin());

create policy "announcements_update_admin_only"
  on public.announcements
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "announcements_delete_admin_only"
  on public.announcements
  for delete
  to authenticated
  using (public.is_admin());
