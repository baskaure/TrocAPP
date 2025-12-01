# 📝 Signature Électronique - Désactivée Temporairement

## Statut Actuel

La signature électronique est **désactivée** pour l'instant car :
- ❌ SignRequest ne permet plus de créer de nouveaux tokens API
- ❌ DocuSign était trop complexe à configurer
- ✅ Les contrats sont toujours générés automatiquement
- ✅ Les utilisateurs peuvent toujours accepter les contrats dans l'app

## Ce qui fonctionne toujours

1. **Génération de contrats** : Quand une proposition est acceptée, un contrat PDF est généré
2. **Acceptation des contrats** : Les deux parties peuvent accepter le contrat dans l'interface
3. **Suivi des échanges** : Le système de suivi d'échange fonctionne normalement

## Ce qui ne fonctionne pas

- ❌ Envoi automatique de demandes de signature électronique (HelloSign, DocuSign, etc.)
- ❌ Suivi du statut de signature via API externe

## Pour réactiver plus tard

Quand tu voudras réactiver la signature électronique, voici les options :

### Option 1 : HelloSign (Dropbox Sign)
- Plus simple que DocuSign
- API REST avec clé API simple
- Documentation : https://developers.hellosign.com/

### Option 2 : Box Sign
- Recommandé par SignRequest
- Documentation : https://developer.box.com/docs/sign-request-api

### Option 3 : Solution personnalisée
- Intégrer une autre solution de signature électronique
- Modifier `src/lib/esign.ts` et `supabase/functions/process-esign-requests/index.ts`

## Code à modifier pour réactiver

1. **`src/lib/esign.ts`** : Changer `isEsignEnabled()` pour retourner `Boolean(provider)`
2. **`supabase/functions/process-esign-requests/index.ts`** : Implémenter l'intégration avec le nouveau service
3. **Variables d'environnement** : Ajouter les secrets nécessaires dans Supabase

---

**Note** : Pour l'instant, l'app fonctionne parfaitement sans signature électronique automatique. Les contrats sont générés et acceptés dans l'interface, ce qui est suffisant pour le MVP.

