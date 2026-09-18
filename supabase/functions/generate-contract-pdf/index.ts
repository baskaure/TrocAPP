/**
 * Ancienne fonction (non authentifiée) remplacée par `accept-proposal`.
 * Conservée uniquement pour répondre 410 Gone jusqu'à sa suppression :
 *   supabase functions delete generate-contract-pdf
 */
import { corsHeaders, json } from '../_shared/cors.ts';

Deno.serve((req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  return json(req, { error: 'Cette fonction est retirée. Utilisez accept-proposal.' }, 410);
});
