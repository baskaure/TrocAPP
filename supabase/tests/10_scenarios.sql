\set ON_ERROR_STOP on
\set QUIET on
CREATE OR REPLACE FUNCTION public.t_assert(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond IS DISTINCT FROM true THEN RAISE EXCEPTION 'ASSERTION FAILED: %', msg; END IF; RAISE NOTICE 'PASS: %', msg; END $$;
CREATE OR REPLACE FUNCTION public.t_expect_error(sql text, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE sql;
  RAISE EXCEPTION 'EXPECTED ERROR BUT SUCCEEDED: %', msg;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'EXPECTED ERROR BUT SUCCEEDED%' THEN RAISE; END IF;
  RAISE NOTICE 'PASS (refusé comme attendu): % -> %', msg, SQLERRM;
END $$;
GRANT EXECUTE ON FUNCTION public.t_assert(boolean, text), public.t_expect_error(text, text) TO anon, authenticated;

INSERT INTO public.banned_words (word, severity) VALUES ('arnaque', 'block'), ('cul', 'block'), ('urgent', 'warning');

-- 1. Inscriptions (trigger handle_new_user)
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', '{"display_name":"Alice Martin","username":"alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com', '{"display_name":"Bob Durand","username":"bob"}'),
  ('33333333-3333-3333-3333-333333333333', 'alice@autre.fr', '{"full_name":"Alice Google","avatar_url":"https://lh3.googleusercontent.com/a"}'),
  ('44444444-4444-4444-4444-444444444444', 'carol@example.com', '{"display_name":"Carol","username":"carol"}');
SELECT t_assert((SELECT count(*) FROM public.users) = 4, 'profils créés par le trigger');
SELECT t_assert((SELECT username FROM public.users WHERE id = '33333333-3333-3333-3333-333333333333') LIKE 'alice_%', 'collision de username résolue avec suffixe : ' || (SELECT username FROM public.users WHERE id = '33333333-3333-3333-3333-333333333333'));
SELECT t_assert((SELECT display_name FROM public.users WHERE id = '33333333-3333-3333-3333-333333333333') = 'Alice Google', 'display_name repris de full_name (Google)');
SELECT t_assert((SELECT avatar_url FROM public.users WHERE id = '33333333-3333-3333-3333-333333333333') LIKE 'https://lh3%', 'avatar repris de Google');
UPDATE public.users SET role = 'admin' WHERE id = '44444444-4444-4444-4444-444444444444';

-- 2. Anonyme : users invisible, public_profiles et catégories visibles
BEGIN;
SET LOCAL ROLE anon;
SELECT t_assert((SELECT count(*) FROM public.users) = 0, 'anon ne lit plus users');
SELECT t_assert((SELECT count(*) FROM public.public_profiles) = 4, 'anon lit public_profiles');
SELECT t_assert((SELECT count(*) FROM public.categories) = 2, 'anon lit les catégories');
SELECT t_expect_error($q$SELECT public.sign_contract('00000000-0000-0000-0000-000000000000')$q$, 'sign_contract interdit à anon');
COMMIT;

-- 3. Alice publie une annonce
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
SELECT t_assert((SELECT count(*) FROM public.users) = 1, 'un membre ne voit que sa propre ligne users');
INSERT INTO public.listings (id, user_id, type, title, description_offer, status) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'product', 'Vélo de ville', 'Bon état, révisé cette année', 'published');
SELECT t_expect_error($q$INSERT INTO public.listings (user_id, type, title, description_offer) VALUES ('22222222-2222-2222-2222-222222222222', 'service', 'Faux', 'insertion au nom de Bob')$q$, 'annonce au nom d''un autre');
SELECT t_expect_error($q$INSERT INTO public.listings (user_id, type, title, description_offer) VALUES ('11111111-1111-1111-1111-111111111111', 'service', 'Super ARNAQUE garantie', 'texte')$q$, 'mot interdit dans le titre');
INSERT INTO public.listings (user_id, type, title, description_offer) VALUES ('11111111-1111-1111-1111-111111111111', 'service', 'Cours de calcul mental', 'Le mot calcul en contient un autre, mais pas comme mot entier');
SELECT t_expect_error($q$UPDATE public.users SET role = 'admin' WHERE id = '11111111-1111-1111-1111-111111111111' RETURNING (SELECT public.t_assert(false, 'x'))$q$, '(ignoré)');
UPDATE public.users SET role = 'admin', email = 'pirate@evil.com', verification_status = 'verified', is_verified = true, bio = 'Ma bio' WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT t_assert((SELECT role = 'user' AND email = 'alice@example.com' AND is_verified = false AND verification_status = 'none' AND bio = 'Ma bio' FROM public.users WHERE id = '11111111-1111-1111-1111-111111111111'), 'colonnes à privilèges gelées, bio modifiable');
UPDATE public.users SET verification_status = 'pending' WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT t_assert((SELECT verification_status = 'pending' FROM public.users WHERE id = '11111111-1111-1111-1111-111111111111'), 'passage à pending autorisé');
COMMIT;

-- 4. Bob propose
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
SELECT t_expect_error($q$INSERT INTO public.proposals (listing_id, from_user_id, to_user_id, message) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'mauvais destinataire')$q$, 'destinataire ≠ propriétaire');
SELECT t_expect_error($q$INSERT INTO public.proposals (listing_id, from_user_id, to_user_id, message) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'usurpation')$q$, 'from_user ≠ appelant');
INSERT INTO public.proposals (id, listing_id, from_user_id, to_user_id, message, offer_payload, status) VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Je propose une trottinette', '{"description":"Trottinette électrique"}', 'accepted');
SELECT t_assert((SELECT status = 'pending' FROM public.proposals WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001'), 'statut forcé à pending à l''insertion');
SELECT t_expect_error($q$INSERT INTO public.proposals (listing_id, from_user_id, to_user_id, message) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'doublon')$q$, 'deuxième proposition ouverte sur la même annonce');
SELECT t_expect_error($q$UPDATE public.proposals SET status = 'accepted' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$, 'auto-acceptation par l''expéditeur');
INSERT INTO public.chats (proposal_id) VALUES ('bbbbbbbb-0000-0000-0000-000000000001');
SELECT t_expect_error($q$INSERT INTO public.chats (proposal_id) VALUES ('bbbbbbbb-0000-0000-0000-000000000001')$q$, 'second chat pour la même proposition');
INSERT INTO public.chat_messages (chat_id, sender_id, body) VALUES ((SELECT id FROM public.chats WHERE proposal_id = 'bbbbbbbb-0000-0000-0000-000000000001'), '22222222-2222-2222-2222-222222222222', 'Bonjour, calcul rapide : dispo demain ?');
SELECT t_expect_error($q$INSERT INTO public.chat_messages (chat_id, sender_id, body) VALUES ((SELECT id FROM public.chats WHERE proposal_id = 'bbbbbbbb-0000-0000-0000-000000000001'), '22222222-2222-2222-2222-222222222222', 'C''est une ARNÂQUE')$q$, 'mot interdit accentué dans le chat');
SELECT t_expect_error($q$INSERT INTO public.contracts (proposal_id, html_content) VALUES ('bbbbbbbb-0000-0000-0000-000000000001', '<p>faux</p>')$q$, 'contrat créé par un membre');
COMMIT;

-- 5. Alice contre-propose puis on accepte côté serveur (service_role : auth.uid() NULL)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
INSERT INTO public.proposals (id, listing_id, from_user_id, to_user_id, message, offer_payload, parent_proposal_id) VALUES ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Plutôt la trottinette + le casque', '{"description":"Trottinette + casque"}', 'bbbbbbbb-0000-0000-0000-000000000001');
UPDATE public.proposals SET status = 'countered' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
SELECT t_assert((SELECT status = 'countered' FROM public.proposals WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001'), 'parent passé à countered par le destinataire');
INSERT INTO public.chat_messages (chat_id, sender_id, body) VALUES ((SELECT id FROM public.chats WHERE proposal_id = 'bbbbbbbb-0000-0000-0000-000000000001'), '11111111-1111-1111-1111-111111111111', 'Alice répond');
SELECT t_assert(true, 'Alice (participante) écrit dans le chat');
COMMIT;
-- Bob accepte la contre-proposition : simulé comme accept-proposal (service_role)
BEGIN;
SET LOCAL ROLE service_role;
INSERT INTO public.contracts (id, proposal_id, version, html_content, status) VALUES ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 1, '<h1>Contrat</h1>', 'awaiting_signatures');
INSERT INTO public.exchanges (id, contract_id, status) VALUES ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'not_started');
UPDATE public.proposals SET status = 'accepted' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002' AND status = 'pending';
SELECT t_assert((SELECT status = 'accepted' FROM public.proposals WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002'), 'service_role accepte la proposition');
COMMIT;

-- 6. Signatures
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
SELECT t_expect_error($q$SELECT public.sign_contract('cccccccc-0000-0000-0000-000000000001')$q$, 'signature par un tiers');
SELECT t_expect_error($q$UPDATE public.contracts SET accepted_by_to_at = now(), status = 'active' WHERE id = 'cccccccc-0000-0000-0000-000000000001'$q$, 'UPDATE direct de contracts');
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
SELECT t_expect_error($q$UPDATE public.exchanges SET status = 'in_progress' WHERE id = 'dddddddd-0000-0000-0000-000000000001'$q$, 'démarrage avant signature');
SELECT t_assert((public.sign_contract('cccccccc-0000-0000-0000-000000000001')->>'status') = 'awaiting_signatures', 'première signature (Bob, destinataire)');
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
SELECT t_assert((public.sign_contract('cccccccc-0000-0000-0000-000000000001')->>'status') = 'active', 'seconde signature (Alice) → actif');
SELECT t_assert((public.sign_contract('cccccccc-0000-0000-0000-000000000001')->>'already')::boolean, 'resignature idempotente');
COMMIT;

-- 7. Machine d'états de l'échange
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
SELECT t_expect_error($q$UPDATE public.exchanges SET status = 'confirmed' WHERE id = 'dddddddd-0000-0000-0000-000000000001'$q$, 'saut not_started → confirmed');
UPDATE public.exchanges SET status = 'in_progress' WHERE id = 'dddddddd-0000-0000-0000-000000000001';
UPDATE public.exchanges SET status = 'delivered', delivered_by = '22222222-2222-2222-2222-222222222222' WHERE id = 'dddddddd-0000-0000-0000-000000000001';
SELECT t_assert((SELECT delivered_by = '11111111-1111-1111-1111-111111111111' AND delivered_at IS NOT NULL FROM public.exchanges WHERE id = 'dddddddd-0000-0000-0000-000000000001'), 'delivered_by imposé par le serveur');
SELECT t_expect_error($q$UPDATE public.exchanges SET status = 'confirmed' WHERE id = 'dddddddd-0000-0000-0000-000000000001'$q$, 'confirmation par celui qui a livré');
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
INSERT INTO public.disputes (exchange_id, opened_by, reason, status) VALUES ('dddddddd-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Trottinette rayée à la livraison', 'resolved');
SELECT t_assert((SELECT status = 'open' FROM public.disputes WHERE exchange_id = 'dddddddd-0000-0000-0000-000000000001'), 'litige forcé à open');
SELECT t_expect_error($q$UPDATE public.exchanges SET status = 'confirmed' WHERE id = 'dddddddd-0000-0000-0000-000000000001'$q$, 'confirmation bloquée par un litige ouvert');
UPDATE public.disputes SET status = 'resolved' WHERE exchange_id = 'dddddddd-0000-0000-0000-000000000001';
SELECT t_assert((SELECT status = 'open' FROM public.disputes WHERE exchange_id = 'dddddddd-0000-0000-0000-000000000001'), 'membre ne peut pas modifier un litige (RLS : 0 ligne)');
SELECT t_expect_error($q$INSERT INTO public.disputes (exchange_id, opened_by, reason) VALUES ('dddddddd-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'doublon')$q$, 'second litige ouvert');
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444"}', true);
UPDATE public.disputes SET status = 'resolved', resolution = 'Compensation convenue', resolved_by = '44444444-4444-4444-4444-444444444444', resolved_at = now() WHERE exchange_id = 'dddddddd-0000-0000-0000-000000000001';
SELECT t_assert((SELECT status = 'resolved' FROM public.disputes WHERE exchange_id = 'dddddddd-0000-0000-0000-000000000001'), 'admin résout le litige');
SELECT t_assert((SELECT count(*) FROM public.users) = 4, 'staff voit tous les users');
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
UPDATE public.exchanges SET status = 'confirmed' WHERE id = 'dddddddd-0000-0000-0000-000000000001';
SELECT t_assert((SELECT status = 'confirmed' AND confirmed_at IS NOT NULL FROM public.exchanges WHERE id = 'dddddddd-0000-0000-0000-000000000001'), 'Bob confirme la réception');
SELECT t_assert((SELECT status = 'completed' FROM public.contracts WHERE id = 'cccccccc-0000-0000-0000-000000000001'), 'contrat passé à completed');
COMMIT;

-- 8. Avis et réputation
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
SELECT t_expect_error($q$INSERT INTO public.reviews (exchange_id, reviewer_id, reviewee_id, rating) VALUES ('dddddddd-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 5)$q$, 'auto-avis');
INSERT INTO public.reviews (exchange_id, reviewer_id, reviewee_id, rating, comment) VALUES ('dddddddd-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 4, 'Très bien');
SELECT t_expect_error($q$INSERT INTO public.reviews (exchange_id, reviewer_id, reviewee_id, rating) VALUES ('dddddddd-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 1)$q$, 'second avis sur le même échange');
SELECT t_assert((SELECT rating_avg = 4 AND rating_count = 1 FROM public.public_profiles WHERE id = '11111111-1111-1111-1111-111111111111'), 'réputation recalculée côté serveur');
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
SELECT t_expect_error($q$INSERT INTO public.reviews (exchange_id, reviewer_id, reviewee_id, rating) VALUES ('dddddddd-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 5)$q$, 'avis par un non-participant');
COMMIT;
-- Avis avec bio interdite chez le destinataire : le recalcul ne doit pas être bloqué par la modération
UPDATE public.users SET bio = 'arnaque' WHERE id = '11111111-1111-1111-1111-111111111111';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
INSERT INTO public.reviews (exchange_id, reviewer_id, reviewee_id, rating) VALUES ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 5);
SELECT t_assert((SELECT rating_count = 1 FROM public.public_profiles WHERE id = '22222222-2222-2222-2222-222222222222'), 'avis croisé accepté');
COMMIT;

-- 9. Stockage
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
INSERT INTO storage.objects (bucket_id, name) VALUES ('listing-media', 'images/22222222-2222-2222-2222-222222222222-1.webp');
SELECT t_expect_error($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('listing-media', 'images/11111111-1111-1111-1111-111111111111-1.webp')$q$, 'upload au nom d''un autre');
SELECT t_expect_error($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('verification-documents', '11111111-1111-1111-1111-111111111111/verification_1.pdf')$q$, 'pièce d''identité dans le dossier d''un autre');
INSERT INTO storage.objects (bucket_id, name) VALUES ('verification-documents', '22222222-2222-2222-2222-222222222222/verification_1.pdf');
SELECT t_assert((SELECT count(*) FROM storage.objects WHERE bucket_id = 'verification-documents') = 1, 'Bob lit son propre document');
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
SELECT t_assert((SELECT count(*) FROM storage.objects WHERE bucket_id = 'verification-documents') = 0, 'Alice ne voit pas le document de Bob');
COMMIT;

-- 10. Bannissement et suppression
SELECT t_assert(
  EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'banned'),
  'la valeur « banned » a bien été ajoutée à l''enum user_role'
);
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444"}', true);
UPDATE public.users SET role = 'banned' WHERE id = '33333333-3333-3333-3333-333333333333';
SELECT t_assert((SELECT role = 'banned' FROM public.users WHERE id = '33333333-3333-3333-3333-333333333333'), 'admin bannit');
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
SELECT t_expect_error($q$INSERT INTO public.listings (user_id, type, title, description_offer) VALUES ('33333333-3333-3333-3333-333333333333', 'service', 'Banni', 'ne doit pas passer')$q$, 'banni ne publie plus');
COMMIT;
UPDATE public.users SET role = 'banned' WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT t_assert((SELECT count(*) FROM public.listings WHERE user_id = '11111111-1111-1111-1111-111111111111' AND status = 'suspended') = 2, 'annonces suspendues au bannissement');
UPDATE public.users SET role = 'user' WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE public.users SET status = 'deleted', display_name = 'Utilisateur supprimé', bio = NULL WHERE id = '33333333-3333-3333-3333-333333333333';
SELECT t_assert((SELECT display_name = 'Utilisateur supprimé' AND username IS NULL AND avatar_url IS NULL FROM public.public_profiles WHERE id = '33333333-3333-3333-3333-333333333333'), 'profil anonymisé dans la vue');
UPDATE public.users SET profile_visibility = 'private', bio = 'secret', skills = '{"x"}' WHERE id = '22222222-2222-2222-2222-222222222222';
SELECT t_assert((SELECT bio IS NULL AND skills IS NULL AND display_name = 'Bob Durand' FROM public.public_profiles WHERE id = '22222222-2222-2222-2222-222222222222'), 'profil privé : bio et compétences masquées');
SELECT public.increment_listing_views('aaaaaaaa-0000-0000-0000-000000000001');

-- 11. Régressions corrigées après la revue de septembre 2026
-- Un mot ajouté à banned_words après coup ne doit pas bloquer les actions sans rapport.
INSERT INTO public.banned_words (word, severity) VALUES ('trottinette', 'block');
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
UPDATE public.users SET notification_settings = '{"email_new_message": false}'::jsonb WHERE id = '22222222-2222-2222-2222-222222222222';
SELECT t_assert(true, 'préférence modifiable malgré un mot interdit ajouté après coup');
COMMIT;
DELETE FROM public.banned_words WHERE word = 'trottinette';

-- Confirmation impossible quand personne n'a déclaré la livraison (delivered_by NULL).
INSERT INTO public.contracts (id, proposal_id, version, html_content, status) VALUES ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 1, '<p>x</p>', 'active');
UPDATE public.contracts SET accepted_by_from_at = now(), accepted_by_to_at = now() WHERE id = 'cccccccc-0000-0000-0000-000000000002';
INSERT INTO public.exchanges (id, contract_id, status) VALUES ('dddddddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002', 'delivered');
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
SELECT t_expect_error($q$UPDATE public.exchanges SET status = 'confirmed' WHERE id = 'dddddddd-0000-0000-0000-000000000002'$q$, 'confirmation sans livreur identifié');
COMMIT;

-- Annulation d'un échange d'objet : l'annonce revient sur le marché.
INSERT INTO public.listings (id, user_id, type, title, description_offer, status) VALUES ('aaaaaaaa-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'product', 'Table basse en chêne', 'Très bon état', 'archived');
INSERT INTO public.proposals (id, listing_id, from_user_id, to_user_id, message, status) VALUES ('bbbbbbbb-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Je propose une lampe', 'accepted');
INSERT INTO public.contracts (id, proposal_id, version, html_content, status) VALUES ('cccccccc-0000-0000-0000-000000000009', 'bbbbbbbb-0000-0000-0000-000000000009', 1, '<p>x</p>', 'awaiting_signatures');
INSERT INTO public.exchanges (id, contract_id, status) VALUES ('dddddddd-0000-0000-0000-000000000009', 'cccccccc-0000-0000-0000-000000000009', 'not_started');
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
UPDATE public.exchanges SET status = 'cancelled' WHERE id = 'dddddddd-0000-0000-0000-000000000009';
COMMIT;
SELECT t_assert((SELECT status = 'published' FROM public.listings WHERE id = 'aaaaaaaa-0000-0000-0000-000000000009'), 'annonce d''objet republiée après annulation');
SELECT t_assert((SELECT status = 'cancelled' FROM public.contracts WHERE id = 'cccccccc-0000-0000-0000-000000000009'), 'contrat annulé avec l''échange');

-- Pseudo long : l'inscription aboutit malgré une collision (pas de dépassement de longueur).
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('55555555-5555-5555-5555-555555555555', 'long1@example.com', '{"username":"unpseudotreslongdetrentecar"}'),
  ('66666666-6666-6666-6666-666666666666', 'long2@example.com', '{"username":"unpseudotreslongdetrentecar"}'),
  ('77777777-7777-7777-7777-777777777777', 'long3@example.com', '{"username":"unpseudotreslongdetrentecar"}');
SELECT t_assert((SELECT count(*) FROM public.users WHERE email LIKE 'long%@example.com') = 3, 'trois inscriptions avec le même pseudo long');
SELECT t_assert((SELECT bool_and(char_length(username) BETWEEN 3 AND 30) FROM public.users WHERE email LIKE 'long%@example.com'), 'pseudos générés dans les limites : ' || (SELECT string_agg(username, ', ') FROM public.users WHERE email LIKE 'long%@example.com'));
SELECT t_assert((SELECT username = 'unpseudotreslongdetrentecar' FROM public.users WHERE id = '55555555-5555-5555-5555-555555555555'), 'pseudo de 27 caractères conservé tel quel');

-- Le propriétaire peut remplacer sa pièce d'identité (suppression de l'ancienne).
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
DELETE FROM storage.objects WHERE bucket_id = 'verification-documents' AND name = '22222222-2222-2222-2222-222222222222/verification_1.pdf';
SELECT t_assert((SELECT count(*) FROM storage.objects WHERE bucket_id = 'verification-documents') = 0, 'le propriétaire supprime son ancien document');
COMMIT;

-- Purge des identités sociales (droit à l'effacement).
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider) VALUES ('g-1', '33333333-3333-3333-3333-333333333333', '{"sub":"g-1","email":"alice@autre.fr","full_name":"Alice Google"}', 'google');
SELECT t_assert(public.purge_auth_identities('33333333-3333-3333-3333-333333333333') = 1, 'identité sociale purgée');
SELECT t_assert((SELECT identity_data->>'email' IS NULL AND (identity_data->>'deleted')::boolean FROM auth.identities WHERE user_id = '33333333-3333-3333-3333-333333333333'), 'plus d''e-mail dans identity_data');
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
SELECT t_expect_error($q$SELECT public.purge_auth_identities('22222222-2222-2222-2222-222222222222')$q$, 'purge des identités interdite à un membre');
COMMIT;

-- Le staff voit la file de signature électronique.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444"}', true);
SELECT t_assert((SELECT count(*) FROM public.esign_requests) = 0, 'staff interroge esign_requests sans erreur');
SELECT t_assert((SELECT count(*) FROM public.email_logs) = 0, 'staff interroge email_logs sans erreur');
COMMIT;
\echo === SCÉNARIOS TERMINÉS ===
