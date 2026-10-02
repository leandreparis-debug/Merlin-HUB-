-- Date de première publication des annonces (étape 7).
--
-- `published_at` devient nullable : NULL = annonce jamais publiée (brouillon).
-- La date est posée une seule fois, à la première publication (création en
-- « publiée » ou passage brouillon → publiée), puis conservée : dépublier et
-- republier ne la modifie pas, ni une modification du texte ou de
-- l'épinglage. Migration additive : la migration 0400 n'est pas modifiée.

alter table public.announcements
  alter column published_at drop not null;

alter table public.announcements
  alter column published_at drop default;

-- Aucune annonce n'a pu être créée avant l'étape 7 (repository non
-- implémenté) : on aligne néanmoins les éventuels brouillons existants.
update public.announcements
  set published_at = null
  where is_published = false;

-- Une annonce publiée a toujours une date de première publication.
alter table public.announcements
  drop constraint if exists announcements_published_has_date;
alter table public.announcements
  add constraint announcements_published_has_date
  check (is_published = false or published_at is not null);

-- Pose `published_at` à la première publication, sans jamais l'écraser.
create or replace function public.set_announcement_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_published and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

comment on function public.set_announcement_published_at() is
  'Trigger : pose published_at à la première publication d''une annonce.';

drop trigger if exists set_announcements_published_at on public.announcements;
create trigger set_announcements_published_at
  before insert or update on public.announcements
  for each row
  execute function public.set_announcement_published_at();
