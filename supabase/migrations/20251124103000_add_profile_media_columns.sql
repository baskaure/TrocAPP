/*
  Ajoute les colonnes manquantes pour les informations de contact
  et le visuel de bannière sur le profil utilisateur.
*/

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS banner_url text;

