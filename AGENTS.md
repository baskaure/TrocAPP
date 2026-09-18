# AGENTS.md — BonTroc / TrocAPP

Plateforme de troc en ligne (services et objets). SPA React/TypeScript avec Supabase comme backend. UI entièrement en français.

---

## Stack technique

| Couche | Outil | Version |
|--------|-------|---------|
| Framework | React | 18.3 |
| Langage | TypeScript | 5.5 |
| Bundler | Vite | 7 |
| Styling | Tailwind CSS 3.4 (tokens Material Design 3) | — |
| Icônes | Material Symbols Outlined (sous-ensemble `icon_names` dans `index.html`) + Lucide | — |
| Cartes | React Leaflet / Leaflet (chargé à la demande) | — |
| Backend | Supabase (Postgres 17, Auth, Storage, Edge Functions Deno) | supabase-js 2 |
| E-mails | Resend, via Edge Functions uniquement | — |
| Géoloc | Nominatim → Photon (fallback), cache mémoire | — |
| Auth sociale | Google OAuth | — |
| Hébergement | Netlify (`netlify.toml`, `public/_redirects`, `public/_headers`) | Node 22 |

## Scripts

```bash
npm run dev               # Vite (localhost:5173)
npm run build             # tsc --noEmit puis vite build
npm run preview           # sert dist/ (4173)
npm run check             # typecheck + lint
npm run functions:deploy  # déploie toutes les Edge Functions
```

Mise en production : voir `DEPLOIEMENT.md` (migrations à appliquer, secrets, réglages Supabase/Netlify, checklist).

---

## Architecture

### Routage
Pas de bibliothèque de routage. `src/lib/router.ts` fait la correspondance URL ↔ vue (`parsePath`, `buildPath`, `titleFor`, `pushRoute`) et `App.tsx` la synchronise : `history.pushState` à chaque changement de vue, `popstate` pour le bouton retour, `document.title` par vue. Un lien profond (`/annonces/<id>`, `/propositions/<id>`, `/membres/<id>`) charge l'objet par id si le state ne l'a pas.

Chemins : `/` (landing anonyme), `/annonces`, `/annonces/nouvelle`, `/annonces/<id>`, `/propositions`, `/propositions/<id>`, `/echanges`, `/profil`, `/membres/<id>`, `/parametres`, `/admin`, `/connexion`, `/inscription`, `/reinitialiser-mot-de-passe`, `/mentions-legales`, `/confidentialite`, `/cgu`. Alias anglais acceptés (`/exchanges`, `/proposals`…).

Les vues lourdes sont en `React.lazy` (landing avec framer-motion, fiche annonce avec Leaflet, admin…).

### État
- `AuthContext` (`src/lib/auth-context.tsx`) : session, `user` (ligne `users` complète, la sienne uniquement), `signIn/signUp/signOut`, `requestPasswordReset/updatePassword`, `deleteAccount`, `authNotice` (compte suspendu/supprimé), `passwordRecovery`. Les rafraîchissements de jeton ne recréent pas l'objet `user`.
- `NoticeProvider` (`src/components/ui/Toast.tsx`) : `useNotice()` → `toast.success/error/info` et `confirm({...})` (promesse). **Ne jamais utiliser `alert()`/`confirm()` natifs.**
- `useState` local dans `App.tsx` pour les annonces (paginées par 24), filtres, vue active.

### Hiérarchie
```
App → AuthProvider → AppContent
  ├── Header / AppSidebar / <vue> / AppFooter / MobileBottomNav
  └── (plein écran) LandingPage · AuthPage · ResetPasswordPage
NoticeProvider et ErrorBoundary enveloppent App dans main.tsx.
```

---

## Structure des fichiers clés

