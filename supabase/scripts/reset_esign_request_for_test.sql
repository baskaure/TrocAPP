-- 🔄 Remettre une demande à 'pending' pour tester

-- Remettre la demande à pending
UPDATE esign_requests 
SET 
  status = 'pending',
  envelope_id = NULL,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{test_reset}',
    'true'
  )
WHERE id = 'f1a2870c-082c-4153-9252-64e429533d84';

-- Vérifier
SELECT id, status, provider, contract_id 
FROM esign_requests 
WHERE id = 'f1a2870c-082c-4153-9252-64e429533d84';

