/*
  # Catégories d'annonces (18/09/2026)

  Constat : la table `public.categories` est vide en production et toutes les annonces ont
  `category_id = NULL`. Conséquences visibles : le panneau « Filtres » n'affiche aucune
  catégorie, le menu déroulant du formulaire de publication est vide, et les annonces sans
  photo retombent toutes sur le même visuel générique.

  Cette migration :
  1. réaffirme l'accès en lecture pour les visiteurs (la liste doit être publique) ;
  2. insère douze catégories dont les `slug` correspondent aux visuels par défaut du front
     (`src/components/listings/placeholders.ts`).

  Idempotent : `ON CONFLICT (slug)` met à jour le libellé et l'ordre sans créer de doublon,
  et aucune annonce existante n'est modifiée.
*/

-- 1. Lecture publique
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.categories TO anon, authenticated;

DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
CREATE POLICY "Categories are viewable by everyone"
  ON public.categories FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Staff can manage categories" ON public.categories;
CREATE POLICY "Staff can manage categories"
  ON public.categories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 2. Jeu de catégories
INSERT INTO public.categories (name, slug, icon, sort_order) VALUES
  ('Services & coups de main',   'services',     'support_agent',   1),
  ('Cours & formation',          'education',    'school',          2),
  ('Informatique & high-tech',   'informatique', 'computer',        3),
  ('Bricolage & outillage',      'bricolage',    'handyman',        4),
  ('Maison & électroménager',    'maison',       'home',            5),
  ('Meubles & décoration',       'mobilier',     'chair',           6),
  ('Jardin & plantes',           'jardinage',    'yard',            7),
  ('Sport & plein air',          'sport',        'directions_bike', 8),
  ('Mode & accessoires',         'mode',         'checkroom',       9),
  ('Arts & création',            'arts',         'palette',        10),
  ('Véhicules & mobilité',       'vehicules',    'directions_car', 11),
  ('Bien-être & beauté',         'bien-etre',    'spa',            12)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      icon = EXCLUDED.icon,
      sort_order = EXCLUDED.sort_order;

-- Vérification : doit renvoyer 12 lignes, lisibles par un visiteur non connecté.
SELECT sort_order, name, slug FROM public.categories ORDER BY sort_order;
