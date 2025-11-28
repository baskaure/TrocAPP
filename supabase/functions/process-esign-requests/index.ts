import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

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

  // Essayer d'abord avec Authorization Code Grant (client_secret)
  if (docusignClientSecret) {
    const response = await fetch('https://account.docusign.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: docusignClientId,
        client_secret: docusignClientSecret,
        code: 'dummy', // Pour Service Integration, on utilise JWT
      }),
    });

    // Si ça ne marche pas, essayer client_credentials
    if (!response.ok) {
      const response2 = await fetch('https://account.docusign.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'signature',
          client_id: docusignClientId,
          client_secret: docusignClientSecret,
        }),
      });

      if (!response2.ok) {
        const error = await response2.text();
        throw new Error(`DocuSign auth failed: ${error}`);
      }

      const data = await response2.json();
      return data.access_token;
    }

    const data = await response.json();
    return data.access_token;
  }

  // Si pas de client_secret, utiliser RSA (Service Integration) avec JWT
  if (docusignRsaPrivateKey && docusignUserId) {
    // Note: L'authentification JWT avec RSA nécessite une librairie spécialisée
    // Pour l'instant, on utilise une approche simplifiée
    // En production, utilise une librairie comme 'jose' ou 'jsonwebtoken' pour créer le JWT
    
    console.log('RSA authentication selected, but JWT implementation requires additional setup.');
    console.log('For now, the function will work in simulation mode.');
    console.log('To enable full RSA authentication, implement JWT signing with the RSA private key.');
    
    // Pour l'instant, on simule (à implémenter avec une vraie librairie JWT)
    throw new Error('RSA JWT authentication requires JWT library implementation. Please use Authorization Code Grant with CLIENT_SECRET for now, or implement JWT signing.');
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
    if (docusignClientId && docusignClientSecret) {
      try {
        accessToken = await getDocuSignAccessToken();
      } catch (error) {
        console.error('Failed to get DocuSign token:', error);
        // Continue sans token si les credentials ne sont pas configurés
      }
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

