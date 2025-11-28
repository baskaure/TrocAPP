# 🧪 Guide de Test - Sprint 5

## ✅ Étape 1 : Exécuter la Migration SQL

1. **Ouvre Supabase Dashboard** → SQL Editor
2. **Ouvre le fichier** : `supabase/migrations/20251128120000_add_sprint5_tables.sql`
3. **Copie-colle tout le contenu** dans l'éditeur SQL
4. **Clique "Run"** (ou F5)
5. **Vérifie** : Tu devrais voir "Success. No rows returned"

---

## ✅ Étape 2 : Tester les Litiges (Workflow Complet)

### Prérequis
- Avoir au moins **1 échange** avec le statut `in_progress` ou `delivered`
- Si tu n'en as pas, crée-en un :
  1. Accepte une proposition (cela crée un contrat et un échange)
  2. Va dans "Mes échanges"
  3. Clique "Voir les détails" sur un échange

### Test : Ouvrir un Litige

1. **Ouvre un échange** (statut "En cours" ou "Livré")
2. **Scroll vers le bas** → Tu devrais voir une section "Litige"
3. **Clique "Ouvrir un litige"**
4. **Remplis le formulaire** :
   - Raison : "Le produit n'est pas conforme à la description"
5. **Clique "Envoyer"**
6. **Vérifie** :
   - ✅ Le formulaire disparaît
   - ✅ Un message "Litige en cours" apparaît
   - ✅ Le statut est "open"

### Test : Voir le Litige dans l'Admin

1. **Connecte-toi en tant qu'admin** (ou modérateur)
2. **Va dans "Administration"** (menu utilisateur)
3. **Clique sur l'onglet "Litiges"**
4. **Vérifie** :
   - ✅ Ton litige apparaît dans la liste
   - ✅ Statut : "Ouvert"
   - ✅ Raison affichée
   - ✅ Informations sur l'échange

### Test : Résoudre un Litige (Admin)

1. **Dans l'onglet "Litiges"** de l'admin
2. **Trouve ton litige**
3. **Ajoute des notes** dans le textarea (optionnel)
4. **Clique "Prendre en charge"** → Statut passe à "En cours"
5. **Ajoute une résolution** : "Nous avons contacté les deux parties..."
6. **Clique "Résoudre"** → Statut passe à "Résolu"
7. **Vérifie** :
   - ✅ Le statut change dans la liste
   - ✅ La résolution s'affiche

### Test : Voir la Résolution (Utilisateur)

1. **Retourne sur ton compte utilisateur**
2. **Ouvre l'échange** avec le litige
3. **Scroll vers la section "Litige"**
4. **Vérifie** :
   - ✅ Statut : "Litige résolu"
   - ✅ Résolution affichée
   - ✅ Notes du modérateur visibles

---

## ✅ Étape 3 : Tester les Rappels d'Avis (Automatique)

### Prérequis
- Avoir au moins **1 échange confirmé** (statut `confirmed`)
- L'échange doit avoir été confirmé il y a **au moins 2 jours**

### Déployer l'Edge Function

1. **Ouvre un terminal** dans le dossier du projet
2. **Exécute** :
   ```bash
   supabase functions deploy send-review-reminders --no-verify-jwt
   ```
3. **Vérifie** : Tu devrais voir "Deployed Function send-review-reminders"

### Tester Manuellement (Optionnel)

1. **Dans Supabase Dashboard** → Edge Functions
2. **Clique sur "send-review-reminders"**
3. **Clique "Invoke"**
4. **Vérifie les logs** :
   - ✅ Aucune erreur
   - ✅ Nombre de rappels envoyés

### Vérifier les Rappels

1. **Dans Supabase Dashboard** → Table Editor
2. **Ouvre la table `review_reminders`**
3. **Vérifie** :
   - ✅ Des entrées apparaissent pour les échanges confirmés
   - ✅ `reminder_type` = 'first' ou 'second'
   - ✅ `sent_at` est renseigné

### Vérifier les Emails (Si Resend configuré)

