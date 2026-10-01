-- Données de DÉVELOPPEMENT UNIQUEMENT. Ne jamais appliquer ce fichier sur un
-- projet Supabase de production : il ne crée aucun utilisateur, seulement
-- deux applications d'exemple pour visualiser le catalogue de Merlin.

insert into public.apps (slug, name, description, icon, category, is_new, is_hidden)
values
  (
    'outil-entrepots',
    'Outil entrepôts',
    'Suivi des stocks et des mouvements en entrepôt.',
    'warehouse',
    'Logistique',
    true,
    false
  ),
  (
    'comptes-rendus-visites',
    'Comptes rendus de visites',
    'Saisie et consultation des comptes rendus de visites de sites.',
    'clipboard-list',
    'Exploitation',
    false,
    false
  )
on conflict (slug) do nothing;
