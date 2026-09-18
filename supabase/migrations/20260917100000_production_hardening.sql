/*
  # Durcissement production — BonTroc (17/09/2026)

  À exécuter dans Supabase → SQL Editor (ou `supabase db push`) APRÈS
  20260706120000_add_missing_columns.sql. Idempotent : rejouable sans casse.

  Contenu :
  1.  Fonctions de rôle `is_admin(uid)` / `is_staff(uid)` (SECURITY DEFINER, pas de récursion RLS).
  2.  Colonnes manquantes utilisées par le front : users.status, users.profile_visibility.
  3.  Garde sur les colonnes à privilèges de `users` (rôle, vérification, notes, e-mail),
      avec un contournement contrôlé (`bontroc.bypass_guard`) pour les triggers internes.
  4.  Vue `public_profiles` : le seul point d'accès public aux profils. La table `users`
      n'est plus lisible que par son propriétaire et le staff (fin de la fuite e-mail/téléphone).
  5.  Catégories lisibles par les visiteurs non connectés.
  6.  Recalcul serveur de la réputation (trigger sur `reviews`) ; contraintes anti auto-avis
      et un seul avis par échange et par auteur.
  7.  Interdiction de se proposer un échange à soi-même.
  8.  Trigger de création de profil robuste aux collisions de `username` + reprise de
      l'avatar / du nom fournis par Google OAuth.
  9.  Synchronisation de `users.email` quand l'e-mail change dans auth.users.
  10. Archivage automatique des annonces et annulation des propositions en cours quand un
      compte est banni ou supprimé.
  11. Compteur de vues `increment_listing_views(uuid)` exposé en RPC.
  12. Suppression des policies trop permissives (email_logs, review_reminders,
      esign_requests, contract_templates) — les Edge Functions passent par le service_role.
  13. Policies de stockage pour le bucket privé `verification-documents`.
*/

-- ---------------------------------------------------------------------------
-- 1. Rôles
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT role::text = 'admin' FROM public.users WHERE id = uid), false);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT role::text IN ('admin', 'moderator') FROM public.users WHERE id = uid), false);
$$;

-- ---------------------------------------------------------------------------
-- 2. Colonnes manquantes
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
DO $$ BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'deleted'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_visibility text NOT NULL DEFAULT 'public';
DO $$ BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_profile_visibility_check CHECK (profile_visibility IN ('public', 'private'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_reviewed_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_notes text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS moderator_id uuid REFERENCES public.users(id);
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. Garde sur les colonnes sensibles de `users`
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_user_privileges()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  -- Triggers internes (recalcul de note, synchro e-mail) : passage libre.
  IF current_setting('bontroc.bypass_guard', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Pas de JWT utilisateur : service_role, SQL direct, trigger de signup.
  IF caller IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_admin(caller) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'user';
    NEW.is_verified := false;
    NEW.verification_status := 'none';
    NEW.verification_notes := NULL;
    NEW.rating_avg := 0;
    NEW.rating_count := 0;
    NEW.status := 'active';
    RETURN NEW;
  END IF;

  -- UPDATE — colonnes gelées pour tout le monde sauf admin.
  NEW.role := OLD.role;
  NEW.rating_avg := OLD.rating_avg;
  NEW.rating_count := OLD.rating_count;
  NEW.email := OLD.email;          -- l'e-mail ne change que via auth.users (trigger de synchro)
  NEW.created_at := OLD.created_at;

  IF public.is_staff(caller) THEN
    -- Un modérateur peut instruire une vérification d'identité, mais pas changer un rôle.
    RETURN NEW;
  END IF;

  -- Membre : il ne touche ni à sa vérification ni à ses notes de modération…
  NEW.is_verified := OLD.is_verified;
  NEW.verification_notes := OLD.verification_notes;
  NEW.verification_reviewed_at := OLD.verification_reviewed_at;

  -- …sauf pour (re)soumettre sa pièce d'identité : none/rejected → pending.
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF NOT (
      caller = OLD.id
      AND NEW.verification_status = 'pending'
      AND COALESCE(OLD.verification_status, 'none') IN ('none', 'rejected')
    ) THEN
      NEW.verification_status := OLD.verification_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_privileges ON public.users;
CREATE TRIGGER trg_protect_user_privileges
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_privileges();

-- ---------------------------------------------------------------------------
-- 4. Vue publique des profils + RLS restrictive sur `users`
-- ---------------------------------------------------------------------------
-- La vue s'exécute avec les droits de son propriétaire (postgres) et contourne donc la
-- RLS de `users` : c'est voulu, elle n'expose que des colonnes publiques.
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = false)
AS
SELECT
  id,
  CASE WHEN status = 'deleted' THEN 'Utilisateur supprimé' ELSE display_name END AS display_name,
  CASE WHEN status = 'deleted' THEN NULL ELSE username END AS username,
  CASE WHEN status = 'deleted' THEN NULL ELSE avatar_url END AS avatar_url,
  CASE WHEN status = 'deleted' THEN NULL ELSE banner_url END AS banner_url,
  CASE WHEN status = 'deleted' OR profile_visibility = 'private' THEN NULL ELSE bio END AS bio,
  CASE WHEN status = 'deleted' THEN NULL ELSE city END AS city,
  CASE WHEN status = 'deleted' THEN NULL ELSE country END AS country,
  CASE WHEN status = 'deleted' OR profile_visibility = 'private' THEN NULL ELSE languages END AS languages,
  CASE WHEN status = 'deleted' OR profile_visibility = 'private' THEN NULL ELSE skills END AS skills,
  rating_avg,
  rating_count,
  is_verified,
  profile_visibility,
  status,
  created_at
FROM public.users;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Toutes les policies existantes sur users (quel que soit le verbe, y compris FOR ALL héritées du
-- schéma initial) sont remplacées par le jeu ci-dessous : lecture soi-même/staff, insertion soi-même,
-- mise à jour soi-même/staff, aucune suppression côté client.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', p.policyname);
    RAISE NOTICE 'Policy users supprimée : %', p.policyname;
  END LOOP;
END $$;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Staff can view all profiles"
  ON public.users FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update any profile" ON public.users;
DROP POLICY IF EXISTS "Staff can update any profile" ON public.users;
CREATE POLICY "Staff can update any profile"
  ON public.users FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));


