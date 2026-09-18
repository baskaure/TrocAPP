/*
  # Règles métier côté serveur — BonTroc (17/09/2026)

  À exécuter APRÈS 20260917100000_production_hardening.sql. Idempotent.

  Jusqu'ici, toutes les règles (qui peut accepter une proposition, signer un contrat,
  confirmer une livraison, publier un avis…) ne vivaient que dans le JavaScript du
  navigateur. Ce fichier les fait appliquer par PostgreSQL, quel que soit le client.

  1. Contraintes d'unicité et de cohérence (chats, contrats, échanges, avis, litiges,
     propositions, signalements, longueurs de texte, URL des médias).
  2. Comptes bannis / supprimés : aucune écriture possible.
  3. Propriété des lignes insérées (listing.user_id = appelant, etc.).
  4. Modération serveur des mots interdits (severity = 'block').
  5. Machine d'états des propositions.
  6. Signature des contrats via `sign_contract(uuid)` ; plus d'UPDATE direct.
  7. Machine d'états des échanges (démarrage, livraison, confirmation, annulation).
  8. Lecture staff sur les tables de modération et statistiques.
  9. Policies de stockage pour listing-media et profile-media (chemins par propriétaire).
*/

-- ---------------------------------------------------------------------------
-- 0. Utilitaires
-- ---------------------------------------------------------------------------
-- `role::text` plutôt que le littéral : la fonction se crée et s'exécute quelle que soit la
-- liste de valeurs de l'enum `user_role` (voir la migration 20260917099000).
CREATE OR REPLACE FUNCTION public.is_active_member(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role::text <> 'banned' AND status = 'active' FROM public.users WHERE id = uid),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.exchange_parties(p_exchange_id uuid, OUT from_user uuid, OUT to_user uuid, OUT contract_id uuid, OUT contract_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.from_user_id, p.to_user_id, c.id, c.status
  FROM public.exchanges e
  JOIN public.contracts c ON c.id = e.contract_id
  JOIN public.proposals p ON p.id = c.proposal_id
  WHERE e.id = p_exchange_id;
$$;

-- ---------------------------------------------------------------------------
-- 1. Contraintes
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS chats_one_per_proposal ON public.chats (proposal_id);
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'chats : doublons de proposal_id, index non créé (à nettoyer)'; END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS contracts_one_per_proposal_version ON public.contracts (proposal_id, version);
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'contracts : doublons (proposal_id, version), index non créé'; END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS exchanges_one_per_contract ON public.exchanges (contract_id);
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'exchanges : doublons de contract_id, index non créé'; END $$;

DO $$ BEGIN
  -- Une seule proposition initiale ouverte par membre et par annonce (les contre-propositions sont exclues).
  CREATE UNIQUE INDEX IF NOT EXISTS proposals_one_open_per_listing_user
    ON public.proposals (listing_id, from_user_id) WHERE status IN ('pending', 'countered') AND parent_proposal_id IS NULL;
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'proposals : propositions ouvertes en doublon, index non créé'; END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS disputes_one_open_per_exchange
    ON public.disputes (exchange_id) WHERE status IN ('open', 'in_review');
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'disputes : litiges ouverts en doublon, index non créé'; END $$;

ALTER TABLE public.reports ALTER COLUMN status SET DEFAULT 'pending';
DO $$ BEGIN
  ALTER TABLE public.reports ADD CONSTRAINT reports_not_self CHECK (reported_user_id IS NULL OR reported_user_id <> reporter_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN RAISE NOTICE 'reports : auto-signalements existants'; END $$;

DO $$ BEGIN
  ALTER TABLE public.listings ADD CONSTRAINT listings_estimation_order
    CHECK (estimation_min IS NULL OR estimation_max IS NULL OR estimation_min <= estimation_max);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN RAISE NOTICE 'listings : fourchettes inversées existantes'; END $$;

-- Longueurs maximales (miroir des maxLength du front).
DO $$ BEGIN
  ALTER TABLE public.listings ADD CONSTRAINT listings_text_lengths CHECK (
    char_length(title) BETWEEN 3 AND 120
    AND char_length(description_offer) <= 3000
    AND char_length(COALESCE(desired_exchange_desc, '')) <= 3000
  );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN RAISE NOTICE 'listings : textes trop longs existants'; END $$;

DO $$ BEGIN
  ALTER TABLE public.proposals ADD CONSTRAINT proposals_text_lengths CHECK (
    char_length(COALESCE(message, '')) <= 2000
    AND char_length(COALESCE(offer_payload->>'description', '')) <= 2000
  );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN RAISE NOTICE 'proposals : textes trop longs existants'; END $$;

DO $$ BEGIN
  ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_body_length CHECK (char_length(body) BETWEEN 1 AND 2000);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN RAISE NOTICE 'chat_messages : messages trop longs existants'; END $$;

DO $$ BEGIN
  ALTER TABLE public.reviews ADD CONSTRAINT reviews_comment_length CHECK (char_length(COALESCE(comment, '')) <= 1500);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN RAISE NOTICE 'reviews : commentaires trop longs existants'; END $$;

DO $$ BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_text_lengths CHECK (
    char_length(display_name) BETWEEN 1 AND 60
    AND char_length(username) BETWEEN 3 AND 30
    AND char_length(COALESCE(bio, '')) <= 800
    AND char_length(COALESCE(city, '')) <= 80
    AND char_length(COALESCE(country, '')) <= 80
    AND char_length(COALESCE(phone, '')) <= 30
  );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN RAISE NOTICE 'users : textes hors limites existants'; END $$;

DO $$ BEGIN
  ALTER TABLE public.reports ADD CONSTRAINT reports_details_length CHECK (char_length(COALESCE(details, '')) <= 2000);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.disputes ADD CONSTRAINT disputes_reason_length CHECK (char_length(reason) BETWEEN 5 AND 3000);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN NULL; END $$;

-- Les médias d'annonce ne peuvent pointer que vers notre stockage (ou les visuels par défaut historiques).
DO $$ BEGIN
  ALTER TABLE public.listing_media ADD CONSTRAINT listing_media_url_allowed CHECK (
    url LIKE 'https://cuxypeejwglisqidxwfj.supabase.co/storage/v1/object/public/listing-media/%'
    OR url LIKE 'https://images.unsplash.com/%'
    OR url LIKE 'https://images.pexels.com/%'
  );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN RAISE NOTICE 'listing_media : URLs externes existantes, contrainte non ajoutée'; END $$;

-- ---------------------------------------------------------------------------
-- 2 & 3. Écritures : compte actif + propriété des lignes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  v_listing record;
  v_chat_proposal record;
  v_parties record;
BEGIN
  -- service_role / SQL direct / triggers internes : pas de contrôle.
  IF caller IS NULL OR public.is_staff(caller) THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_active_member(caller) THEN
    RAISE EXCEPTION 'Compte suspendu ou supprimé' USING ERRCODE = '42501';
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'listings' THEN
      IF NEW.user_id IS DISTINCT FROM caller THEN
        RAISE EXCEPTION 'Vous ne pouvez publier qu''en votre nom' USING ERRCODE = '42501';
      END IF;
      IF NEW.status NOT IN ('draft', 'published') THEN NEW.status := 'published'; END IF;
      NEW.view_count := 0;

    WHEN 'proposals' THEN
      IF NEW.from_user_id IS DISTINCT FROM caller THEN
        RAISE EXCEPTION 'Vous ne pouvez proposer qu''en votre nom' USING ERRCODE = '42501';
      END IF;
      SELECT user_id, status INTO v_listing FROM public.listings WHERE id = NEW.listing_id;
      IF v_listing IS NULL THEN
        RAISE EXCEPTION 'Annonce introuvable' USING ERRCODE = '23503';
      END IF;
      IF NEW.parent_proposal_id IS NULL THEN
        -- Proposition initiale : destinataire = propriétaire d'une annonce publiée.
        IF v_listing.status <> 'published' THEN
          RAISE EXCEPTION 'Cette annonce n''est plus disponible' USING ERRCODE = '23514';
        END IF;
        IF NEW.to_user_id IS DISTINCT FROM v_listing.user_id THEN
          RAISE EXCEPTION 'Destinataire invalide' USING ERRCODE = '42501';
        END IF;
      ELSE
        -- Contre-proposition : l'appelant doit être une partie de la proposition parente.
        IF NOT EXISTS (
          SELECT 1 FROM public.proposals pp
          WHERE pp.id = NEW.parent_proposal_id
            AND pp.status IN ('pending', 'countered')
            AND ((pp.to_user_id = caller AND pp.from_user_id = NEW.to_user_id)
              OR (pp.from_user_id = caller AND pp.to_user_id = NEW.to_user_id))
        ) THEN
          RAISE EXCEPTION 'Contre-proposition invalide' USING ERRCODE = '42501';
        END IF;
      END IF;
      NEW.status := 'pending';

    WHEN 'chat_messages' THEN
      IF NEW.sender_id IS DISTINCT FROM caller THEN
        RAISE EXCEPTION 'Expéditeur invalide' USING ERRCODE = '42501';
      END IF;
      SELECT p.from_user_id, p.to_user_id INTO v_chat_proposal
      FROM public.chats c JOIN public.proposals p ON p.id = c.proposal_id
      WHERE c.id = NEW.chat_id;
      IF v_chat_proposal IS NULL OR caller NOT IN (v_chat_proposal.from_user_id, v_chat_proposal.to_user_id) THEN
        RAISE EXCEPTION 'Vous ne participez pas à cette conversation' USING ERRCODE = '42501';
      END IF;

    WHEN 'chats' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.proposals p WHERE p.id = NEW.proposal_id AND caller IN (p.from_user_id, p.to_user_id)
      ) THEN
        RAISE EXCEPTION 'Vous ne participez pas à cette proposition' USING ERRCODE = '42501';
      END IF;

    WHEN 'reviews' THEN
      IF NEW.reviewer_id IS DISTINCT FROM caller THEN
        RAISE EXCEPTION 'Auteur invalide' USING ERRCODE = '42501';
      END IF;
      SELECT * INTO v_parties FROM public.exchange_parties(NEW.exchange_id);
      IF v_parties.from_user IS NULL OR caller NOT IN (v_parties.from_user, v_parties.to_user) THEN
        RAISE EXCEPTION 'Vous ne participez pas à cet échange' USING ERRCODE = '42501';
      END IF;
      IF NEW.reviewee_id IS DISTINCT FROM (CASE WHEN caller = v_parties.from_user THEN v_parties.to_user ELSE v_parties.from_user END) THEN
        RAISE EXCEPTION 'Destinataire de l''avis invalide' USING ERRCODE = '42501';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.exchanges WHERE id = NEW.exchange_id AND status = 'confirmed') THEN
        RAISE EXCEPTION 'L''échange doit être confirmé avant de laisser un avis' USING ERRCODE = '23514';
      END IF;

    WHEN 'reports' THEN
      IF NEW.reporter_id IS DISTINCT FROM caller THEN
        RAISE EXCEPTION 'Auteur du signalement invalide' USING ERRCODE = '42501';
      END IF;
      NEW.status := 'pending';
      IF (SELECT count(*) FROM public.reports WHERE reporter_id = caller AND created_at > now() - interval '1 day') >= 10 THEN
        RAISE EXCEPTION 'Trop de signalements aujourd''hui, réessayez demain' USING ERRCODE = '23514';
      END IF;

    WHEN 'disputes' THEN
      IF NEW.opened_by IS DISTINCT FROM caller THEN
        RAISE EXCEPTION 'Auteur du litige invalide' USING ERRCODE = '42501';
      END IF;
      SELECT * INTO v_parties FROM public.exchange_parties(NEW.exchange_id);
      IF v_parties.from_user IS NULL OR caller NOT IN (v_parties.from_user, v_parties.to_user) THEN
        RAISE EXCEPTION 'Vous ne participez pas à cet échange' USING ERRCODE = '42501';
      END IF;
      NEW.status := 'open';
      NEW.resolution := NULL;
      NEW.resolution_notes := NULL;
      NEW.resolved_by := NULL;
      NEW.resolved_at := NULL;

    WHEN 'moderation_logs' THEN
      NEW.user_id := caller;

    WHEN 'contracts' THEN
      RAISE EXCEPTION 'Les contrats sont créés par le serveur (accept-proposal)' USING ERRCODE = '42501';

    WHEN 'exchanges' THEN
      RAISE EXCEPTION 'Les échanges sont créés par le serveur (accept-proposal)' USING ERRCODE = '42501';

    ELSE
      NULL;
  END CASE;

  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['listings', 'proposals', 'chat_messages', 'chats', 'reviews', 'reports', 'disputes', 'moderation_logs', 'contracts', 'exchanges']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_guard_insert ON public.%I', t);
      EXECUTE format('CREATE TRIGGER trg_guard_insert BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_insert()', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Modération serveur
-- ---------------------------------------------------------------------------
-- unaccent est optionnel : on dégrade proprement s'il n'est pas installé.
CREATE OR REPLACE FUNCTION public.unaccent_safe(t text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  IF t IS NULL THEN RETURN NULL; END IF;
  BEGIN
    RETURN extensions.unaccent(t);
  EXCEPTION WHEN undefined_function THEN
    RETURN t;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_no_banned_words(VARIADIC texts text[])
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  w record;
  haystack text;
BEGIN
  haystack := lower(unaccent_safe(array_to_string(texts, ' ')));
  IF haystack IS NULL OR haystack = '' THEN RETURN; END IF;
  FOR w IN SELECT word FROM public.banned_words WHERE severity = 'block' LOOP
    IF haystack ~* ('\m' || regexp_replace(lower(unaccent_safe(w.word)), '([\\^$.|?*+()\[\]{}])', '\\\1', 'g') || '\M') THEN
      RAISE EXCEPTION 'Contenu refusé : le terme « % » n''est pas autorisé', w.word USING ERRCODE = '23514';
    END IF;
  END LOOP;
END;
$$;

-- Seuls les textes réellement modifiés sont contrôlés : sans cela, l'ajout tardif d'un mot à
-- `banned_words` bloquerait des actions sans rapport (refuser une proposition, changer une
-- préférence de notification…) sur un contenu ancien que l'utilisateur ne modifie même pas.
CREATE OR REPLACE FUNCTION public.moderate_row()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF current_setting('bontroc.bypass_guard', true) = 'on' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'listings' THEN
      IF TG_OP = 'INSERT'
         OR NEW.title IS DISTINCT FROM OLD.title
         OR NEW.description_offer IS DISTINCT FROM OLD.description_offer
         OR NEW.desired_exchange_desc IS DISTINCT FROM OLD.desired_exchange_desc THEN
        PERFORM public.assert_no_banned_words(NEW.title, NEW.description_offer, NEW.desired_exchange_desc);
      END IF;
    WHEN 'proposals' THEN
      IF TG_OP = 'INSERT'
         OR NEW.message IS DISTINCT FROM OLD.message
         OR NEW.offer_payload IS DISTINCT FROM OLD.offer_payload THEN
        PERFORM public.assert_no_banned_words(NEW.message, NEW.offer_payload->>'description');
      END IF;
    WHEN 'chat_messages' THEN
      IF TG_OP = 'INSERT' OR NEW.body IS DISTINCT FROM OLD.body THEN
        PERFORM public.assert_no_banned_words(NEW.body);
      END IF;
    WHEN 'reviews' THEN
      IF TG_OP = 'INSERT' OR NEW.comment IS DISTINCT FROM OLD.comment THEN
        PERFORM public.assert_no_banned_words(NEW.comment);
      END IF;
    WHEN 'users' THEN
      IF TG_OP = 'INSERT'
         OR NEW.display_name IS DISTINCT FROM OLD.display_name
         OR NEW.username IS DISTINCT FROM OLD.username
         OR NEW.bio IS DISTINCT FROM OLD.bio THEN
        PERFORM public.assert_no_banned_words(NEW.display_name, NEW.username, NEW.bio);
      END IF;
    ELSE NULL;
  END CASE;

  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['listings', 'proposals', 'chat_messages', 'reviews', 'users']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_moderate ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_moderate BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.moderate_row()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Propositions : machine d'états
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_proposal_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL OR public.is_staff(caller) THEN
    RETURN NEW;
  END IF;

  IF caller NOT IN (OLD.from_user_id, OLD.to_user_id) THEN
    RAISE EXCEPTION 'Vous ne participez pas à cette proposition' USING ERRCODE = '42501';
  END IF;

  -- Seul le statut peut changer depuis un client.
  NEW.listing_id := OLD.listing_id;
  NEW.from_user_id := OLD.from_user_id;
  NEW.to_user_id := OLD.to_user_id;
  NEW.parent_proposal_id := OLD.parent_proposal_id;
  NEW.message := OLD.message;
  NEW.offer_payload := OLD.offer_payload;
  NEW.estimation_min := OLD.estimation_min;
  NEW.estimation_max := OLD.estimation_max;
  NEW.created_at := OLD.created_at;

  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF caller = OLD.to_user_id AND OLD.status = 'pending' AND NEW.status IN ('refused', 'countered') THEN
    RETURN NEW;
  END IF;

  IF caller = OLD.from_user_id AND OLD.status IN ('pending', 'countered') AND NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'accepted' THEN
    RAISE EXCEPTION 'L''acceptation passe par la génération du contrat (fonction accept-proposal)' USING ERRCODE = '42501';
  END IF;

  RAISE EXCEPTION 'Transition de statut non autorisée (% → %)', OLD.status, NEW.status USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_proposal_update ON public.proposals;
CREATE TRIGGER trg_guard_proposal_update
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.guard_proposal_update();

-- ---------------------------------------------------------------------------
-- 6. Contrats : signature par RPC uniquement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_contract_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF current_setting('bontroc.bypass_guard', true) = 'on' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR public.is_staff(auth.uid()) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Utilisez sign_contract() pour signer un contrat' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_contract_update ON public.contracts;
CREATE TRIGGER trg_guard_contract_update
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.guard_contract_update();

CREATE OR REPLACE FUNCTION public.sign_contract(p_contract_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  c record;
  p record;
  now_ts timestamptz := now();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_active_member(caller) THEN
    RAISE EXCEPTION 'Compte suspendu ou supprimé' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO c FROM public.contracts WHERE id = p_contract_id FOR UPDATE;
  IF c IS NULL THEN RAISE EXCEPTION 'Contrat introuvable' USING ERRCODE = 'P0002'; END IF;
  IF c.status <> 'awaiting_signatures' THEN
    RETURN jsonb_build_object('status', c.status, 'accepted_by_from_at', c.accepted_by_from_at, 'accepted_by_to_at', c.accepted_by_to_at, 'already', true);
  END IF;

  SELECT from_user_id, to_user_id INTO p FROM public.proposals WHERE id = c.proposal_id;
  IF caller NOT IN (p.from_user_id, p.to_user_id) THEN
    RAISE EXCEPTION 'Vous n''êtes pas partie à ce contrat' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('bontroc.bypass_guard', 'on', true);
  IF caller = p.from_user_id THEN
    UPDATE public.contracts SET accepted_by_from_at = COALESCE(accepted_by_from_at, now_ts), updated_at = now_ts WHERE id = p_contract_id;
  ELSE
    UPDATE public.contracts SET accepted_by_to_at = COALESCE(accepted_by_to_at, now_ts), updated_at = now_ts WHERE id = p_contract_id;
  END IF;

  UPDATE public.contracts
  SET status = 'active', updated_at = now_ts
  WHERE id = p_contract_id AND accepted_by_from_at IS NOT NULL AND accepted_by_to_at IS NOT NULL;
  PERFORM set_config('bontroc.bypass_guard', 'off', true);

  SELECT * INTO c FROM public.contracts WHERE id = p_contract_id;
  RETURN jsonb_build_object('status', c.status, 'accepted_by_from_at', c.accepted_by_from_at, 'accepted_by_to_at', c.accepted_by_to_at, 'already', false);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sign_contract(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sign_contract(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Échanges : machine d'états
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_exchange_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  parties record;
  has_open_dispute boolean;
  now_ts timestamptz := now();
BEGIN
  IF current_setting('bontroc.bypass_guard', true) = 'on' THEN RETURN NEW; END IF;
  IF caller IS NULL OR public.is_staff(caller) THEN RETURN NEW; END IF;

  SELECT * INTO parties FROM public.exchange_parties(OLD.id);
  IF parties.from_user IS NULL OR caller NOT IN (parties.from_user, parties.to_user) THEN
    RAISE EXCEPTION 'Vous ne participez pas à cet échange' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_active_member(caller) THEN
    RAISE EXCEPTION 'Compte suspendu ou supprimé' USING ERRCODE = '42501';
  END IF;

  -- Tout sauf le statut est piloté par le serveur.
  NEW.contract_id := OLD.contract_id;
  NEW.due_date := OLD.due_date;
  NEW.delivered_at := OLD.delivered_at;
  NEW.delivered_by := OLD.delivered_by;
  NEW.confirmed_at := OLD.confirmed_at;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now_ts;

  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.disputes WHERE exchange_id = OLD.id AND status IN ('open', 'in_review')) INTO has_open_dispute;

  IF OLD.status = 'not_started' AND NEW.status = 'in_progress' THEN
    IF parties.contract_status <> 'active' THEN
      RAISE EXCEPTION 'Le contrat doit être signé par les deux parties avant de démarrer l''échange' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'in_progress' AND NEW.status = 'delivered' THEN
    IF has_open_dispute THEN RAISE EXCEPTION 'Un litige est en cours sur cet échange' USING ERRCODE = '23514'; END IF;
    NEW.delivered_at := now_ts;
    NEW.delivered_by := caller;
    RETURN NEW;
  END IF;

  IF OLD.status = 'delivered' AND NEW.status = 'confirmed' THEN
    IF has_open_dispute THEN RAISE EXCEPTION 'Un litige est en cours sur cet échange' USING ERRCODE = '23514'; END IF;
    -- delivered_by NULL (lignes antérieures à la colonne, ou passage en 'delivered' par le staff) :
    -- on refuse plutôt que de laisser la comparaison NULL autoriser une clôture unilatérale.
    IF OLD.delivered_by IS NULL OR OLD.delivered_by = caller THEN
      RAISE EXCEPTION 'La réception doit être confirmée par l''autre partie' USING ERRCODE = '42501';
    END IF;
    NEW.confirmed_at := now_ts;
    PERFORM set_config('bontroc.bypass_guard', 'on', true);
    UPDATE public.contracts SET status = 'completed', updated_at = now_ts WHERE id = OLD.contract_id;
    PERFORM set_config('bontroc.bypass_guard', 'off', true);
    RETURN NEW;
  END IF;

  IF OLD.status IN ('not_started', 'in_progress') AND NEW.status = 'cancelled' THEN
    PERFORM set_config('bontroc.bypass_guard', 'on', true);
    UPDATE public.contracts SET status = 'cancelled', updated_at = now_ts WHERE id = OLD.contract_id;
    -- L'annonce d'objet avait été retirée du marché à l'acceptation : elle y revient.
    UPDATE public.listings l
    SET status = 'published', updated_at = now_ts
    FROM public.contracts c
    JOIN public.proposals p ON p.id = c.proposal_id
    WHERE c.id = OLD.contract_id
      AND l.id = p.listing_id
      AND l.type = 'product'
      AND l.status = 'archived'
      AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = l.user_id AND u.role::text <> 'banned' AND u.status = 'active');
    PERFORM set_config('bontroc.bypass_guard', 'off', true);
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Transition non autorisée (% → %)', OLD.status, NEW.status USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_exchange_update ON public.exchanges;
CREATE TRIGGER trg_guard_exchange_update
  BEFORE UPDATE ON public.exchanges
  FOR EACH ROW EXECUTE FUNCTION public.guard_exchange_update();

-- Litiges : un membre ne peut modifier que… rien (le staff gère) ; on gèle donc l'UPDATE membre.
CREATE OR REPLACE FUNCTION public.guard_dispute_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_staff(auth.uid()) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Seule l''équipe de modération peut modifier un litige' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_dispute_update ON public.disputes;
CREATE TRIGGER trg_guard_dispute_update
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.guard_dispute_update();

-- Comptes bannis : suspension des annonces ; supprimés : archivage (mise à jour de la fonction précédente).
CREATE OR REPLACE FUNCTION public.handle_user_deactivated()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.role::text = 'banned' AND OLD.role::text IS DISTINCT FROM 'banned' THEN
    UPDATE public.listings SET status = 'suspended', updated_at = now()
      WHERE user_id = NEW.id AND status IN ('published', 'draft');
  END IF;
  IF NEW.status = 'deleted' AND OLD.status IS DISTINCT FROM 'deleted' THEN
    UPDATE public.listings SET status = 'archived', updated_at = now()
      WHERE user_id = NEW.id AND status IN ('published', 'draft', 'suspended');
  END IF;
  IF (NEW.status = 'deleted' AND OLD.status IS DISTINCT FROM 'deleted')
     OR (NEW.role::text = 'banned' AND OLD.role::text IS DISTINCT FROM 'banned') THEN
    UPDATE public.proposals SET status = 'cancelled', updated_at = now()
      WHERE (from_user_id = NEW.id OR to_user_id = NEW.id) AND status IN ('pending', 'countered');
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Lecture / modération par le staff
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['listings', 'listing_media', 'proposals', 'contracts', 'exchanges', 'chats', 'chat_messages', 'reviews', 'reports', 'moderation_logs', 'disputes', 'user_settings', 'esign_requests', 'review_reminders', 'email_logs', 'banned_words', 'email_templates', 'contract_templates']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "Staff can view all %s" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "Staff can view all %s" ON public.%I FOR SELECT TO authenticated USING (public.is_staff(auth.uid()))', t, t);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Staff can moderate listings" ON public.listings;
CREATE POLICY "Staff can moderate listings" ON public.listings FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can update reports" ON public.reports;
CREATE POLICY "Staff can update reports" ON public.reports FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Members can log their own moderation events" ON public.moderation_logs;
CREATE POLICY "Members can log their own moderation events" ON public.moderation_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 9. Stockage : listing-media et profile-media
-- ---------------------------------------------------------------------------
-- Chemins attendus : images/<user_id>-<ts>.<ext>, avatars/<user_id>-<ts>.<ext>, banners/<user_id>-<ts>.<ext>
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (COALESCE(qual, '') ILIKE '%listing-media%' OR COALESCE(with_check, '') ILIKE '%listing-media%'
        OR COALESCE(qual, '') ILIKE '%profile-media%' OR COALESCE(with_check, '') ILIKE '%profile-media%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
    RAISE NOTICE 'Policy storage remplacée : %', p.policyname;
  END LOOP;
END $$;

CREATE POLICY "media: public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('listing-media', 'profile-media'));

CREATE POLICY "media: owner can upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('listing-media', 'profile-media')
    AND (storage.foldername(name))[1] IN ('images', 'avatars', 'banners')
    AND split_part(name, '/', 2) LIKE auth.uid()::text || '-%'
    AND public.is_active_member(auth.uid())
  );

CREATE POLICY "media: owner or staff can update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('listing-media', 'profile-media')
    AND (split_part(name, '/', 2) LIKE auth.uid()::text || '-%' OR public.is_staff(auth.uid()))
  );

CREATE POLICY "media: owner or staff can delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('listing-media', 'profile-media')
    AND (split_part(name, '/', 2) LIKE auth.uid()::text || '-%' OR public.is_staff(auth.uid()))
  );

NOTIFY pgrst, 'reload schema';
