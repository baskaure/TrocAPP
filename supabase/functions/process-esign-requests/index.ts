import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const docusignClientId = Deno.env.get('DOCUSIGN_CLIENT_ID');
const docusignClientSecret = Deno.env.get('DOCUSIGN_CLIENT_SECRET'); // Pour Authorization Code Grant
const docusignRsaPrivateKey = Deno.env.get('DOCUSIGN_RSA_PRIVATE_KEY'); // Pour Service Integration (RSA)
const docusignUserId = Deno.env.get('DOCUSIGN_USER_ID'); // Email du compte DocuSign
const docusignAccountId = Deno.env.get('DOCUSIGN_ACCOUNT_ID');
const docusignBaseUrl = Deno.env.get('DOCUSIGN_BASE_URL') || 'https://demo.docusign.net'; // demo ou production

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Obtenir un access token DocuSign
async function getDocuSignAccessToken(): Promise<string> {
  if (!docusignClientId) {
    throw new Error('DOCUSIGN_CLIENT_ID not configured');
  }

  // Utiliser Client Credentials Grant avec CLIENT_SECRET (plus simple pour Edge Functions)
  if (docusignClientSecret) {
    console.log('Using Client Credentials Grant with CLIENT_SECRET');
    
    const isDemo = docusignBaseUrl.includes('demo');
    const tokenUrl = isDemo 
      ? 'https://account-d.docusign.com/oauth/token'
      : 'https://account.docusign.com/oauth/token';
    
    console.log('Requesting access token from:', tokenUrl);
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'signature impersonation',
        client_id: docusignClientId,
        client_secret: docusignClientSecret,
      }),
    });

    const responseText = await response.text();
    console.log('DocuSign response status:', response.status);
    console.log('DocuSign response body:', responseText);

    if (!response.ok) {
      throw new Error(`DocuSign auth failed: ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Invalid response format: ${responseText}`);
    }

    if (!data.access_token) {
      throw new Error(`No access_token in response: ${JSON.stringify(data)}`);
    }

    console.log('Access token obtained successfully');
    return data.access_token;
  }

  // Si pas de client_secret, utiliser RSA (Service Integration) avec JWT
  if (docusignRsaPrivateKey && docusignUserId) {
    try {
      console.log('Using RSA JWT authentication');
      console.log('RSA key length:', docusignRsaPrivateKey.length);
      console.log('User ID:', docusignUserId);
      
      // Préparer la clé privée RSA (format PEM)
      const privateKeyPem = docusignRsaPrivateKey.replace(/\\n/g, '\n');
      
      // Importer la clé privée RSA avec Web Crypto API
      // DocuSign fournit des clés au format PKCS#1 (BEGIN RSA PRIVATE KEY)
      // Web Crypto API nécessite PKCS#8, donc on doit convertir
      console.log('Converting PKCS#1 to PKCS#8...');
      
      // Extraire la clé DER PKCS#1
      const keyBase64 = privateKeyPem
        .replace(/-----BEGIN RSA PRIVATE KEY-----/g, '')
        .replace(/-----END RSA PRIVATE KEY-----/g, '')
        .replace(/\s/g, '');
      const pkcs1Der = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
      
      // Construire PKCS#8 manuellement (structure simple)
      // PKCS#8 = SEQUENCE { version(0), algorithmIdentifier, privateKey OCTET STRING }
      // OID rsaEncryption: 1.2.840.113549.1.1.1 = 06 09 2A 86 48 86 F7 0D 01 01 01
      const rsaOid = new Uint8Array([0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x01]);
      const nullParams = new Uint8Array([0x05, 0x00]);
      
      // AlgorithmIdentifier SEQUENCE
      // La longueur doit inclure la longueur de rsaOid + nullParams (pas +2)
      const algIdContentLen = rsaOid.length + nullParams.length;
      const algIdLenBytes = algIdContentLen < 128 ? [algIdContentLen] : algIdContentLen < 256 ? [0x81, algIdContentLen] : [0x82, (algIdContentLen >> 8) & 0xFF, algIdContentLen & 0xFF];
      const algorithmId = new Uint8Array([
        0x30, // SEQUENCE
        ...algIdLenBytes,
        ...rsaOid,
        ...nullParams,
      ]);
      
      // Version INTEGER(0)
      const version = new Uint8Array([0x02, 0x01, 0x00]);
      
      // PrivateKey OCTET STRING (contient PKCS#1)
      const keyLen = pkcs1Der.length;
      const keyLenBytes = keyLen < 128 ? [keyLen] : keyLen < 256 ? [0x81, keyLen] : [0x82, (keyLen >> 8) & 0xFF, keyLen & 0xFF];
      const privateKeyOctet = new Uint8Array([
        0x04, // OCTET STRING
        ...keyLenBytes,
        ...pkcs1Der,
      ]);
      
      // Séquence PKCS#8 complète
      const seqContentLen = version.length + algorithmId.length + privateKeyOctet.length;
      const seqLenBytes = seqContentLen < 128 ? [seqContentLen] : seqContentLen < 256 ? [0x81, seqContentLen] : [0x82, (seqContentLen >> 8) & 0xFF, seqContentLen & 0xFF];
      const pkcs8Der = new Uint8Array([
        0x30, // SEQUENCE
        ...seqLenBytes,
        ...version,
        ...algorithmId,
        ...privateKeyOctet,
      ]);
      
      console.log('Importing RSA key with Web Crypto API...');
      // Importer avec Web Crypto API
      const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        pkcs8Der,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256',
        },
        false,
        ['sign']
      );
      
      console.log('RSA private key imported successfully');

      // Créer le JWT avec djwt
      // Pour Service Integration (RSA), l'audience dépend de l'environnement
      const isDemo = docusignBaseUrl.includes('demo');
      const aud = isDemo ? 'account-d.docusign.com' : 'account.docusign.com';
      
      const now = getNumericDate(new Date());
      // Pour Service Integration, essayons sans le scope dans le JWT
      // Le scope sera passé dans la requête POST
      const payload = {
        iss: docusignClientId, // Integration Key
        sub: docusignUserId, // User ID (email)
        iat: now,
        exp: now + 3600, // 1 heure de validité
        aud: aud, // Audience différente pour demo vs production
        // Scope retiré du JWT - sera dans la requête POST
      };
      
      console.log('JWT payload:', { iss: docusignClientId, sub: docusignUserId, aud, scope: 'signature impersonation (in POST request)' });

      // Signer le JWT
      const jwt = await create(
        { alg: 'RS256', typ: 'JWT' },
        payload,
        privateKey
      );
      
      console.log('JWT created successfully');
      // Log les premières parties du JWT pour déboguer (sans la signature complète)
      const jwtParts = jwt.split('.');
      if (jwtParts.length === 3) {
        console.log('JWT header:', JSON.parse(atob(jwtParts[0])));
        console.log('JWT payload:', JSON.parse(atob(jwtParts[1])));
        console.log('JWT signature length:', jwtParts[2].length);
      }

      // Échanger le JWT contre un access token
      // L'URL dépend de l'environnement (demo vs production)
      const tokenUrl = isDemo 
        ? 'https://account-d.docusign.com/oauth/token'
        : 'https://account.docusign.com/oauth/token';
      
      console.log('Requesting access token from:', tokenUrl);
      
      // Préparer le body de la requête
      // Pour Service Integration, passons le scope dans la requête POST plutôt que dans le JWT
      const requestBody = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
        scope: 'signature impersonation', // Scope dans la requête POST
      });
      
      console.log('Request body params:', {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion_length: jwt.length,
        assertion_preview: jwt.substring(0, 50) + '...',
      });
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: requestBody,
      });

      const responseText = await response.text();
      console.log('DocuSign response status:', response.status);
      console.log('DocuSign response body:', responseText);

      if (!response.ok) {
        console.error('DocuSign JWT auth failed:', responseText);
        
        // Vérifier si c'est une erreur de consentement
        let errorMessage = `DocuSign JWT auth failed: ${responseText}`;
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.error === 'invalid_request' || errorData.error === 'consent_required') {
            errorMessage += '\n\n⚠️ IMPORTANT: L\'utilisateur doit d\'abord accorder son consentement à l\'application DocuSign.\n';
            errorMessage += 'URL de consentement: https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=' + docusignClientId + '&redirect_uri=' + encodeURIComponent('https://trophub.netlify.app');
          }
        } catch (e) {
          // Ignore si on ne peut pas parser l'erreur
        }
        
        throw new Error(errorMessage);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', responseText);
        throw new Error(`Invalid response format: ${responseText}`);
      }
      
      if (!data.access_token) {
        console.error('No access_token in response:', data);
        throw new Error(`No access_token in response: ${JSON.stringify(data)}`);
      }
      
      console.log('Access token obtained successfully');
      return data.access_token;
    } catch (error) {
      console.error('RSA JWT authentication error:', error);
      throw new Error(`RSA authentication failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error('DocuSign credentials not configured. Need either CLIENT_SECRET or RSA_PRIVATE_KEY');
}

// Créer un envelope DocuSign
async function createDocuSignEnvelope(
  accessToken: string,
  contractHtml: string,
  participants: Array<{ email: string; name: string; role?: string }>,
  contractTitle: string
): Promise<string> {
  const accountId = docusignAccountId;
  if (!accountId) {
    throw new Error('DOCUSIGN_ACCOUNT_ID not configured');
  }

  // Convertir HTML en PDF (simplifié - en production, utiliser une librairie PDF)
  // Pour l'instant, on envoie le HTML directement (DocuSign peut le convertir)
  
  const base64Content = btoa(unescape(encodeURIComponent(contractHtml)));

  const envelopeDefinition = {
    emailSubject: `Contrat à signer: ${contractTitle}`,
    documents: [
      {
        documentBase64: base64Content,
        name: `Contrat_${contractTitle}.html`,
        fileExtension: 'html',
        documentId: '1',
      },
    ],
    recipients: {
      signers: participants.map((p, index) => ({
        email: p.email,
        name: p.name,
        recipientId: String(index + 1),
        routingOrder: String(index + 1),
        tabs: {
          signHereTabs: [
            {
              documentId: '1',
              pageNumber: '1',
              recipientId: String(index + 1),
              xPosition: '100',
              yPosition: String(700 + index * 50),
            },
          ],
        },
      })),
    },
    status: 'sent',
  };

  const response = await fetch(
    `${docusignBaseUrl}/restapi/v2.1/accounts/${accountId}/envelopes`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelopeDefinition),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DocuSign envelope creation failed: ${error}`);
  }

  const data = await response.json();
  return data.envelopeId;
}