```
src/
├── App.tsx                          # Orchestration, routage, fil des annonces
├── main.tsx                         # ErrorBoundary + NoticeProvider
├── index.css                        # Tailwind, focus visible, reduced-motion, .contract-body
├── lib/
│   ├── supabase.ts                  # Client + types (User, PublicProfile, Listing…) + errorMessage()
│   ├── queries.ts                   # LISTING_SELECT / PROPOSAL_SELECT (embeds public_profiles)
│   ├── router.ts                    # URL ↔ vue, titres
│   ├── auth-context.tsx
│   ├── notifications.ts             # sendTransactionalEmail(template, recipientUserId, vars)
│   ├── moderation.ts                # mots interdits (frontières de mots, sans accents)
│   ├── image.ts                     # prepareImage() : vérification + redimension WebP côté client
│   ├── labels.ts                    # libellés/classes de statuts, formatDateFr, USERNAME_RE
│   ├── geocode.ts
│   └── utils.ts
└── components/
    ├── layout/ (Header, AppSidebar, AppFooter, MobileBottomNav, PageBackLink, app-layout)
    ├── home/LandingPage.tsx
    ├── auth/ (AuthPage, ResetPasswordPage)
    ├── legal/LegalPage.tsx          # mentions légales, confidentialité, CGU (champs [À COMPLÉTER])
    ├── listings/ (ListingCard, CreateListingModal, ListingDetailModal, placeholders.ts)
    ├── proposals/ (ProposalsPortal, ProposalDetailModal)
    ├── exchanges/ (ExchangesPage, ExchangeTracker, ReviewModal)
    ├── contracts/ContractModal.tsx  # signature via RPC sign_contract, HTML assaini (DOMPurify)
    ├── chat/ChatWindow.tsx
    ├── maps/LocationMap.tsx
    ├── reports/ReportModal.tsx
    ├── profile/ (ProfilePage, PublicProfilePage)
    ├── settings/SettingsPage.tsx
    ├── admin/AdminPage.tsx
    ├── ui/ (Toast.tsx, shape-landing-hero, background-gradient-animation)
    └── ErrorBoundary.tsx

supabase/
├── functions/
│   ├── _shared/ (auth.ts getCaller/adminClient, cors.ts, email.ts sendTemplateEmail)
│   ├── send-email/                  # appelé par le navigateur ; auth + allowlist + anti-relais
│   ├── accept-proposal/             # acceptation atomique : contrat + échange + statut + e-mails
│   ├── delete-account/              # anonymisation + auth.admin
│   ├── send-review-reminders/       # cron quotidien (service_role)
│   ├── process-esign-requests/      # staff uniquement (fonction désactivée côté produit)
│   └── generate-contract-pdf/       # stub 410, à supprimer après déploiement
├── migrations/                      # 2025… + 20260917099000 (enum) et 100000/101000/102000/103000 (durcissement)
├── tests/                           # run.sh : Postgres 17 en Docker, migrations + 70 scénarios métier
└── scripts/                         # SQL de debug et sources CSV (non exécutés)
```

---

## Base de données

### Tables principales
`users`, `listings`, `listing_media`, `proposals`, `chats`, `chat_messages`, `contracts`, `exchanges`, `reviews`, `disputes`, `reports`, `categories`, `banned_words`, `moderation_logs`, `email_templates`, `email_logs`, `contract_templates`, `review_reminders`, `esign_requests`, `user_settings`.

### Vue `public_profiles`
Seul accès aux profils des autres membres (`users` est lisible uniquement par soi-même et le staff). Colonnes : `id, display_name, username, avatar_url, banner_url, bio, city, country, languages, skills, rating_avg, rating_count, is_verified, profile_visibility, status, created_at`. Embeds : `user:public_profiles(...)`, `from_user:public_profiles!proposals_from_user_id_fkey(...)`.

### Règles serveur (migration `20260917101000`)
- `guard_insert` : compte actif, propriété des lignes, destinataire d'une proposition = propriétaire de l'annonce, participant d'un chat/échange.
- `moderate_row` : mots interdits bloquants (listings, proposals, chat_messages, reviews, users).
- `guard_proposal_update` : destinataire → refused/countered ; expéditeur → cancelled ; **accepted uniquement via `accept-proposal`**.
- `sign_contract(uuid)` RPC ; aucun UPDATE direct sur `contracts`.
- `guard_exchange_update` : not_started→in_progress (contrat actif), in_progress→delivered (delivered_by = appelant), delivered→confirmed (autre partie, sans litige ouvert), →cancelled.
- `protect_user_privileges` : rôle, notes, e-mail gelés ; `recompute_user_rating` par trigger sur `reviews`.
- `increment_listing_views(uuid)` RPC.

### Statuts
- Listing : `draft | published | archived | suspended`
- Proposal : `pending | countered | accepted | refused | cancelled`
- Exchange : `not_started | in_progress | delivered | confirmed | cancelled`
- Contract : `awaiting_signatures | active | completed | cancelled`
- Dispute : `open | in_review | resolved | dismissed`
- Report : `pending | resolved | dismissed`
- User role : `user | moderator | admin | banned` (enum `user_role` ; `banned` ajouté par la migration `20260917099000`, à exécuter seule) ; `users.status` : `active | deleted`

