# 🗑️ Secrets DocuSign à supprimer dans Supabase

## Secrets à supprimer

Va dans **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets** et **supprime** ces secrets :

1. ❌ `DOCUSIGN_CLIENT_ID`
2. ❌ `DOCUSIGN_CLIENT_SECRET`
3. ❌ `DOCUSIGN_RSA_PRIVATE_KEY`
4. ❌ `DOCUSIGN_USER_ID`
5. ❌ `DOCUSIGN_ACCOUNT_ID`
6. ❌ `DOCUSIGN_BASE_URL`
7. ❌ `DOCUSIGN_WEBHOOK_SECRET`

## ⚠️ Signature électronique désactivée

La signature électronique est **désactivée temporairement** car :
- SignRequest ne permet plus de créer de nouveaux tokens API
- Les contrats sont toujours générés, mais sans signature électronique automatique

**Aucun nouveau secret à ajouter pour l'instant.**

## 📝 Fichiers supprimés

Les fichiers suivants ont été supprimés du projet :
- ❌ `GUIDE_CONFIG_DOCUSIGN.md`
- ❌ `DOCUSIGN_SECRETS.md`
- ❌ `DOCUSIGN_RSA_PRIVATE_KEY_FORMATTED.txt`
- ❌ `supabase/functions/docusign-webhook/index.ts`

## ✅ Nouveau guide

Un nouveau guide a été créé : `GUIDE_CONFIG_SIGNREQUEST.md` (beaucoup plus simple !)

## 🚀 Prochaines étapes

1. **Supprime les secrets DocuSign** dans Supabase (liste ci-dessus)
2. **C'est tout !** La signature électronique est désactivée pour l'instant.

Les contrats sont toujours générés automatiquement quand une proposition est acceptée, mais sans signature électronique externe.

Pour réactiver plus tard, voir `GUIDE_ESIGN_DESACTIVE.md`.

