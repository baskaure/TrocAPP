# 🧪 Guide de Test - Rappels d'Avis Automatiques

## Méthode 1 : Tester depuis Supabase Dashboard (Recommandé)

### Étape 1 : Accéder à la fonction
1. **Ouvre Supabase Dashboard** → https://supabase.com/dashboard
2. **Sélectionne ton projet**
3. **Va dans "Edge Functions"** (menu de gauche)
4. **Clique sur `send-review-reminders`**

### Étape 2 : Invoker la fonction
1. **Clique sur l'onglet "Invoke"** ou "Test"
2. **Laisse le body vide** (la fonction n'a pas besoin de paramètres)
3. **Clique sur "Invoke"** ou "Run"

### Étape 3 : Vérifier les résultats
1. **Regarde la réponse** :
   ```json
   {
     "remindersSent": 2
   }
   ```
   - `remindersSent` = nombre de rappels envoyés

2. **Vérifie les logs** :
   - Clique sur l'onglet **"Logs"** dans la même page
   - Tu devrais voir les logs d'exécution
   - Cherche les erreurs éventuelles

---

## Méthode 2 : Tester via curl (Terminal)

### Windows PowerShell
```powershell
# Remplace <PROJECT_REF> par ton project ref (ex: cuxypeejwglisqidxwfj)
# Remplace <SERVICE_ROLE_KEY> par ta clé service role (Settings → API → service_role key)

$headers = @{
    "Authorization" = "Bearer <SERVICE_ROLE_KEY>"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "https://<PROJECT_REF>.functions.supabase.co/send-review-reminders" -Method POST -Headers $headers -Body "{}"
```

### Linux/Mac
```bash
# Remplace <PROJECT_REF> et <SERVICE_ROLE_KEY>
curl -X POST \
  "https://<PROJECT_REF>.functions.supabase.co/send-review-reminders" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d "{}"
```

---

## Méthode 3 : Vérifier dans la base de données

### Étape 1 : Vérifier les échanges éligibles
```sql
-- Voir les échanges confirmés depuis plus de 2 jours sans avis
SELECT 
  e.id,
  e.confirmed_at,
  e.status,
  c.proposal_id,
  p.from_user_id,
  p.to_user_id
FROM exchanges e
JOIN contracts c ON c.id = e.contract_id
JOIN proposals p ON p.id = c.proposal_id
WHERE e.status = 'confirmed'
  AND e.confirmed_at IS NOT NULL
  AND e.confirmed_at <= NOW() - INTERVAL '2 days'
ORDER BY e.confirmed_at DESC;
```

### Étape 2 : Vérifier les rappels envoyés
```sql
-- Voir tous les rappels envoyés
SELECT 
  rr.*,
  e.confirmed_at,
  u.display_name as recipient_name,
  u.email as recipient_email
FROM review_reminders rr
JOIN exchanges e ON e.id = rr.exchange_id
JOIN users u ON u.id = rr.recipient_id
ORDER BY rr.sent_at DESC;
```

### Étape 3 : Vérifier les avis existants
```sql
-- Voir quels utilisateurs ont déjà laissé un avis pour un échange
SELECT 
  r.exchange_id,
  r.reviewer_id,
  u.display_name,
  r.rating,
  r.created_at
FROM reviews r
JOIN users u ON u.id = r.reviewer_id
ORDER BY r.created_at DESC;
```

---

## Méthode 4 : Créer un échange de test

### Pour tester rapidement, crée un échange de test :

1. **Accepte une proposition** (cela crée un contrat et un échange)

2. **Marque l'échange comme confirmé** :
   ```sql
   -- Remplace <EXCHANGE_ID> par l'ID de ton échange
   UPDATE exchanges 
   SET 
     status = 'confirmed',
     confirmed_at = NOW() - INTERVAL '3 days'  -- Simule un échange confirmé il y a 3 jours
   WHERE id = '<EXCHANGE_ID>';
   ```

3. **Vérifie qu'il n'y a pas d'avis** :
   ```sql
   -- Remplace <EXCHANGE_ID>
   SELECT * FROM reviews WHERE exchange_id = '<EXCHANGE_ID>';
   -- Doit être vide
   ```

4. **Invoque la fonction** (Méthode 1 ou 2)

5. **Vérifie les résultats** :
   - Dans `review_reminders` : une nouvelle entrée doit apparaître
   - Dans les logs email : un email `review_reminder` doit être loggé

---

## Vérifier les logs d'emails

### Dans Supabase Dashboard
1. **Va dans "Table Editor"** → `email_logs`
2. **Filtre par** :
   - `template_name` = `review_reminder`
   - `created_at` = aujourd'hui
3. **Vérifie** :
   - ✅ `status` = `sent` ou `pending`
   - ✅ `recipient` = email de l'utilisateur
   - ✅ `variables` contient `recipient_name` et `listing_title`

---

## Dépannage

### Problème : "remindersSent: 0"
**Causes possibles :**
- Aucun échange confirmé depuis plus de 2 jours
- Tous les participants ont déjà laissé un avis
- Tous les rappels ont déjà été envoyés

**Solution :**
- Crée un échange de test (Méthode 4)
- Vérifie les échanges éligibles (Méthode 3, Étape 1)

### Problème : Erreur dans les logs
**Vérifie :**
- ✅ La fonction `send-email` est bien déployée
- ✅ Le template `review_reminder` existe dans `email_templates`
- ✅ Les variables d'environnement sont configurées

### Problème : Pas d'email reçu
**Vérifie :**
- ✅ Resend est configuré (ou utilise le même email pour test)
- ✅ Les emails sont loggés dans `email_logs`
- ✅ Le template contient les bonnes variables

---

## Test complet recommandé

1. **Crée 2 comptes utilisateurs** (User A et User B)
2. **User A crée une annonce**
3. **User B propose un échange**
4. **User A accepte** → échange créé
5. **Marque l'échange comme confirmé** (via SQL ou UI)
6. **Modifie `confirmed_at`** pour simuler un échange de 3 jours :
   ```sql
   UPDATE exchanges 
   SET confirmed_at = NOW() - INTERVAL '3 days'
   WHERE id = '<EXCHANGE_ID>';
   ```
7. **Invoque la fonction** `send-review-reminders`
8. **Vérifie** :
   - ✅ 2 rappels créés dans `review_reminders` (un pour chaque participant)
   - ✅ 2 emails loggés dans `email_logs`
   - ✅ Les participants reçoivent l'email (si Resend configuré)

---

## Automatisation (pg_cron)

Si tu as configuré `pg_cron`, la fonction s'exécute automatiquement tous les jours à 7h.

**Vérifier que le cron job est actif :**
```sql
SELECT * FROM cron.job WHERE jobname = 'send_review_reminders';
```

**Voir l'historique d'exécution :**
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'send_review_reminders')
ORDER BY start_time DESC
LIMIT 10;
```

