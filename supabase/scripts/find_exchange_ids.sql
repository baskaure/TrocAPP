-- 🔍 Trouver les IDs des échanges

-- Option 1 : Voir tous les échanges avec leurs détails
SELECT 
  e.id as exchange_id,
  e.status,
  e.confirmed_at,
  e.created_at,
  c.proposal_id,
  p.from_user_id,
  p.to_user_id,
  u1.display_name as from_user_name,
  u2.display_name as to_user_name,
  l.title as listing_title
FROM exchanges e
JOIN contracts c ON c.id = e.contract_id
JOIN proposals p ON p.id = c.proposal_id
JOIN listings l ON l.id = p.listing_id
LEFT JOIN users u1 ON u1.id = p.from_user_id
LEFT JOIN users u2 ON u2.id = p.to_user_id
ORDER BY e.created_at DESC;

-- Option 2 : Voir seulement les IDs (plus simple)
SELECT id, status, created_at 
FROM exchanges 
ORDER BY created_at DESC;

-- Option 3 : Voir les échanges confirmés (pour tester les rappels)
SELECT 
  id,
  status,
  confirmed_at,
  DATE_PART('day', NOW() - confirmed_at) as days_since_confirmation
FROM exchanges 
WHERE status = 'confirmed'
ORDER BY confirmed_at DESC;

