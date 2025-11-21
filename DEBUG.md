# 🐛 Guide de Débogage - Écran Blanc

## Étape 1: Ouvrir la Console Navigateur

**IMPORTANT**: Toujours commencer par ouvrir la console:

1. Appuie sur `F12` (ou `Cmd+Option+I` sur Mac)
2. Va dans l'onglet "Console"
3. Regarde les messages d'erreur (en rouge)

**Screenshot des touches:**
- Windows/Linux: `F12`
- Mac: `Cmd + Option + I`
- Chrome: Clic droit → "Inspecter"

---

## Étape 2: Utiliser la Page de Test

J'ai créé une page de test: `TEST.html`

### Comment l'utiliser:

```bash
# Si tu es en dev:
# Place TEST.html dans le dossier public/ et va sur:
http://localhost:5173/TEST.html

# Ou ouvre-le directement:
# Double-clic sur TEST.html dans ton explorateur
```

Cette page va tester:
1. ✅ Variables d'environnement
2. ✅ Connexion Supabase
3. ✅ Lecture base de données

---

## Étape 3: Vérifications Rapides

### A. Variables d'Environnement

Vérifie que `.env` contient:

```env
VITE_SUPABASE_URL=https://zntqiieporxphwhsvryi.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpudHFpaWVwb3J4cGh3aHN2cnlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDI1NTYsImV4cCI6MjA3NzIxODU1Nn0.1ylyM00xApip3ZujtkcD22QmvLPZDFBgIPuuNfw_lyw
```

**⚠️ SI LES VALEURS SONT DIFFÉRENTES:**

1. Va dans ton dashboard Supabase
2. Settings → API
3. Copie les nouvelles valeurs
4. Remplace dans `.env`
5. **IMPORTANT**: Redémarre le serveur dev (`npm run dev`)

### B. Redémarrer le Serveur

Après avoir modifié `.env`:

```bash
# Arrête le serveur (Ctrl+C)
# Puis relance:
npm run dev
```

Les variables d'environnement ne sont chargées qu'au démarrage!

---

## Étape 4: Erreurs Communes

### Erreur 1: "Missing Supabase environment variables"

**Cause**: Le fichier `.env` n'est pas lu

**Solution**:
```bash
# 1. Vérifie que .env est à la racine du projet
ls -la .env

# 2. Vérifie le contenu
cat .env

# 3. Redémarre le serveur
npm run dev
```

### Erreur 2: Écran blanc sans erreur

**Cause**: Erreur JavaScript silencieuse

**Solution**:
1. Ouvre la console (F12)
2. Onglet "Console"
3. Regarde les erreurs en rouge
4. Onglet "Network" → Vérifie que les fichiers JS se chargent

### Erreur 3: "Failed to fetch" ou erreurs réseau

**Cause**: Problème de connexion Supabase

**Solution**:
```bash
# Teste la connexion:
curl https://zntqiieporxphwhsvryi.supabase.co

# Si ça ne fonctionne pas, vérifie:
# 1. Ta connexion internet
# 2. Ton firewall
# 3. Que Supabase n'est pas en maintenance
```

### Erreur 4: "Invalid JWT" ou "Unauthorized"

**Cause**: Clé Supabase expirée ou incorrecte

**Solution**:
1. Va sur https://supabase.com/dashboard
2. Sélectionne ton projet
3. Settings → API
4. Copie la nouvelle `anon` key
5. Remplace dans `.env`
6. Redémarre le serveur

---

## Étape 5: Tests Manuels dans la Console

Ouvre la console (F12) et teste:

### Test 1: Variables d'Environnement

```javascript
console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Key length:', import.meta.env.VITE_SUPABASE_ANON_KEY?.length);
```

**Résultat attendu:**
```
URL: https://zntqiieporxphwhsvryi.supabase.co
Key length: 223
```

### Test 2: Supabase Client

```javascript
// Vérifie que le client existe
console.log('Supabase client:', window.supabase);
```

### Test 3: Test Requête Simple

