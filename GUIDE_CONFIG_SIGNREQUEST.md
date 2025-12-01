# 🔐 Guide de Configuration - SignRequest

SignRequest est **beaucoup plus simple** que DocuSign : juste besoin d'une API key !

## Étape 1 : Créer un compte SignRequest

1. Va sur https://signrequest.com/
2. Crée un compte (gratuit pour commencer)
3. Va dans **Settings** → **API** → **API Keys**
4. **Génère une nouvelle API key** → C'est ton `SIGNREQUEST_API_KEY`

## Étape 2 : Configurer dans Supabase

1. **Va dans Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**
2. **Ajoute les secrets** :
   - Name : `SIGNREQUEST_API_KEY`
     - Value : ton API key SignRequest
   - Name : `SIGNREQUEST_API_ROOT` (optionnel)
     - Value : `https://bontroc.signrequest.com/api/v1` (ton domaine personnalisé)
     - Si non défini, utilise `https://www.signrequest.com/api/v1` par défaut

## Étape 3 : Configurer dans le frontend

Dans `.env.local` (ou variables d'environnement) :
```
VITE_ESIGN_PROVIDER=signrequest
```

## Étape 4 : Déployer la fonction

```bash
supabase functions deploy process-esign-requests --project-ref <TON_PROJECT_REF> --no-verify-jwt
```

## ✅ C'est tout !

SignRequest est beaucoup plus simple :
- ✅ Pas de JWT complexe
- ✅ Pas de consentement utilisateur
- ✅ Pas de clés RSA
- ✅ Juste une API key
- ✅ API REST simple

## 🧪 Test

1. Accepte une proposition dans l'app
2. Le contrat est généré
3. Va dans l'admin panel → "Stats" → "Traiter les demandes"
4. Les participants reçoivent un email SignRequest pour signer

## 📝 Notes

- SignRequest envoie automatiquement les emails aux signataires
- Les documents sont stockés dans SignRequest
- Tu peux voir les documents signés dans ton dashboard SignRequest