-- ---------------------------------------------------------------------------
-- 5. Catégories visibles par les visiteurs
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'categories' AND policyname = 'Categories are viewable by everyone'
  ) THEN
    CREATE POLICY "Categories are viewable by everyone"
      ON public.categories FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Réputation calculée côté serveur
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_user_rating(target uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF target IS NULL THEN RETURN; END IF;
  PERFORM set_config('bontroc.bypass_guard', 'on', true);
  UPDATE public.users u
  SET rating_avg = COALESCE(s.avg_rating, 0),
      rating_count = COALESCE(s.nb, 0)
  FROM (
    SELECT ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*) AS nb
    FROM public.reviews WHERE reviewee_id = target
  ) s
  WHERE u.id = target;
  PERFORM set_config('bontroc.bypass_guard', 'off', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_review_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recompute_user_rating(NEW.reviewee_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_user_rating(OLD.reviewee_id);
  ELSE
    PERFORM public.recompute_user_rating(NEW.reviewee_id);
    IF OLD.reviewee_id IS DISTINCT FROM NEW.reviewee_id THEN
      PERFORM public.recompute_user_rating(OLD.reviewee_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_recompute_rating ON public.reviews;
CREATE TRIGGER trg_reviews_recompute_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.handle_review_change();

-- Recalcul initial pour tous les profils déjà notés.
SELECT public.recompute_user_rating(reviewee_id) FROM (SELECT DISTINCT reviewee_id FROM public.reviews) r;

DO $$ BEGIN
  ALTER TABLE public.reviews ADD CONSTRAINT reviews_no_self_review CHECK (reviewer_id <> reviewee_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN check_violation THEN RAISE NOTICE 'reviews : des auto-avis existent, contrainte non ajoutée';
END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_exchange_reviewer ON public.reviews (exchange_id, reviewer_id);
EXCEPTION
  WHEN unique_violation THEN RAISE NOTICE 'reviews : doublons existants, index unique non créé';
END $$;

DO $$ BEGIN
  ALTER TABLE public.reviews ADD CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN check_violation THEN RAISE NOTICE 'reviews : notes hors 1-5 existantes';
END $$;

-- ---------------------------------------------------------------------------
-- 7. Pas de proposition à soi-même
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.proposals ADD CONSTRAINT proposals_not_self CHECK (from_user_id <> to_user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN check_violation THEN RAISE NOTICE 'proposals : des propositions à soi-même existent';
END $$;

-- ---------------------------------------------------------------------------
-- 8. Création de profil robuste
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  dname text;
  base_username text;
  candidate text;
  suffix text;
  attempt int := 0;
BEGIN
  dname := COALESCE(
    NULLIF(trim(meta->>'display_name'), ''),
    NULLIF(trim(meta->>'full_name'), ''),
    NULLIF(trim(meta->>'name'), ''),
    split_part(NEW.email, '@', 1)
  );

  base_username := lower(regexp_replace(
    COALESCE(NULLIF(trim(meta->>'username'), ''), split_part(NEW.email, '@', 1)),
    '[^a-zA-Z0-9_]', '', 'g'
  ));
  IF length(base_username) < 3 THEN base_username := 'membre'; END IF;
  -- Même longueur maximale que le formulaire (30) : un pseudo valide côté client n'est pas tronqué.
  base_username := left(base_username, 30);
  candidate := base_username;

  LOOP
    BEGIN
      INSERT INTO public.users (id, email, display_name, username, avatar_url)
      VALUES (
        NEW.id,
        NEW.email,
        left(dname, 60),
        candidate,
        NULLIF(COALESCE(meta->>'avatar_url', meta->>'picture'), '')
      )
      ON CONFLICT (id) DO NOTHING;
      EXIT;
    -- Toute erreur (collision de pseudo, longueur, casse) retente avec un suffixe : l'inscription
    -- ne doit jamais échouer à cause du pseudo, sinon GoTrue renvoie « Database error saving new user ».
    EXCEPTION WHEN unique_violation OR check_violation THEN
      attempt := attempt + 1;
      IF attempt > 6 THEN
        suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      ELSE
        suffix := substr(replace(NEW.id::text, '-', ''), 1, 3 + attempt);
      END IF;
      -- Le candidat reste sous les 30 caractères de la contrainte users_text_lengths.
      candidate := left(base_username, 29 - length(suffix)) || '_' || suffix;
      IF attempt > 12 THEN
        RAISE EXCEPTION 'Impossible de générer un nom d''utilisateur pour %', NEW.id;
      END IF;
    END;
  END LOOP;

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key ON public.users (lower(username));
EXCEPTION
  WHEN unique_violation THEN RAISE NOTICE 'users : usernames en doublon (casse), index unique non créé';
END $$;

-- ---------------------------------------------------------------------------
-- 9. Synchronisation de l'e-mail depuis auth.users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    PERFORM set_config('bontroc.bypass_guard', 'on', true);
    UPDATE public.users SET email = NEW.email, updated_at = now() WHERE id = NEW.id;
    PERFORM set_config('bontroc.bypass_guard', 'off', true);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_updated();

-- ---------------------------------------------------------------------------
-- 10. Compte banni / supprimé : on retire ses annonces et on annule ses propositions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_user_deactivated()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (NEW.status = 'deleted' AND OLD.status IS DISTINCT FROM 'deleted')
     OR (NEW.role::text = 'banned' AND OLD.role::text IS DISTINCT FROM 'banned') THEN
    UPDATE public.listings SET status = 'archived', updated_at = now()
      WHERE user_id = NEW.id AND status IN ('published', 'draft');
    UPDATE public.proposals SET status = 'cancelled', updated_at = now()
      WHERE (from_user_id = NEW.id OR to_user_id = NEW.id) AND status IN ('pending', 'countered');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_deactivated ON public.users;
CREATE TRIGGER trg_user_deactivated
  AFTER UPDATE OF status, role ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_deactivated();

-- ---------------------------------------------------------------------------
-- 11. Compteur de vues
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_listing_views(p_listing_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.listings
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_listing_id AND status = 'published';
$$;
REVOKE EXECUTE ON FUNCTION public.increment_listing_views(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_listing_views(uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 12. Policies trop permissives
-- ---------------------------------------------------------------------------
-- Les Edge Functions écrivent avec le service_role (qui ignore la RLS) : aucun client
-- authentifié n'a besoin d'écrire dans ces tables.
DROP POLICY IF EXISTS "System can insert email logs" ON public.email_logs;
DROP POLICY IF EXISTS "System can insert reminders" ON public.review_reminders;
DROP POLICY IF EXISTS "System can manage esign requests" ON public.esign_requests;

-- Les modèles de contrat ne sont lus que côté serveur : plus de lecture publique.
DROP POLICY IF EXISTS "Anyone can view active templates" ON public.contract_templates;
DROP POLICY IF EXISTS "Staff can view templates" ON public.contract_templates;
CREATE POLICY "Staff can view templates"
  ON public.contract_templates FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- 13. Stockage : pièces d'identité (bucket privé `verification-documents`)
-- ---------------------------------------------------------------------------
-- Chemin attendu : <user_id>/verification_<timestamp>.<ext> (voir ProfilePage).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('verification-documents', 'verification-documents', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "verification docs: owner can upload" ON storage.objects;
CREATE POLICY "verification docs: owner can upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "verification docs: owner and staff can read" ON storage.objects;
CREATE POLICY "verification docs: owner and staff can read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_staff(auth.uid()))
  );

DROP POLICY IF EXISTS "verification docs: staff can delete" ON storage.objects;
DROP POLICY IF EXISTS "verification docs: owner and staff can delete" ON storage.objects;
CREATE POLICY "verification docs: owner and staff can delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_staff(auth.uid()))
  );

-- Limites raisonnables sur les buckets publics (10 Mo, images uniquement).
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id IN ('listing-media', 'profile-media');

-- ---------------------------------------------------------------------------
-- 14. Effacement des identités sociales (droit à l'effacement)
-- ---------------------------------------------------------------------------
-- `auth.identities.identity_data` conserve l'e-mail, le nom et la photo fournis par Google.
-- L'API d'administration ne permet pas de les purger ; cette fonction le fait, et n'est
-- appelable que par le service_role (Edge Function delete-account).
CREATE OR REPLACE FUNCTION public.purge_auth_identities(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = auth, public
AS $$
DECLARE
  purged integer := 0;
BEGIN
  UPDATE auth.identities
  SET identity_data = jsonb_build_object('sub', identity_data->>'sub', 'deleted', true)
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS purged = ROW_COUNT;
  RETURN purged;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.purge_auth_identities(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_auth_identities(uuid) TO service_role;

-- Rechargement du cache PostgREST (nouvelle vue, nouvelles RPC).
NOTIFY pgrst, 'reload schema';
