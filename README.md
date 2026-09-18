# BonTroc

Plateforme de troc en ligne (services et objets) : annonces, propositions, messagerie, contrat d'échange signé en un clic, suivi, avis. SPA React 18 + TypeScript + Vite, backend Supabase (Postgres, Auth, Storage, Edge Functions), e-mails Resend, hébergement Netlify.

## Démarrer en local

```bash
cp .env.example .env      # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm install
npm run dev               # http://localhost:5173
```

Scripts :

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | typecheck puis build de production dans `dist/` |
| `npm run preview` | sert `dist/` en local (port 4173) |
| `npm run check` | typecheck + lint |
| `npm run functions:deploy` | déploie toutes les Edge Functions (CLI Supabase) |

Node 22 requis (voir `.nvmrc`).

## Architecture en bref

- `src/App.tsx` orchestre les vues ; l'URL est synchronisée sans bibliothèque de routage par `src/lib/router.ts` (`/annonces`, `/annonces/<id>`, `/propositions/<id>`, `/echanges`, `/profil`, `/membres/<id>`, `/parametres`, `/admin`, `/connexion`, `/inscription`, `/reinitialiser-mot-de-passe`, `/mentions-legales`, `/confidentialite`, `/cgu`).
- `src/lib/auth-context.tsx` gère la session, l'inscription (avec ou sans confirmation d'e-mail), le mot de passe oublié et la suppression de compte.
- Les profils des autres membres sont lus via la vue `public_profiles` (jamais la table `users`, qui contient e-mail et téléphone).
- Les règles métier vivent dans Postgres (triggers et RPC, voir `supabase/migrations/20260917101000_business_rules.sql`) : le navigateur ne peut pas contourner l'acceptation, la signature, les transitions d'échange ou la modération.
- Les e-mails partent uniquement par l'Edge Function `send-email` (destinataire identifié par son id, préférences respectées, anti-rafale) ou depuis les autres fonctions serveur.

Détails : `AGENTS.md` (structure, conventions, tokens de design).

## Mise en production

La procédure complète, étape par étape (migrations à appliquer, secrets, réglages du tableau de bord Supabase, Netlify, DNS, vérifications), est dans **`DEPLOIEMENT.md`**.
