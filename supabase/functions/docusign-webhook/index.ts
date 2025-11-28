import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const webhookSecret = Deno.env.get('DOCUSIGN_WEBHOOK_SECRET'); // Pour valider les webhooks

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

serve(async (req: Request) => {
  try {
    // DocuSign envoie les webhooks en POST
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const body = await req.json();

    // DocuSign envoie les événements dans un format spécifique
    // Format: { event: 'envelope-completed', data: { envelopeId: '...', status: 'completed' } }
    const envelopeId = body.data?.envelopeId || body.envelopeId;
    const status = body.data?.status || body.status;
    const event = body.event || body.type;

    if (!envelopeId) {
      console.error('No envelopeId in webhook payload');
      return new Response(JSON.stringify({ error: 'Missing envelopeId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Trouver la demande de signature correspondante
    const { data: esignRequest, error: fetchError } = await supabase
      .from('esign_requests')
      .select('*, contract:contracts(id)')
      .eq('envelope_id', envelopeId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching esign request:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!esignRequest) {
      console.warn('No esign request found for envelope', envelopeId);
      return new Response(JSON.stringify({ message: 'No matching request found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Mettre à jour le statut selon l'événement
    let newStatus = esignRequest.status;
    let contractStatus = 'sent';

    if (event === 'envelope-completed' || status === 'completed') {
      newStatus = 'completed';
      contractStatus = 'completed';
    } else if (event === 'envelope-declined' || status === 'declined') {
      newStatus = 'failed';
      contractStatus = 'failed';
    } else if (event === 'envelope-voided' || status === 'voided') {
      newStatus = 'failed';
      contractStatus = 'failed';
    }

    // Mettre à jour la demande de signature
    await supabase
      .from('esign_requests')
      .update({
        status: newStatus,
        metadata: {
          ...esignRequest.metadata,
          last_webhook_event: event,
          last_webhook_status: status,
          webhook_received_at: new Date().toISOString(),
        },
      })
      .eq('id', esignRequest.id);

    // Mettre à jour le contrat si nécessaire
    if (esignRequest.contract) {
      await supabase
        .from('contracts')
        .update({
          signature_status: contractStatus,
        })
        .eq('id', esignRequest.contract.id);
    }

    // Si la signature est complète, marquer le contrat comme signé
    if (newStatus === 'completed' && esignRequest.contract) {
      // Optionnel: mettre à jour les dates d'acceptation du contrat
      // Cela dépend de ta logique métier
    }

    return new Response(
      JSON.stringify({
        message: 'Webhook processed',
        envelopeId,
        status: newStatus,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
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

