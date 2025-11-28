# 🔐 Guide de Configuration - DocuSign

## Étape 1 : Créer un compte DocuSign Developer

1. Va sur https://developers.docusign.com/
2. Crée un compte (gratuit pour le développement)
3. Crée une nouvelle application :
   - Va dans "Apps and Keys"
   - Clique "Add App and Integration Key"
   - Note l'**Integration Key** (Client ID) 3ee8483e-e2af-4bab-8e8a-0d9134c7344a


## Étape 2 : Choisir le type d'authentification

### Option A : Authorization Code Grant (Recommandé pour commencer)

1. **Dans "Authentication"** → Choisis **"User Application"**
2. **Authentication Method** → Choisis **"Authorization Code Grant"**
3. **Coche "Require Proof Key for Code Exchange (PKCE)"** (recommandé)
4. **Redirect URIs** → Ajoute : `https://<TON_PROJECT_REF>.supabase.co/auth/v1/callback`
5. **Génère un Secret Key** → C'est ton `DOCUSIGN_CLIENT_SECRET`

**Credentials nécessaires :**
- `DOCUSIGN_CLIENT_ID` = Integration Key
- `DOCUSIGN_CLIENT_SECRET` = Secret Key généré
- `DOCUSIGN_USER_ID` = Ton email DocuSign (ex: kurashi.uchiwa@gmail.com)

### Option B : Service Integration (RSA) - Avancé

1. **Dans "Authentication"** → Choisis **"Service Integration"**
2. **RSA Keypairs** → Clique **"Generate RSA"**
3. **Télécharge la clé privée** (tu en auras besoin)
4. **Note la clé publique** (affichée dans DocuSign)

**Credentials nécessaires :**
- `DOCUSIGN_CLIENT_ID` = Integration Key
- `DOCUSIGN_RSA_PRIVATE_KEY` = Clé privée RSA (téléchargée)
- `DOCUSIGN_USER_ID` = Ton email DocuSign

### Account ID
1. Va dans "My Account" → "API Account Information"
2. Note l'**Account ID** = `DOCUSIGN_ACCOUNT_ID` (ex: 43956448)

### Base URL
- **Demo/Sandbox** : `https://demo.docusign.net` (par défaut)
- **Production** : `https://www.docusign.net`

## Étape 3 : Configurer les variables d'environnement dans Supabase

1. **Va dans Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**
2. **Ajoute les secrets suivants** :

```
# Option A : Authorization Code Grant
DOCUSIGN_CLIENT_ID=ton_integration_key
DOCUSIGN_CLIENT_SECRET=ton_secret_key
DOCUSIGN_USER_ID=ton_email_docusign
DOCUSIGN_ACCOUNT_ID=ton_account_id
DOCUSIGN_BASE_URL=https://demo.docusign.net
DOCUSIGN_WEBHOOK_SECRET=une_cle_secrete_pour_valider_les_webhooks

# Option B : Service Integration (RSA) - Remplace CLIENT_SECRET par RSA_PRIVATE_KEY
# DOCUSIGN_RSA_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
```

## Étape 4 : Configurer le webhook DocuSign

1. **Dans DocuSign Dashboard** → **Apps and Keys** → **Webhooks**
2. **Ajoute un nouveau webhook** :
   - **URL** : `https://<TON_PROJECT_REF>.functions.supabase.co/docusign-webhook`
   - **Événements à écouter** :
     - `envelope-completed`
     - `envelope-declined`
     - `envelope-voided`
   - **Secret** : Utilise la même valeur que `DOCUSIGN_WEBHOOK_SECRET`

## Étape 5 : Déployer les Edge Functions

```bash
# Déployer la fonction de traitement
supabase functions deploy process-esign-requests --project-ref <TON_PROJECT_REF> --no-verify-jwt

# Déployer le webhook
supabase functions deploy docusign-webhook --project-ref <TON_PROJECT_REF> --no-verify-jwt
```

## Étape 6 : Activer dans l'application

1. **Dans ton fichier `.env`** (ou variables d'environnement) :
   ```
   VITE_ESIGN_PROVIDER=docusign
   ```

2. **Redémarre l'application**

## Étape 7 : Tester

1. **Crée une proposition et accepte-la** → Un `esign_request` est créé
2. **Va dans Admin → Stats** → Clique "Traiter les demandes"
3. **Vérifie** :
   - Les demandes passent de `pending` à `sent`
   - Un `envelope_id` est créé
   - Les participants reçoivent un email DocuSign

## Dépannage

### Erreur : "DocuSign credentials not configured"
→ Vérifie que tous les secrets sont bien définis dans Supabase

### Erreur : "DocuSign auth failed"
→ Vérifie que `DOCUSIGN_CLIENT_ID` et `DOCUSIGN_CLIENT_SECRET` sont corrects

### Erreur : "DocuSign envelope creation failed"
→ Vérifie que `DOCUSIGN_ACCOUNT_ID` est correct
→ Vérifie que `DOCUSIGN_BASE_URL` correspond à ton environnement (demo/production)

### Les webhooks ne fonctionnent pas
→ Vérifie que l'URL du webhook est correcte
→ Vérifie que les événements sont bien sélectionnés dans DocuSign
→ Vérifie les logs de la fonction `docusign-webhook`

## Mode Test (sans DocuSign)

Si tu ne veux pas configurer DocuSign tout de suite, la fonction fonctionne en mode simulation :
- Les demandes passent de `pending` à `sent` (simulé)
- Aucun email n'est envoyé
- Utile pour tester le workflow sans credentials

## Production

Pour la production :
1. Passe de `demo.docusign.net` à `www.docusign.net`
2. Utilise des credentials de production
3. Configure le webhook avec l'URL de production
4. Teste avec de vrais emails

