-- 🔍 Déboguer les demandes de signature

-- 1. Voir TOUTES les demandes (peu importe le statut)
SELECT 
  id,
  contract_id,
  provider,
  status,
  envelope_id,
  created_at,
  updated_at
FROM esign_requests
ORDER BY created_at DESC;

-- 2. Voir les demandes avec statut 'pending'
SELECT 
  id,
  contract_id,
  provider,
  status
FROM esign_requests
WHERE status = 'pending';

-- 3. Voir les demandes avec provider 'signrequest'
SELECT 
  id,
  contract_id,
  provider,
  status
FROM esign_requests
WHERE provider = 'signrequest';

-- 4. Voir les demandes qui devraient être traitées (pending + docusign)
SELECT 
  id,
  contract_id,
  provider,
  status,
  created_at
FROM esign_requests
WHERE status = 'pending'
  AND provider = 'signrequest'
ORDER BY created_at DESC;

-- 5. Vérifier les contrats associés
SELECT 
  er.id as esign_request_id,
  er.status as esign_status,
  er.provider,
  c.id as contract_id,
  c.status as contract_status,
  c.signature_status
FROM esign_requests er
JOIN contracts c ON c.id = er.contract_id
ORDER BY er.created_at DESC;

