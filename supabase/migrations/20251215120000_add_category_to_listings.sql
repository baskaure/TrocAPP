-- Ajoute la catégorie sur les annonces pour les visuels par défaut
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id);

CREATE INDEX IF NOT EXISTS listings_category_id_idx ON public.listings (category_id);