```javascript
// Dans la console:
const { data, error } = await supabase.from('categories').select('*').limit(1);
console.log('Categories:', data, error);
```

---

## Étape 6: Build vs Dev

### Mode Dev (`npm run dev`)
- Utilise Vite en hot reload
- Affiche les erreurs en temps réel
- Console très bavarde (c'est bien!)

### Mode Build (`npm run build`)
- Compile pour production
- Minifie le code
- Erreurs moins claires

**Pour déboguer: TOUJOURS utiliser `npm run dev`**

---

## Étape 7: Vérification Supabase

### Dans le Dashboard Supabase:

1. **Table Editor** → Vérifie que les tables existent:
   - users
   - listings
   - categories
   - proposals
   - etc.

2. **Authentication** → Vérifie que tu peux te connecter

3. **API Settings** → Vérifie:
   - Project URL (commence par https://)
   - anon key (très longue chaîne)
   - service_role key (ne PAS utiliser dans le front!)

---

## Étape 8: Logs Détaillés

J'ai ajouté des logs dans le code. Tu devrais voir:

```javascript
Supabase Config: {url: "https://...", keyLength: 223}
AppContent rendering...
Auth state: {user: false, authLoading: true}
```

Si tu ne vois PAS ces logs:
1. Le fichier JS ne se charge pas
2. Erreur de syntaxe JavaScript
3. Vérifier l'onglet "Network" (F12)

---

## Étape 9: Cas Extrême - Réinstaller

Si rien ne fonctionne:

```bash
# 1. Supprime node_modules
rm -rf node_modules

# 2. Supprime le cache
rm -rf .vite
rm -rf dist

# 3. Réinstalle
npm install

# 4. Rebuild
npm run build

# 5. Relance dev
npm run dev
```

---

## Étape 10: Checklist Complète

- [ ] Console ouverte (F12)
- [ ] `.env` à la racine avec les bonnes valeurs
- [ ] `npm run dev` lancé APRÈS avoir modifié `.env`
- [ ] Page TEST.html testée
- [ ] Onglet Network vérifié (fichiers JS chargés?)
- [ ] Onglet Console vérifié (erreurs en rouge?)
- [ ] Supabase Dashboard vérifié (tables existent?)
- [ ] Internet fonctionne (ping google.com)

---

## 🆘 Messages d'Erreur Fréquents

### "Uncaught SyntaxError"
→ Erreur de syntaxe JavaScript
→ Vérifie le dernier fichier modifié
→ Regarde la ligne indiquée dans l'erreur

### "Failed to load module"
→ Import incorrect
→ Vérifie les chemins dans les imports
→ `npm install` pour réinstaller

### "Cannot read property 'xxx' of undefined"
→ Variable undefined
→ Vérifie les données chargées
→ Ajoute des `console.log()` pour déboguer

### "Network request failed"
→ Problème réseau ou CORS
→ Vérifie ta connexion
→ Vérifie l'URL Supabase

---

## 📞 Étapes Suivantes

Si après TOUT ça, ça ne fonctionne toujours pas:

1. **Copie les erreurs de la console** (screenshot ou texte)
2. **Vérifie l'onglet Network** → Est-ce qu'il y a des requêtes en rouge?
3. **Teste TEST.html** → Quels tests échouent?
4. **Vérifie Supabase Dashboard** → Les tables sont-elles là?

Avec ces informations, on pourra diagnostiquer le problème exact!

---

## ✅ Tout Fonctionne?

Si tu vois:
```
Supabase Config: {url: "https://...", keyLength: 223}
AppContent rendering...
```

Et que l'interface s'affiche → **C'EST BON!** 🎉

---

## 🎯 Résumé Court

```bash
# 1. Vérifie .env
cat .env

# 2. Redémarre le dev server
npm run dev

# 3. Ouvre la console (F12)

# 4. Regarde les erreurs

# 5. Teste TEST.html
```

**90% des problèmes viennent de:**
- `.env` mal configuré
- Serveur dev pas redémarré après modif `.env`
- Console pas ouverte (donc tu ne vois pas les erreurs)
