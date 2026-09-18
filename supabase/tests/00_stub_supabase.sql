-- Reconstitution minimale de l'environnement Supabase pour tester les migrations.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA public, auth, storage, extensions TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON TABLES TO anon, authenticated, service_role;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb,
  email_confirmed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE auth.identities (
  provider_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_data jsonb NOT NULL,
  provider text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (provider, provider_id)
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz DEFAULT now());
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id), name text NOT NULL, owner uuid, created_at timestamptz DEFAULT now());
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE _parts text[]; BEGIN SELECT string_to_array(name, '/') INTO _parts; RETURN _parts[1:array_length(_parts, 1) - 1]; END $$;
INSERT INTO storage.buckets (id, name, public) VALUES ('listing-media', 'listing-media', true), ('profile-media', 'profile-media', true);

-- Schéma applicatif de base (non versionné dans le dépôt) reconstitué d'après les types et les colonnes live.
-- Reproduit la production : `role` est un enum qui ne contient PAS encore 'banned'
-- (la migration 20260917099000 l'ajoute).
CREATE TYPE public.user_role AS ENUM ('user', 'moderator', 'admin');

CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  display_name text NOT NULL,
  username text UNIQUE NOT NULL,
  avatar_url text, bio text, city text, country text,
  geo_lat double precision, geo_lng double precision,
  languages text[] DEFAULT '{}', skills text[] DEFAULT '{}', search_radius_km int DEFAULT 50,
  rating_avg numeric DEFAULT 0, rating_count int DEFAULT 0,
  is_verified boolean DEFAULT false,
  role public.user_role DEFAULT 'user',
  verification_status text DEFAULT 'none', verification_document_url text, verification_notes text, verification_reviewed_at timestamptz, verification_submitted_at timestamptz,
  last_login_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.user_settings (user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE, created_at timestamptz DEFAULT now());
CREATE TABLE public.categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text UNIQUE NOT NULL, icon text, sort_order int DEFAULT 0);
CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('service','product')), title text NOT NULL, description_offer text NOT NULL, desired_exchange_desc text DEFAULT '',
  desired_categories text[], mode text DEFAULT 'both' CHECK (mode IN ('remote','on_site','both')),
  location_lat double precision, location_lng double precision, estimation_min numeric, estimation_max numeric,
  status text DEFAULT 'published' CHECK (status IN ('draft','published','archived','suspended')), view_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.listing_media (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE, url text NOT NULL, type text DEFAULT 'image', sort_order int DEFAULT 0, created_at timestamptz DEFAULT now());
CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), listing_id uuid NOT NULL REFERENCES public.listings(id),
  from_user_id uuid NOT NULL REFERENCES public.users(id), to_user_id uuid NOT NULL REFERENCES public.users(id),
  message text, offer_payload jsonb, estimation_min numeric, estimation_max numeric,
  status text DEFAULT 'pending' CHECK (status IN ('pending','countered','accepted','refused','cancelled')),
  parent_proposal_id uuid REFERENCES public.proposals(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.chats (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposal_id uuid NOT NULL REFERENCES public.proposals(id), created_at timestamptz DEFAULT now());
CREATE TABLE public.chat_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chat_id uuid NOT NULL REFERENCES public.chats(id), sender_id uuid NOT NULL REFERENCES public.users(id), body text NOT NULL, attachments text[], read_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposal_id uuid NOT NULL REFERENCES public.proposals(id), version int DEFAULT 1, html_content text, pdf_url text,
  accepted_by_from_at timestamptz, accepted_by_to_at timestamptz,
  status text DEFAULT 'awaiting_signatures' CHECK (status IN ('awaiting_signatures','active','completed','cancelled')),
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.exchanges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_id uuid NOT NULL REFERENCES public.contracts(id),
  status text DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','delivered','confirmed','cancelled')),
  due_date date, delivered_at timestamptz, confirmed_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), exchange_id uuid NOT NULL REFERENCES public.exchanges(id), reviewer_id uuid NOT NULL REFERENCES public.users(id), reviewee_id uuid NOT NULL REFERENCES public.users(id), rating int NOT NULL, comment text, tags text[], created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE public.reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter_id uuid NOT NULL REFERENCES public.users(id), reported_user_id uuid REFERENCES public.users(id), listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL, proposal_id uuid, chat_id uuid, reason text NOT NULL, details text, status text DEFAULT 'pending', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE public.moderation_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.users(id), action_type text, content text, detected_words text[], created_at timestamptz DEFAULT now());

-- RLS de base volontairement permissive pour les authentifiés : ce sont les triggers des nouvelles migrations qui doivent tenir.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['users','user_settings','categories','listings','listing_media','proposals','chats','chat_messages','contracts','exchanges','reviews','reports','moderation_logs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "base all authenticated" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
CREATE POLICY "base anon listings" ON public.listings FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "base anon media" ON public.listing_media FOR SELECT TO anon USING (true);
CREATE POLICY "base anon reviews" ON public.reviews FOR SELECT TO anon USING (true);
-- Reproduit le bug live : catégories invisibles pour anon (policy uniquement authenticated ci-dessus).
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role;
-- Les catégories réelles sont insérées par la migration 20260918100000.
