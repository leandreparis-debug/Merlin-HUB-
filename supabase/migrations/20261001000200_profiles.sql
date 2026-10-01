-- Profils utilisateurs Merlin. Un profil est créé automatiquement pour
-- chaque utilisateur Supabase Auth (trigger handle_new_user), toujours avec
-- le rôle "user" : promouvoir un compte en administrateur est une action
-- explicite effectuée ensuite côté serveur (service role), jamais déduite
-- des métadonnées fournies par l'utilisateur à l'inscription.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique check (email = lower(email)),
  full_name text null,
  role text not null default 'user' check (role in ('user', 'admin')),
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  last_login_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Profil applicatif associé à un utilisateur Supabase Auth (rôle, statut, nom).';
comment on column public.profiles.role is
  'Rôle applicatif : "user" (défaut) ou "admin". Ne jamais dériver des métadonnées auth.users.';
comment on column public.profiles.must_change_password is
  'Vrai tant que l''utilisateur n''a pas changé son mot de passe provisoire.';

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Création automatique du profil à l'inscription d'un utilisateur Auth.
-- Le rôle est TOUJOURS "user" ici : une promotion admin est une action
-- distincte (voir scripts/bootstrap-admin.ts et l'étape 6 - administration
-- des utilisateurs), jamais lue depuis raw_user_meta_data (donnée fournie
-- par le client, donc non fiable pour une décision de sécurité).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    new.raw_user_meta_data ->> 'full_name',
    'user'
  );
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Crée automatiquement le profil applicatif (rôle "user") à l''inscription.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Fonctions utilitaires pour les policies RLS, basées sur l'utilisateur
-- authentifié courant (auth.uid()). STABLE + search_path vide : requis pour
-- une fonction SECURITY DEFINER sûre (évite le détournement de recherche de
-- schéma) ; STABLE permet au planificateur de les mettre en cache pour la
-- durée de la requête.
create or replace function public.is_active_user()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
  );
$$;

comment on function public.is_active_user() is
  'Vrai si l''utilisateur authentifié courant a un profil actif.';

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'Vrai si l''utilisateur authentifié courant est un administrateur actif.';

alter table public.profiles enable row level security;

-- Lecture : un utilisateur voit son propre profil ; un admin voit tout le
-- monde. Aucune policy INSERT/UPDATE/DELETE pour le rôle authenticated : les
-- écritures (changement de rôle, désactivation, etc.) passent exclusivement
-- par le service role, depuis du code serveur qui a déjà vérifié les droits.
create policy "profiles_select_self_or_admin"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());