Plusieurs colonnes de statut sont des enums PostgreSQL : comparer une valeur absente de l'enum fait échouer la requête, et même la création d'une fonction SQL. Dans les migrations, les comparaisons de rôle passent donc par `role::text`.

---

## Variables d'environnement

Front (`.env`, cf. `.env.example`) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
Edge Functions (secrets Supabase) : `RESEND_API_KEY`, `EMAIL_FROM` (optionnel). `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sont injectés.

---

## Styling — Tailwind (Material Design 3)

- Couleur primaire `#2D8DBF`. Tokens à utiliser systématiquement (jamais `gray-*`, `slate-*`, `green-*` ni hexadécimal en dur) :

| Usage | Token |
|-------|-------|
| Primaire (CTA) | `bg-primary` / `text-primary` / `text-on-primary` |
| Texte | `text-on-surface`, secondaire `text-on-surface-variant` |
| Fond | `bg-background` / `bg-surface` ; carte `bg-surface-container-lowest` ; section douce `bg-surface-container-low` |
| Bordures | `border-outline-variant/15` à `/30` |
| Accent jaune | `bg-secondary-container` / `text-on-secondary-container` |
| Succès | `bg-primary-container` / `text-on-primary-container` |
| Erreur | `bg-error-container` / `text-on-error-container` / `text-error` |

- Polices : Manrope (`font-headline`, titres h1–h4) et Inter (`font-inter`, corps). Montserrat et Open Sans ne sont plus chargées.
- Cartes : `rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg` ; compactes `rounded-2xl`.
- h1 pages : `text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight` ; modales/détail : `text-2xl sm:text-3xl md:text-4xl font-black`.
- Touch targets : boutons ≥ 40 px (`min-h-10`), actions principales `min-h-11`/`min-h-12`, dock mobile 44 px.
- Icônes Material : `<span className="material-symbols-outlined" aria-hidden>nom</span>`. **Tout nouveau nom d'icône doit être ajouté à `icon_names` dans `index.html`** (police en sous-ensemble).
- Le mode sombre n'est pas activé : ne pas ajouter de classes `dark:`.

---

## Points importants

1. **Langue** : tout l'UI est en français.
2. **Navigation** : passer par `navigate({ view, ... })` dans `App.tsx` (jamais `window.location`).
3. **Tests** : `./supabase/tests/run.sh` pour les règles serveur (Docker requis) ; `npm run check` + `npm run build` avant tout commit ; captures via `npm run preview`. Aucun test de composant React.
4. **Profils** : ne jamais embarquer `users(*)` dans une requête client ; utiliser `public_profiles`. L'e-mail d'un autre membre n'est jamais disponible côté client.
5. **E-mails** : `sendTransactionalEmail(template, recipientUserId, variables)` ; templates autorisés depuis le client : `welcome`, `new_proposal`, `counter_proposal`, `new_chat_message`, `new_review`. Les autres partent des Edge Functions. Modèles = migration `20260917102000_email_templates.sql`.
6. **Images** : toujours `prepareImage()` avant `storage.upload` ; chemins `images|avatars|banners/<user_id>-<timestamp>.<ext>` (policies de stockage).
7. **Modération** : `checkContent()` côté client pour prévenir, trigger `moderate_row` côté serveur pour bloquer.
8. **Acceptation d'une proposition** : uniquement `supabase.functions.invoke('accept-proposal')`.
9. **Suppression de compte** : `deleteAccount()` du contexte (Edge Function `delete-account`).
10. **Textes légaux** : `LegalPage.tsx` contient des champs `[À COMPLÉTER]` (éditeur, SIREN, médiateur).
11. **E-signature** : désactivée (SignRequest fermé) ; la signature est un clic sur BonTroc (signature électronique simple).

## Patterns

```typescript
// Requête annonces avec profil public
const { data } = await supabase.from('listings').select(LISTING_SELECT).eq('status', 'published').range(0, 23);

// Mutation vérifiée (RLS peut renvoyer 0 ligne sans erreur)
const { data, error } = await supabase.from('x').update({...}).eq('id', id).select('id');
if (error || !data?.length) throw new Error('Refusé');

// Notifications
const { toast, confirm } = useNotice();
if (await confirm({ title: 'Supprimer ?', danger: true })) { ...; toast.success('Fait.'); }
```