serve(async (req: Request) => {
  console.log('process-esign-requests function called');
  console.log('DocuSign config check:', {
    hasClientId: !!docusignClientId,
    hasClientSecret: !!docusignClientSecret,
    hasRsaKey: !!docusignRsaPrivateKey,
    hasUserId: !!docusignUserId,
    hasAccountId: !!docusignAccountId,
  });
  
  try {
    // Récupérer les demandes de signature en attente
    console.log('Fetching pending esign requests...');
    
    // D'abord, voir TOUTES les demandes pour déboguer
    const { data: allRequests } = await supabase
      .from('esign_requests')
      .select('id, status, provider, contract_id')
      .limit(20);
    console.log('All esign_requests in DB:', JSON.stringify(allRequests, null, 2));
    
    // Récupérer les demandes de base avec filtres
    const { data: pendingRequestsBase, error: fetchError } = await supabase
      .from('esign_requests')
      .select('*')
      .eq('status', 'pending')
      .eq('provider', 'docusign')
      .limit(10);

    if (fetchError) {
      console.error('Error fetching pending requests:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingRequestsBase?.length || 0} pending requests`);
    if (pendingRequestsBase && pendingRequestsBase.length > 0) {
      console.log('Pending requests details:', JSON.stringify(pendingRequestsBase.map(r => ({ id: r.id, status: r.status, provider: r.provider })), null, 2));
    }

    if (!pendingRequestsBase || pendingRequestsBase.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending requests', processed: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Enrichir avec les données des contrats et propositions
    const pendingRequests = await Promise.all(
      pendingRequestsBase.map(async (req) => {
        const { data: contract } = await supabase
          .from('contracts')
          .select(`
            *,
            proposal:proposals(
              *,
              from_user:users!proposals_from_user_id_fkey(email, display_name),
              to_user:users!proposals_to_user_id_fkey(email, display_name),
              listing:listings(title)
            )
          `)
          .eq('id', req.contract_id)
          .maybeSingle();

        return {
          ...req,
          contract: contract || null,
        };
      })
    );

    // pendingRequests est maintenant enrichi ci-dessus

    let processed = 0;
    let failed = 0;

    // Obtenir le token DocuSign une seule fois
    let accessToken: string | null = null;
    const hasClientSecret = docusignClientId && docusignClientSecret;
    const hasRsaKey = docusignClientId && docusignRsaPrivateKey && docusignUserId;
    
    if (hasClientSecret || hasRsaKey) {
      try {
        console.log('Attempting to get DocuSign access token...');
        accessToken = await getDocuSignAccessToken();
        console.log('Access token obtained successfully');
      } catch (error) {
        console.error('Failed to get DocuSign token:', error);
        console.log('Will continue in simulation mode');
        // Continue sans token si les credentials ne sont pas configurés ou invalides
      }
    } else {
      console.log('DocuSign credentials not configured (need CLIENT_SECRET or RSA_PRIVATE_KEY)');
    }

    for (const request of pendingRequests) {
      try {
        const contract = request.contract;
        if (!contract || !contract.proposal) {
          console.error('Contract or proposal not found for request', request.id);
          await supabase
            .from('esign_requests')
            .update({ status: 'failed', metadata: { error: 'Contract or proposal not found' } })
            .eq('id', request.id);
          failed++;
          continue;
        }

        const proposal = contract.proposal;
        const participants = [
          {
            email: proposal.from_user?.email || '',
            name: proposal.from_user?.display_name || 'Participant 1',
            role: 'signer1',
          },
          {
            email: proposal.to_user?.email || '',
            name: proposal.to_user?.display_name || 'Participant 2',
            role: 'signer2',
          },
        ].filter((p) => p.email);

        if (participants.length < 2) {
          console.error('Not enough participants for request', request.id);
          await supabase
            .from('esign_requests')
            .update({ status: 'failed', metadata: { error: 'Not enough participants' } })
            .eq('id', request.id);
          failed++;
          continue;
        }

        // Si DocuSign n'est pas configuré, on simule juste la mise à jour
        if (!accessToken) {
          console.log('DocuSign not configured, simulating success for request', request.id);
          await supabase
            .from('esign_requests')
            .update({
              status: 'sent',
              metadata: { ...request.metadata, simulated: true, note: 'DocuSign credentials not configured' },
            })
            .eq('id', request.id);

          await supabase
            .from('contracts')
            .update({ signature_status: 'sent' })
            .eq('id', contract.id);

          processed++;
          continue;
        }

        // Créer l'enveloppe DocuSign
        const envelopeId = await createDocuSignEnvelope(
          accessToken,
          contract.html_content || '',
          participants,
          proposal.listing?.title || 'Contrat d\'échange'
        );

        // Mettre à jour la demande
        await supabase
          .from('esign_requests')
          .update({
            status: 'sent',
            envelope_id: envelopeId,
            metadata: { ...request.metadata, envelope_id: envelopeId },
          })
          .eq('id', request.id);

        // Mettre à jour le contrat
        await supabase
          .from('contracts')
          .update({
            signature_status: 'sent',
            signature_reference: envelopeId,
          })
          .eq('id', contract.id);

        processed++;
      } catch (error) {
        console.error('Error processing request', request.id, error);
        await supabase
          .from('esign_requests')
          .update({
            status: 'failed',
            metadata: {
              ...request.metadata,
              error: error instanceof Error ? error.message : String(error),
            },
          })
          .eq('id', request.id);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Processed esign requests',
        processed,
        failed,
        total: pendingRequests.length,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in process-esign-requests:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

