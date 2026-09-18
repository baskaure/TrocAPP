-- 🧪 Créer un échange de test pour les rappels d'avis
-- Remplace les IDs par tes propres IDs

-- Étape 1 : Trouve un échange existant (ou crée-en un via l'UI)
-- Remplace <EXCHANGE_ID> par l'ID d'un échange réel

-- Étape 2 : Marque-le comme confirmé il y a 3 jours (pour tester le premier rappel)
UPDATE exchanges 
SET 
  status = 'confirmed',
  confirmed_at = NOW() - INTERVAL '3 days'
WHERE id = '<EXCHANGE_ID>';

-- Étape 3 : Vérifie qu'il n'y a pas d'avis pour cet échange
-- (sinon le rappel ne sera pas envoyé)
DELETE FROM reviews WHERE exchange_id = '<EXCHANGE_ID>';

-- Étape 4 : Vérifie qu'il n'y a pas de rappels déjà envoyés
-- (sinon le rappel ne sera pas envoyé à nouveau)
DELETE FROM review_reminders WHERE exchange_id = '<EXCHANGE_ID>';

-- Étape 5 : Vérifie que l'échange est maintenant éligible
SELECT 
  e.id,
  e.status,
  e.confirmed_at,
  DATE_PART('day', NOW() - e.confirmed_at) as days_since_confirmation,
  (SELECT COUNT(*) FROM reviews r WHERE r.exchange_id = e.id) as review_count,
  (SELECT COUNT(*) FROM review_reminders rr WHERE rr.exchange_id = e.id) as reminder_count
FROM exchanges e
WHERE e.id = '<EXCHANGE_ID>';

-- Si days_since_confirmation >= 2, review_count = 0, et reminder_count = 0
-- Alors l'échange est éligible et devrait recevoir un rappel !

