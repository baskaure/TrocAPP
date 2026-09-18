-- 🔍 Vérifier pourquoi remindersSent = 0

-- 1. Voir TOUS les échanges confirmés (peu importe la date)
SELECT 
  e.id,
  e.status,
  e.confirmed_at,
  CASE 
    WHEN e.confirmed_at IS NULL THEN 'Pas de date de confirmation'
    WHEN e.confirmed_at > NOW() - INTERVAL '2 days' THEN 'Confirmé il y a moins de 2 jours'
    WHEN e.confirmed_at <= NOW() - INTERVAL '2 days' AND e.confirmed_at > NOW() - INTERVAL '7 days' THEN 'Confirmé il y a 2-7 jours (premier rappel)'
    WHEN e.confirmed_at <= NOW() - INTERVAL '7 days' THEN 'Confirmé il y a plus de 7 jours (deuxième rappel)'
  END as eligibility_status,
  c.proposal_id,
  p.from_user_id,
  p.to_user_id
FROM exchanges e
JOIN contracts c ON c.id = e.contract_id
JOIN proposals p ON p.id = c.proposal_id
WHERE e.status = 'confirmed'
ORDER BY e.confirmed_at DESC NULLS LAST;

-- 2. Vérifier les avis existants pour les échanges confirmés
SELECT 
  e.id as exchange_id,
  e.confirmed_at,
  r.reviewer_id,
  u.display_name as reviewer_name,
  r.rating,
  r.created_at
FROM exchanges e
JOIN contracts c ON c.id = e.contract_id
JOIN proposals p ON p.id = c.proposal_id
LEFT JOIN reviews r ON r.exchange_id = e.id
LEFT JOIN users u ON u.id = r.reviewer_id
WHERE e.status = 'confirmed'
  AND e.confirmed_at IS NOT NULL
ORDER BY e.confirmed_at DESC;

-- 3. Vérifier les rappels déjà envoyés
SELECT 
  rr.exchange_id,
  rr.recipient_id,
  u.display_name as recipient_name,
  rr.reminder_type,
  rr.sent_at,
  e.confirmed_at
FROM review_reminders rr
JOIN exchanges e ON e.id = rr.exchange_id
JOIN users u ON u.id = rr.recipient_id
ORDER BY rr.sent_at DESC;

-- 4. Voir les participants qui devraient recevoir un rappel
-- (échanges confirmés depuis > 2 jours, sans avis, sans rappel déjà envoyé)
SELECT 
  e.id as exchange_id,
  e.confirmed_at,
  DATE_PART('day', NOW() - e.confirmed_at) as days_since_confirmation,
  p.from_user_id,
  p.to_user_id,
  u1.display_name as from_user_name,
  u1.email as from_user_email,
  u2.display_name as to_user_name,
  u2.email as to_user_email,
  -- Vérifier si from_user a déjà laissé un avis
  (SELECT COUNT(*) FROM reviews r1 WHERE r1.exchange_id = e.id AND r1.reviewer_id = p.from_user_id) as from_user_has_review,
  -- Vérifier si to_user a déjà laissé un avis
  (SELECT COUNT(*) FROM reviews r2 WHERE r2.exchange_id = e.id AND r2.reviewer_id = p.to_user_id) as to_user_has_review,
  -- Vérifier si from_user a déjà reçu un rappel
  (SELECT COUNT(*) FROM review_reminders rr1 WHERE rr1.exchange_id = e.id AND rr1.recipient_id = p.from_user_id) as from_user_has_reminder,
  -- Vérifier si to_user a déjà reçu un rappel
  (SELECT COUNT(*) FROM review_reminders rr2 WHERE rr2.exchange_id = e.id AND rr2.recipient_id = p.to_user_id) as to_user_has_reminder
FROM exchanges e
JOIN contracts c ON c.id = e.contract_id
JOIN proposals p ON p.id = c.proposal_id
LEFT JOIN users u1 ON u1.id = p.from_user_id
LEFT JOIN users u2 ON u2.id = p.to_user_id
WHERE e.status = 'confirmed'
  AND e.confirmed_at IS NOT NULL
  AND e.confirmed_at <= NOW() - INTERVAL '2 days'
ORDER BY e.confirmed_at DESC;

