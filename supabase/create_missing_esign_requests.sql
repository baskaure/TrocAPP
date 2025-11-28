-- 🔍 Vérifier les contrats sans demande de signature

-- 1. Voir les contrats actifs sans demande
SELECT 
  c.id as contract_id,
  c.proposal_id,
  c.status as contract_status,
  p.from_user_id,
  p.to_user_id,
  l.title as listing_title,
  er.id as esign_request_id
FROM contracts c
JOIN proposals p ON p.id = c.proposal_id
JOIN listings l ON l.id = p.listing_id
LEFT JOIN esign_requests er ON er.contract_id = c.id
WHERE c.status = 'active'
  AND er.id IS NULL
ORDER BY c.created_at DESC;

-- 2. Créer les demandes manquantes
INSERT INTO esign_requests (contract_id, provider, status, metadata)
SELECT 
  c.id,
  'docusign',
  'pending',
  jsonb_build_object(
    'participants', jsonb_build_array(
      jsonb_build_object(
        'id', p.from_user_id, 
        'email', u1.email, 
        'name', u1.display_name
      ),
      jsonb_build_object(
        'id', p.to_user_id, 
        'email', u2.email, 
        'name', u2.display_name
      )
    ),
    'listing_title', l.title,
    'requested_at', now()
  )
FROM contracts c
JOIN proposals p ON p.id = c.proposal_id
JOIN listings l ON l.id = p.listing_id
JOIN users u1 ON u1.id = p.from_user_id
JOIN users u2 ON u2.id = p.to_user_id
LEFT JOIN esign_requests er ON er.contract_id = c.id
WHERE c.status = 'active'
  AND er.id IS NULL;

-- 3. Mettre à jour les contrats
UPDATE contracts c
SET 
  signature_provider = 'docusign',
  signature_status = 'pending'
WHERE c.status = 'active'
  AND (c.signature_provider IS NULL OR c.signature_status IS NULL)
  AND EXISTS (
    SELECT 1 FROM esign_requests er 
    WHERE er.contract_id = c.id 
    AND er.status = 'pending'
  );

-- 4. Vérifier le résultat
SELECT 
  er.id,
  er.contract_id,
  er.provider,
  er.status,
  er.created_at
FROM esign_requests er
ORDER BY er.created_at DESC
LIMIT 10;

