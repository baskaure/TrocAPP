-- 🧪 Script de Test pour les Rappels d'Avis
-- Utilise ce script pour préparer des données de test

-- 1. Voir les échanges éligibles (confirmés depuis plus de 2 jours, sans avis)
SELECT 
  e.id as exchange_id,
  e.status,
  e.confirmed_at,
  DATE_PART('day', NOW() - e.confirmed_at) as days_since_confirmation,
  p.from_user_id,
  p.to_user_id,
  u1.display_name as from_user_name,
  u1.email as from_user_email,
  u2.display_name as to_user_name,
  u2.email as to_user_email,
  l.title as listing_title
FROM exchanges e
JOIN contracts c ON c.id = e.contract_id
JOIN proposals p ON p.id = c.proposal_id
JOIN listings l ON l.id = p.listing_id
LEFT JOIN users u1 ON u1.id = p.from_user_id
LEFT JOIN users u2 ON u2.id = p.to_user_id
WHERE e.status = 'confirmed'
  AND e.confirmed_at IS NOT NULL
  AND e.confirmed_at <= NOW() - INTERVAL '2 days'
ORDER BY e.confirmed_at DESC;

-- 2. Vérifier les avis existants pour ces échanges
SELECT 
  r.exchange_id,
  r.reviewer_id,
  u.display_name as reviewer_name,
  r.rating,
  r.created_at
FROM reviews r
JOIN users u ON u.id = r.reviewer_id
WHERE r.exchange_id IN (
  SELECT e.id
  FROM exchanges e
  WHERE e.status = 'confirmed'
    AND e.confirmed_at IS NOT NULL
    AND e.confirmed_at <= NOW() - INTERVAL '2 days'
)
ORDER BY r.created_at DESC;

-- 3. Voir tous les rappels déjà envoyés
SELECT 
  rr.id,
  rr.exchange_id,
  rr.recipient_id,
  u.display_name as recipient_name,
  u.email as recipient_email,
  rr.reminder_type,
  rr.sent_at,
  e.confirmed_at,
  DATE_PART('day', rr.sent_at - e.confirmed_at) as days_after_confirmation
FROM review_reminders rr
JOIN exchanges e ON e.id = rr.exchange_id
JOIN users u ON u.id = rr.recipient_id
ORDER BY rr.sent_at DESC;

-- 4. Créer un échange de test (à adapter avec tes IDs)
-- Remplace <EXCHANGE_ID> par un ID d'échange réel
/*
UPDATE exchanges 
SET 
  status = 'confirmed',
  confirmed_at = NOW() - INTERVAL '3 days'  -- Simule un échange confirmé il y a 3 jours
WHERE id = '<EXCHANGE_ID>';

-- Vérifier qu'il n'y a pas d'avis pour cet échange
SELECT * FROM reviews WHERE exchange_id = '<EXCHANGE_ID>';
-- Doit être vide pour que le rappel soit envoyé
*/

-- 5. Vérifier les emails envoyés (logs)
SELECT 
  el.id,
  el.template_name,
  el.recipient,
  el.status,
  el.variables,
  el.created_at
FROM email_logs el
WHERE el.template_name = 'review_reminder'
ORDER BY el.created_at DESC
LIMIT 20;

-- 6. Statistiques des rappels
SELECT 
  reminder_type,
  COUNT(*) as count,
  MIN(sent_at) as first_sent,
  MAX(sent_at) as last_sent
FROM review_reminders
GROUP BY reminder_type;

-- 7. Vérifier le cron job (si configuré)
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database,
  username
FROM cron.job
WHERE jobname = 'send_review_reminders';

-- 8. Voir l'historique d'exécution du cron (si configuré)
SELECT 
  jrd.jobid,
  jrd.runid,
  jrd.job_pid,
  jrd.database,
  jrd.username,
  jrd.command,
  jrd.status,
  jrd.return_message,
  jrd.start_time,
  jrd.end_time,
  jrd.end_time - jrd.start_time as duration
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'send_review_reminders'
ORDER BY jrd.start_time DESC
LIMIT 10;

