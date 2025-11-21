# 🔧 FIX AUTHENTIFICATION - PROBLÈME DE CONNEXION

## ❌ Problème
Après inscription, l'utilisateur reste "déconnecté" visuellement même si la requête passe.

## 🔍 Cause
Le code créait manuellement le profil ET un trigger SQL le créait aussi → conflit + erreur silencieuse.

## ✅ SOLUTION

### 1. Exécuter ce SQL sur Supabase

Aller sur **Supabase Dashboard → SQL Editor** et exécuter:

```sql
-- FIX AUTHENTIFICATION - Trigger pour créer le profil user automatiquement

-- 1. Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS on_user_created ON users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS create_user_settings();
DROP FUNCTION IF EXISTS handle_new_user();

-- 2. Créer la fonction qui crée le profil dans users + settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insérer dans users (profil public)
  INSERT INTO public.users (id, email, display_name, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  
  -- Insérer dans user_settings
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Créer le trigger sur auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Vérifier les policies sur users
DROP POLICY IF EXISTS "Users can view all profiles" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

CREATE POLICY "Public profiles are viewable by everyone"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);
```

### 2. Le code a été corrigé

Le fichier `src/lib/auth-context.tsx` a été mis à jour pour:
- ✅ Envoyer `display_name` et `username` dans `raw_user_meta_data`
- ✅ Laisser le trigger SQL créer automatiquement le profil
- ✅ Plus de création manuelle = plus de conflit

### 3. Tester

```bash
# 1. Redémarrer l'app
npm run dev

# 2. Créer un nouveau compte
# 3. Vérifier que vous êtes connecté automatiquement
```

## 🧪 Vérification

Pour vérifier que tout fonctionne, dans Supabase SQL Editor:

```sql
-- Voir les users créés
SELECT id, email, display_name, username, created_at 
FROM users 
ORDER BY created_at DESC 
LIMIT 5;

-- Vérifier le trigger
SELECT tgname, tgrelid::regclass 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
```

## 📝 Que fait le nouveau système

1. **Utilisateur s'inscrit** sur le frontend
2. **Supabase Auth** crée un compte dans `auth.users`
3. **Trigger SQL** s'exécute automatiquement et:
   - Crée le profil dans `public.users`
   - Crée les settings dans `public.user_settings`
   - Utilise les données de `raw_user_meta_data`
4. **Frontend** récupère automatiquement le profil via `onAuthStateChange`

## ⚠️ Si ça ne marche toujours pas

Supprimer les anciens comptes de test:

```sql
-- ATTENTION: Ceci supprime les comptes de test
DELETE FROM auth.users WHERE email LIKE '%test%';
```

Puis créer un nouveau compte.

---

**Problème résolu! L'authentification devrait maintenant fonctionner correctement.** ✅
