# Mise en production de BonTroc

Procédure à suivre dans l'ordre. Tout ce qui est marqué « manuel » se fait dans les tableaux de bord Supabase ou Netlify : le code ne peut pas le faire à votre place.

## 1. Base de données (Supabase → SQL Editor)

Pour chaque fichier ci-dessous : l'ouvrir dans l'éditeur de code, **copier son contenu** (pas son chemin) dans une nouvelle requête du SQL Editor, puis « Run ». Un fichier à la fois, dans cet ordre.

1. `supabase/migrations/20260917099000_user_role_banned.sql` — **à lancer seul, en premier.**
   `users.role` est un enum `user_role` qui ne contient pas `banned` : le bannissement d'un membre échoue aujourd'hui avec `invalid input value for enum user_role: "banned"`. PostgreSQL interdit d'utiliser une valeur d'enum ajoutée dans la même transaction, et le SQL Editor exécute tout un script en une transaction : ce fichier ne doit donc pas être collé avec un autre.
   Résultat attendu, affiché par le script : `user, moderator, admin, banned`.
2. `supabase/migrations/20260706120000_add_missing_columns.sql` — ajoute `users.status`, `reports.moderator_id`… (si vous l'avez déjà passée, elle ne fait rien).
3. `supabase/migrations/20260917100000_production_hardening.sql`
4. `supabase/migrations/20260917101000_business_rules.sql`
5. `supabase/migrations/20260917102000_email_templates.sql`
6. `supabase/migrations/20260918100000_categories_seed.sql` — la table `categories` est vide en production : sans elle, le filtre par catégorie et le menu déroulant de publication restent vides. Le script affiche les douze catégories créées.
7. Créer le secret Vault (une seule fois, avec la vraie clé `service_role` du projet) :
   ```sql
   SELECT vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key', 'Clé service_role pour pg_cron');
   ```
   puis lancer `supabase/migrations/20260917103000_review_reminders_cron.sql`. Activer avant cela les extensions `pg_cron` et `pg_net` dans Database → Extensions.
   Le script termine par un tableau de quatre lignes : les quatre doivent afficher `OK`, la dernière sous la forme `OK — 0 7 * * * (actif)`. Toute ligne `MANQUANT` indique le prérequis à corriger avant de rejouer le fichier. Ce tableau existe parce que le SQL Editor de Supabase n'affiche pas les messages `NOTICE` : « Success. No rows returned » ne voulait donc rien dire sur la réussite réelle.

Chaque script est idempotent : il peut être rejoué sans dégât. Lire les `NOTICE` affichés à la fin : ils signalent les données existantes qui empêchent une contrainte (avis en double, proposition à soi-même, annonces avec une URL d'image externe) et les policies supprimées.

### Vérifier que tout est en place

Les quatre requêtes se collent ensemble ; le SQL Editor n'affiche que le résultat de la dernière, alors lancez-les **une par une** si vous voulez voir chaque réponse.

```sql
-- 1. La valeur manquante de l'enum a bien été ajoutée (attendu : user, moderator, admin, banned)
SELECT string_agg(enumlabel::text, ', ' ORDER BY enumsortorder)
FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'user_role';

-- 2. La vue publique existe et ne contient ni email ni téléphone (attendu : une ligne de profil)
SELECT * FROM public.public_profiles LIMIT 1;

-- 3. Un identifiant inconnu n'est pas membre de l'équipe (attendu : false)
SELECT public.is_staff('00000000-0000-0000-0000-000000000000');

-- 4. Les modèles d'e-mails sont chargés (attendu : 8)
SELECT count(*) FROM public.email_templates WHERE is_active;

-- 5. Les catégories sont créées et lisibles (attendu : 12)
SELECT count(*) FROM public.categories;
```

Un tableau d'une seule colonne `count` valant `8` est bien le résultat attendu de la quatrième requête : les huit modèles (bienvenue, nouvelle proposition, contre-proposition, nouveau message, contrat prêt, nouvel avis, rappel d'avis, rappel d'échange) sont actifs.

Enfin, le contrôle qui compte, depuis un terminal : avec la clé anon, la table `users` ne doit plus rien renvoyer, alors que la vue publique répond.

```bash
URL=https://cuxypeejwglisqidxwfj.supabase.co
KEY=<clé anon>
curl -s "$URL/rest/v1/users?select=email&limit=1"            -H "apikey: $KEY" -H "Authorization: Bearer $KEY"  # []
curl -s "$URL/rest/v1/public_profiles?select=display_name&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"  # un profil
curl -s "$URL/rest/v1/categories?select=name&limit=3"        -H "apikey: $KEY" -H "Authorization: Bearer $KEY"  # trois catégories
```

Tant que ces migrations ne sont pas passées, l'application affiche « Impossible de charger les annonces » : le front interroge `public_profiles`, qui n'existe pas encore.

### Répéter la manœuvre hors production

`./supabase/tests/run.sh` monte un PostgreSQL 17 dans Docker, reconstitue le schéma, applique toutes les migrations dans l'ordre et rejoue 70 scénarios métier. À lancer avant chaque nouvelle migration.

**Sauvegarde du schéma** : le schéma initial (tables `users`, `listings`, `proposals`, `contracts`, `exchanges`, `reviews`, `chats`, `chat_messages`, `reports`, `moderation_logs`, `categories`, `user_settings` et leurs policies) n'est pas versionné. Générer une référence avec la CLI :
```bash
npx supabase login && npx supabase link --project-ref cuxypeejwglisqidxwfj
npx supabase db dump -f supabase/schema_baseline.sql
```
et la committer.

## 2. Stockage (Supabase → Storage)

- Buckets attendus : `listing-media` (public), `profile-media` (public), `verification-documents` (privé). La migration crée ce dernier s'il manque et fixe les types et tailles autorisés.
- Vérifier dans Storage → Policies que seules les policies `media: …` et `verification docs: …` restent sur ces buckets.
- Contrôle dans le SQL Editor (les trois buckets, dont un seul public) :
  ```sql
  SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id;
  ```
  `verification-documents` doit avoir `public = false`. Depuis le navigateur, l'URL publique d'un document de vérification doit répondre « Bucket not found » : c'est le comportement attendu d'un bucket privé.

## 3. Edge Functions (Supabase → Edge Functions)

**C'est l'étape la plus urgente.** Tant qu'elle n'est pas faite :

- l'ancienne `send-email` reste en ligne **sans aucune authentification** : n'importe qui peut faire expédier un e-mail aux couleurs de BonTroc à l'adresse de son choix (vérifié le 18/09/2026) ;
- l'ancienne `generate-contract-pdf` permet de générer un contrat sur la proposition d'autrui ;
- `accept-proposal` et `delete-account` n'existent pas encore, donc **le nouveau front ne doit pas être mis en ligne avant** : accepter une proposition et supprimer son compte échoueraient.

Ordre à respecter : les fonctions d'abord, Netlify ensuite.

1. Secrets (Edge Functions → Secrets) : `RESEND_API_KEY`, et facultativement `EMAIL_FROM` (`BonTroc <noreply@bontroc.fr>`). `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement.
   À ce jour la clé Resend n'est pas définie : aucun e-mail transactionnel n'est jamais parti.
2. Se connecter à la CLI, une seule fois (un navigateur s'ouvre) :
   ```bash
   npm run functions:login
   ```
3. Déployer les six fonctions :
   ```bash
   npm run functions:deploy
   ```
4. Supprimer l'ancienne fonction de contrat, désormais inutile :
   ```bash
   npx --yes supabase@latest functions delete generate-contract-pdf
   ```

Contrôle depuis un terminal, avec la clé anon. Les trois réponses attendues prouvent que les nouvelles versions sont en place :

```bash
URL=https://cuxypeejwglisqidxwfj.supabase.co
KEY=<clé anon>
# Doit répondre « Modèle non autorisé » (403) et non plus rendre le modèle demandé
curl -s -X POST "$URL/functions/v1/send-email" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -d '{"template_name":"welcome","recipient":"x@example.com"}'
# Doit répondre « Authentification requise » (401)
curl -s -X POST "$URL/functions/v1/accept-proposal" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -d '{}'
# Doit répondre « Authentification requise » (401)
curl -s -X POST "$URL/functions/v1/delete-account" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -d '{}'
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
