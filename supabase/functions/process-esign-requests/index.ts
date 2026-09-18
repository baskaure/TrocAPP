/**
 * Traitement des demandes de signature électronique (SignRequest).
 * Fonctionnalité désactivée côté produit (SignRequest ne délivre plus de clés API) :
 * la fonction reste déployable mais n'est accessible qu'au staff, avec CORS.
 */
import { adminClient, getCaller } from '../_shared/auth.ts';
import { corsHeaders, json } from '../_shared/cors.ts';

const signrequestApiKey = Deno.env.get('SIGNREQUEST_API_KEY');
const signrequestApiRoot = Deno.env.get('SIGNREQUEST_API_ROOT') || 'https://www.signrequest.com/api/v1';

async function createSignRequestDocument(
  contractHtml: string,
  participants: Array<{ email: string; name: string }>,
  contractTitle: string,
): Promise<string> {
  if (!signrequestApiKey) throw new Error('SIGNREQUEST_API_KEY not configured');
  const base64Content = btoa(unescape(encodeURIComponent(contractHtml)));
  const response = await fetch(`${signrequestApiRoot}/documents/`, {
    method: 'POST',
    headers: { Authorization: `Token ${signrequestApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: contractTitle,
      file_from_content: base64Content,
      file_from_content_name: `${contractTitle}.html`,
      signers: participants.map((p, index) => ({ email: p.email, display_name: p.name, order: index + 1 })),
      auto_delete_days: 30,
      auto_delete_after: 'signing',
    }),
  });
  if (!response.ok) throw new Error(`SignRequest document creation failed: ${await response.text()}`);
  const data = await response.json();
  return data.uuid;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Méthode non autorisée' }, 405);

  const caller = await getCaller(req);
  if (!caller) return json(req, { error: 'Authentification requise' }, 401);

  const supabase = adminClient();
  const { data: profile } = await supabase.from('users').select('role').eq('id', caller.id).maybeSingle();
  if (!profile || !['admin', 'moderator'].includes(profile.role)) return json(req, { error: 'Réservé au staff' }, 403);

  try {
    const { data: pendingRequestsBase, error: fetchError } = await supabase
      .from('esign_requests')
      .select('*')
      .eq('status', 'pending')
      .eq('provider', 'signrequest')
      .limit(10);
    if (fetchError) throw fetchError;
    if (!pendingRequestsBase || pendingRequestsBase.length === 0) {
      return json(req, { message: 'No pending requests', processed: 0, failed: 0 });
    }

    let processed = 0;
    let failed = 0;

    for (const request of pendingRequestsBase) {
      try {
        const { data: contract } = await supabase
          .from('contracts')
          .select(`
            html_content,
            proposal:proposals(
              listing:listings(title),
              from_user:users!proposals_from_user_id_fkey(email, display_name),
              to_user:users!proposals_to_user_id_fkey(email, display_name)
            )
          `)
          .eq('id', request.contract_id)
          .maybeSingle();

        if (!contract || !contract.proposal) throw new Error('Contract or proposal not found');
        const proposal = contract.proposal as {
          listing?: { title?: string } | null;
          from_user?: { email?: string; display_name?: string } | null;
          to_user?: { email?: string; display_name?: string } | null;
        };
        const participants = [
          { email: proposal.from_user?.email || '', name: proposal.from_user?.display_name || '' },
          { email: proposal.to_user?.email || '', name: proposal.to_user?.display_name || '' },
        ].filter((p) => p.email && p.name);
        if (participants.length < 2) throw new Error('Not enough participants with valid email/name');

        if (!signrequestApiKey) {
          await supabase
            .from('esign_requests')
            .update({ status: 'failed', metadata: { ...request.metadata, error: 'SIGNREQUEST_API_KEY not configured' } })
            .eq('id', request.id);
          failed++;
          continue;
        }

        const documentUuid = await createSignRequestDocument(
          contract.html_content || '',
          participants,
          proposal.listing?.title || "Contrat d'échange",
        );
        await supabase
          .from('esign_requests')
          .update({ status: 'sent', envelope_id: documentUuid, metadata: { ...request.metadata, document_uuid: documentUuid } })
          .eq('id', request.id);
        await supabase
          .from('contracts')
          .update({ signature_status: 'sent', signature_reference: documentUuid })
          .eq('id', request.contract_id);
        processed++;
      } catch (error) {
        console.error('Error processing request', request.id, error);
        await supabase
          .from('esign_requests')
          .update({ status: 'failed', metadata: { ...request.metadata, error: error instanceof Error ? error.message : String(error) } })
          .eq('id', request.id);
        failed++;
      }
    }

    return json(req, { message: 'Processed esign requests', processed, failed, total: pendingRequestsBase.length });
  } catch (error) {
    console.error('process-esign-requests error:', error);
    return json(req, { error: 'Traitement impossible' }, 500);
  }
});