1. **Vérifie ta boîte email** (ou les logs Resend)
2. **Cherche** un email avec le template `review_reminder`
3. **Vérifie** :
   - ✅ Destinataire correct
   - ✅ Variables remplies (nom, titre de l'annonce)

---

## ✅ Étape 4 : Tester la Préparation Signature Électronique

### Prérequis
- Avoir une proposition acceptée récemment
- Ou accepter une nouvelle proposition

### Test : Accepter une Proposition

1. **Va dans "Mes propositions"**
2. **Ouvre une proposition "En attente"**
3. **Clique "Accepter"**
4. **Vérifie** :
   - ✅ Pas d'erreur dans la console
   - ✅ La proposition passe à "Acceptée"

### Vérifier la Création de `esign_requests`

1. **Dans Supabase Dashboard** → Table Editor
2. **Ouvre la table `esign_requests`**
3. **Vérifie** :
   - ✅ Une nouvelle entrée pour le contrat créé
   - ✅ `provider` = null (si `VITE_ESIGN_PROVIDER` n'est pas défini)
   - ✅ `status` = 'pending'
   - ✅ `metadata` contient les participants

### Vérifier les Colonnes sur `contracts`

1. **Ouvre la table `contracts`**
2. **Trouve le contrat créé**
3. **Vérifie** :
   - ✅ `signature_provider` = null (ou 'docusign'/'signrequest' si configuré)
   - ✅ `signature_status` = 'idle' ou 'pending'
   - ✅ `signature_reference` = null

### Configurer un Provider (Optionnel)

1. **Crée un fichier `.env.local`** (si pas déjà fait)
2. **Ajoute** :
   ```
   VITE_ESIGN_PROVIDER=docusign
   ```
   ou
   ```
   VITE_ESIGN_PROVIDER=signrequest
   ```
3. **Redémarre le serveur de dev**
4. **Accepte une nouvelle proposition**
5. **Vérifie** : `esign_requests.provider` est maintenant renseigné

---

## ✅ Étape 5 : Tester le Panneau Admin - Litiges

### Vérifier l'Onglet "Litiges"

1. **Connecte-toi en tant qu'admin**
2. **Va dans "Administration"**
3. **Clique sur l'onglet "Litiges"** (icône marteau)
4. **Vérifie** :
   - ✅ La liste des litiges s'affiche
   - ✅ Filtres par statut fonctionnent
   - ✅ Informations complètes affichées

### Tester les Actions Admin

1. **Trouve un litige "Ouvert"**
2. **Ajoute des notes** dans le textarea
3. **Teste chaque action** :
   - **"Prendre en charge"** → Statut → "En cours"
   - **"Résoudre"** → Statut → "Résolu" + Résolution affichée
   - **"Rejeter"** → Statut → "Rejeté"

### Vérifier les Statistiques

1. **Clique sur l'onglet "Statistiques"**
2. **Vérifie** :
   - ✅ Nombre total d'utilisateurs
   - ✅ Nombre total d'annonces
   - ✅ Nombre total de propositions
   - ✅ Nombre total d'échanges
   - ✅ Nombre de propositions acceptées
   - ✅ Nombre d'échanges confirmés
   - ✅ **Nouveau** : Nombre de litiges ouverts

---

## ✅ Étape 6 : Tests de Régression

### Vérifier que les Anciennes Fonctionnalités Marchent Toujours

1. **Créer une annonce** → ✅ Fonctionne
2. **Envoyer une proposition** → ✅ Fonctionne
3. **Accepter une proposition** → ✅ Fonctionne
4. **Générer un contrat** → ✅ Fonctionne
5. **Démarrer un échange** → ✅ Fonctionne
6. **Marquer comme livré** → ✅ Fonctionne
7. **Confirmer un échange** → ✅ Fonctionne
8. **Laisser un avis** → ✅ Fonctionne

---

## 🐛 Dépannage

### Erreur : "relation disputes already exists"
- ✅ **Solution** : La migration gère déjà ça, ignore l'erreur ou supprime la table manuellement si besoin

### Erreur : "policy already exists"
- ✅ **Solution** : La migration utilise `DROP POLICY IF EXISTS`, donc ça devrait être géré

### Les litiges n'apparaissent pas dans l'admin
- ✅ **Vérifie** : Tu es bien connecté en tant qu'admin ou modérateur
- ✅ **Vérifie** : Les politiques RLS sont bien créées

### Les rappels d'avis ne s'envoient pas
- ✅ **Vérifie** : L'Edge Function est bien déployée
- ✅ **Vérifie** : Le template email `review_reminder` existe dans `email_templates`
- ✅ **Vérifie** : Resend est configuré (ou les emails sont loggés)

### Les `esign_requests` ne se créent pas
- ✅ **Vérifie** : Pas d'erreur dans la console du navigateur
- ✅ **Vérifie** : Le contrat est bien créé après acceptation
- ✅ **Vérifie** : La fonction `enqueueEsignRequest` est appelée (console.log)

---

## 📝 Checklist Complète

- [ ] Migration SQL exécutée sans erreur
- [ ] Table `disputes` créée
- [ ] Table `review_reminders` créée
- [ ] Table `esign_requests` créée
- [ ] Colonnes `signature_*` ajoutées à `contracts`
- [ ] Politiques RLS créées
- [ ] Peux ouvrir un litige depuis un échange
- [ ] Le litige apparaît dans l'admin
- [ ] Peux résoudre un litige en tant qu'admin
- [ ] La résolution s'affiche pour l'utilisateur
- [ ] Edge Function `send-review-reminders` déployée
- [ ] Les rappels sont loggés dans `review_reminders`
- [ ] Les `esign_requests` sont créés lors de l'acceptation
- [ ] L'onglet "Litiges" fonctionne dans l'admin
- [ ] Les statistiques incluent les litiges

---

## 🎉 C'est Fait !

Si tous les tests passent, le Sprint 5 est **100% fonctionnel** ! 🚀

