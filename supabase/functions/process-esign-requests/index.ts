import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const signrequestApiKey = Deno.env.get('SIGNREQUEST_API_KEY');
const signrequestApiRoot = Deno.env.get('SIGNREQUEST_API_ROOT') || 'https://www.signrequest.com/api/v1';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Créer un document SignRequest
async function createSignRequestDocument(
  contractHtml: string,
  participants: Array<{ email: string; name: string }>,
  contractTitle: string
): Promise<string> {
  if (!signrequestApiKey) {
    throw new Error('SIGNREQUEST_API_KEY not configured');
  }

  // Convertir HTML en base64
  const base64Content = btoa(unescape(encodeURIComponent(contractHtml)));

  // Créer le document SignRequest
  const response = await fetch(`${signrequestApiRoot}/documents/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${signrequestApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: contractTitle,
      file_from_content: base64Content,
      file_from_content_name: `${contractTitle}.html`,
      signers: participants.map((p, index) => ({
        email: p.email,
        display_name: p.name,
        order: index + 1,
      })),
      auto_delete_days: 30,
      auto_delete_after: 'signing',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SignRequest document creation failed: ${error}`);
  }

  const data = await response.json();
  return data.uuid; // SignRequest document UUID
}

serve(async (req: Request) => {
  console.log('process-esign-requests function called');

  try {
    // Récupérer les demandes de signature en attente
    console.log('Fetching pending esign requests...');

    const { data: pendingRequestsBase, error: fetchError } = await supabase
      .from('esign_requests')
      .select('*')
      .eq('status', 'pending')
      .eq('provider', 'signrequest')
      .limit(10);

    if (fetchError) {
      console.error('Error fetching pending requests:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingRequestsBase?.length || 0} pending requests`);

    if (!pendingRequestsBase || pendingRequestsBase.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending requests', processed: 0, failed: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Enrichir les demandes avec les données du contrat
    const pendingRequests = await Promise.all(
      pendingRequestsBase.map(async (req) => {
        const { data: contract, error: contractError } = await supabase
          .from('contracts')
          .select(`
            html_content,
            proposal:proposals(
              *,
              listing:listings(title),
              from_user:users!proposals_from_user_id_fkey(email, display_name),
              to_user:users!proposals_to_user_id_fkey(email, display_name)
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

    let processed = 0;
    let failed = 0;

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
            name: proposal.from_user?.display_name || '',
          },
          {
            email: proposal.to_user?.email || '',
            name: proposal.to_user?.display_name || '',
          },
        ].filter(p => p.email && p.name);

        if (participants.length < 2) {
          throw new Error('Not enough participants with valid email/name');
        }

        // Si SignRequest n'est pas configuré, simuler
        if (!signrequestApiKey) {
          console.log('SignRequest not configured, simulating success for request', request.id);
          await supabase
            .from('esign_requests')
            .update({
              status: 'sent',
              envelope_id: `simulated_document_${request.id}`,
              metadata: { ...request.metadata, simulated: true, note: 'SignRequest API key not configured' },
            })
            .eq('id', request.id);

          await supabase
            .from('contracts')
            .update({ signature_status: 'sent' })
            .eq('id', request.contract_id);

          processed++;
          continue;
        }

        // Créer le document SignRequest
        const documentUuid = await createSignRequestDocument(
          contract.html_content || '',
          participants,
          proposal.listing?.title || 'Contrat d\'échange'
        );

        // Mettre à jour la demande
        await supabase
          .from('esign_requests')
          .update({
            status: 'sent',
            envelope_id: documentUuid,
            metadata: { ...request.metadata, document_uuid: documentUuid },
          })
          .eq('id', request.id);

        // Mettre à jour le contrat
        await supabase
          .from('contracts')
          .update({
            signature_status: 'sent',
            signature_reference: documentUuid,
          })
          .eq('id', request.contract_id);

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
        total: pendingRequestsBase.length,
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
