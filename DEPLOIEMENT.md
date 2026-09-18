# Mise en production de BonTroc

Procédure à suivre dans l'ordre. Tout ce qui est marqué « manuel » se fait dans les tableaux de bord Supabase ou Netlify : le code ne peut pas le faire à votre place.

## 1. Base de données (Supabase → SQL Editor)

Exécuter, dans cet ordre, le contenu de chaque fichier :

1. `supabase/migrations/20260706120000_add_missing_columns.sql` (non appliquée en production au 17/09/2026 : la colonne `users.status` manquait)
2. `supabase/migrations/20260917100000_production_hardening.sql`
3. `supabase/migrations/20260917101000_business_rules.sql`
4. `supabase/migrations/20260917102000_email_templates.sql`
5. Créer le secret Vault (une seule fois, avec la vraie clé `service_role` du projet) :
   ```sql
   SELECT vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key', 'Clé service_role pour pg_cron');
   ```
   puis exécuter `supabase/migrations/20260917103000_review_reminders_cron.sql` (extensions `pg_cron` et `pg_net` activées dans Database → Extensions).

Chaque script est idempotent : il peut être rejoué. Lire les `NOTICE` affichés : ils signalent les données existantes qui empêcheraient une contrainte (doublons d'avis, propositions à soi-même…) et les policies héritées du schéma initial à vérifier.

Vérifications rapides après exécution :
```sql
select * from public.public_profiles limit 1;          -- la vue existe
select public.is_staff('00000000-0000-0000-0000-000000000000');  -- false
select count(*) from public.email_templates where is_active;     -- 8
```
Avec la clé anon, `GET /rest/v1/users?select=email` doit maintenant renvoyer une liste vide.

**Sauvegarde du schéma** : le schéma initial (tables `users`, `listings`, `proposals`, `contracts`, `exchanges`, `reviews`, `chats`, `chat_messages`, `reports`, `moderation_logs`, `categories`, `user_settings` et leurs policies) n'est pas versionné. Générer une référence avec la CLI :
```bash
npx supabase login && npx supabase link --project-ref cuxypeejwglisqidxwfj
npx supabase db dump -f supabase/schema_baseline.sql
```
et la committer.

## 2. Stockage (Supabase → Storage)

- Buckets attendus : `listing-media` (public), `profile-media` (public), `verification-documents` (privé). La migration crée ce dernier s'il manque et fixe les types et tailles autorisés.
- Vérifier dans Storage → Policies que seules les policies `media: …` et `verification docs: …` restent sur ces buckets.

## 3. Edge Functions (Supabase → Edge Functions)

Secrets à définir (Edge Functions → Secrets) : `RESEND_API_KEY`, et facultativement `EMAIL_FROM` (`BonTroc <noreply@bontroc.fr>`). `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement.

Déployer :
```bash
npm run functions:deploy
```
puis supprimer l'ancienne fonction non authentifiée une fois `accept-proposal` en place :
```bash
npx supabase functions delete generate-contract-pdf
```

Resend : domaine `bontroc.fr` vérifié (SPF, DKIM, DMARC) pour l'expéditeur `noreply@bontroc.fr`.

## 4. Authentification (Supabase → Authentication)

- **URL Configuration** : Site URL `https://bontroc.fr` ; Redirect URLs : `https://bontroc.fr/**`, `https://www.bontroc.fr/**`, `http://localhost:5173/**`.
- **Providers → Email** : confirmation d'e-mail activée ; mot de passe minimum 8 caractères.
- **SMTP personnalisé** (Settings → Auth → SMTP) : utiliser Resend. Sans cela, Supabase limite les e-mails d'inscription et de réinitialisation à quelques envois par heure.
- **Templates d'e-mails** (confirmation, réinitialisation, changement d'adresse) : textes en français, expéditeur `noreply@bontroc.fr`. Le lien de réinitialisation renvoie sur `/reinitialiser-mot-de-passe`, celui de confirmation sur `/connexion`.
- **Google** : client OAuth en mode « production » dans Google Cloud, URL de redirection `https://cuxypeejwglisqidxwfj.supabase.co/auth/v1/callback`.
- **Rate limits** : laisser les valeurs par défaut au minimum ; activer la protection contre les mots de passe compromis si le plan le permet.

## 5. Netlify

- Site connecté au dépôt GitHub, branche `main`, build `npm run build`, dossier `dist` (déjà dans `netlify.toml`).
- Variables d'environnement : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Domaine `bontroc.fr` + redirection `www` → apex, HTTPS forcé.
- Les en-têtes de sécurité (CSP, HSTS…) et le cache sont dans `public/_headers`. Si un nouveau domaine externe est ajouté au code (API, CDN), l'ajouter à la CSP.

## 6. Textes légaux

Compléter les champs `[À COMPLÉTER]` dans `src/components/legal/LegalPage.tsx` : identité de l'éditeur, SIREN, adresse, directeur de la publication, médiateur de la consommation. Sans ces mentions, le site n'est pas conforme à la loi pour la confiance dans l'économie numérique.

## 7. Vérifications avant ouverture

- [ ] Inscription par e-mail : réception du mail de confirmation, connexion, profil créé.
- [ ] Connexion Google : nom et avatar repris.
- [ ] Mot de passe oublié : réception du lien, nouveau mot de passe accepté.
- [ ] Publier une annonce avec photo (poids réduit automatiquement), la voir sur `/annonces`, ouvrir son URL directe dans un onglet privé.
- [ ] Depuis un second compte : proposition → e-mail reçu → acceptation → contrat signé par les deux → démarrage → livraison → confirmation → avis. La note du profil se met à jour.
- [ ] Avec la clé anon (curl) : `/rest/v1/users?select=email` vide ; `/rest/v1/categories` renvoie les catégories.
- [ ] Bannir un compte de test depuis l'administration : ses annonces disparaissent, il ne peut plus se connecter.
- [ ] Supprimer un compte de test : profil anonymisé, adresse e-mail réutilisable.
- [ ] Lighthouse mobile sur `/` et `/annonces` : performance et accessibilité > 90.

## 8. Après la mise en ligne

- Surveiller Supabase → Logs (Edge Functions, Auth) et la table `email_logs` (statut `failed`).
- Sauvegardes : activer les sauvegardes quotidiennes (plan Pro) ou exporter régulièrement.
- Prévoir un outil de suivi d'erreurs front (Sentry ou équivalent) : le composant `ErrorBoundary` est prêt à recevoir un appel.
