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
2. **Redirect URIs** → **Ajoute un Redirect URI** (obligatoire pour le consentement) :
   - Clique sur **"Add URI"** ou **"Add Redirect URI"**
   - Ajoute : `https://trophub.netlify.app` (ou n'importe quelle URL valide)
   - Sauvegarde
3. **RSA Keypairs** → Clique **"Generate RSA"** OU **"Add RSA"** si tu as déjà une paire de clés
3. **Si tu génères une nouvelle clé** :
   - DocuSign génère automatiquement la paire
   - **Télécharge la clé privée** (tu en auras besoin)
   - La clé publique est automatiquement enregistrée dans DocuSign
4. **Si tu ajoutes une clé existante** :
   - **IMPORTANT** : Tu dois uploader la clé publique correspondante
   - Extrais la clé publique de ta clé privée (voir ci-dessous)
   - Colle la clé publique dans DocuSign

**⚠️ CRITIQUE : Vérifier que la clé publique est bien uploadée**

Si tu vois l'erreur `"no_valid_keys_or_signatures"`, c'est que la clé publique n'est pas correctement configurée dans DocuSign.

**Pour extraire la clé publique de ta clé privée :**
```bash
# Avec OpenSSL
openssl rsa -in private_key.pem -pubout -out public_key.pem

# Puis copie le contenu de public_key.pem (entre -----BEGIN PUBLIC KEY----- et -----END PUBLIC KEY-----)
# Et colle-le dans DocuSign → "Apps and Keys" → ton app → "RSA Keypairs" → "Add RSA" ou "Edit"
```

**Credentials nécessaires :**
- `DOCUSIGN_CLIENT_ID` = Integration Key
- `DOCUSIGN_RSA_PRIVATE_KEY` = Clé privée RSA (téléchargée) - **IMPORTANT : Convertir en PKCS#8** (voir ci-dessous)
- `DOCUSIGN_USER_ID` = Ton email DocuSign

**⚠️ CRITIQUE : Consentement utilisateur requis**

Avant de pouvoir utiliser JWT avec Service Integration, **tu dois obtenir le consentement de l'utilisateur** (toi-même dans ce cas).

**Étape 1 : Ajouter un Redirect URI (si pas déjà fait)**
1. Dans DocuSign Dashboard → ton app → "Authentication"
2. Sous "Redirect URIs", clique **"Add URI"**
3. Ajoute : `https://trophub.netlify.app` (ou n'importe quelle URL valide)
4. Sauvegarde

**Étape 2 : Obtenir le consentement**
1. **Construis l'URL de consentement** (remplace `TON_INTEGRATION_KEY` par ton Integration Key) :
   ```
   https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=3ee8483e-e2af-4bab-8e8a-0d9134c7344a&redirect_uri=https://trophub.netlify.app
   ```

2. **Ouvre cette URL dans ton navigateur** et connecte-toi avec ton compte DocuSign

3. **Accorde le consentement** à l'application

4. **Tu seras redirigé** vers `https://trophub.netlify.app` (peu importe si la page affiche une erreur, le consentement sera enregistré)

5. **Une fois le consentement accordé**, l'authentification JWT fonctionnera

**Alternative : Utiliser Authorization Code Grant** (plus simple pour commencer)
Si tu as des problèmes avec JWT, utilise plutôt l'Option A (Authorization Code Grant) qui ne nécessite pas de consentement préalable.

**⚠️ Conversion de la clé PKCS#1 vers PKCS#8 :**

DocuSign fournit la clé au format PKCS#1 (`-----BEGIN RSA PRIVATE KEY-----`), mais notre code nécessite PKCS#8 (`-----BEGIN PRIVATE KEY-----`).

**Option 1 : Conversion avec OpenSSL (recommandé)**
```bash
# Si tu as OpenSSL installé
openssl pkcs8 -topk8 -inform PEM -in private_key_pkcs1.pem -outform PEM -nocrypt -out private_key_pkcs8.pem
```

**Option 2 : Utiliser directement la clé PKCS#1**
Le code essaiera de convertir automatiquement, mais si ça ne fonctionne pas, utilise la conversion OpenSSL ci-dessus.

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
