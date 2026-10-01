-- Fonctions et extensions utilitaires partagées par les migrations suivantes.
-- Portabilité V2 (SQL Server) : voir docs/DATA-MODEL.md § Notes de migration V2.

-- gen_random_uuid() est nécessaire pour générer les identifiants des tables
-- applicatives (auth.users a déjà son propre générateur côté Supabase Auth).
create extension if not exists pgcrypto;

-- Trigger générique qui maintient la colonne `updated_at` à jour à chaque
-- modification de ligne. Utilisé par toutes les tables qui possèdent cette
-- colonne. SECURITY DEFINER inutile ici : un trigger s'exécute déjà avec les
-- droits du propriétaire de la table.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger générique : met à jour la colonne updated_at à chaque UPDATE.';
