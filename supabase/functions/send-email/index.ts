/**
 * Envoi d'un e-mail transactionnel à la demande du navigateur.
 *
 * Corps attendu : { template_name, recipient_user_id, variables }
 * - l'appelant doit être connecté (JWT utilisateur), sauf pour `welcome` juste après l'inscription ;
 * - seuls quelques modèles sont autorisés depuis le client, et chacun exige que l'appelant
 *   soit lié au destinataire (proposition, conversation, échange) ;
 * - le destinataire est identifié par son id : son adresse n'est jamais transmise par le client ;
 * - préférences de notification, anti-rafale et limite de débit sont appliqués côté serveur.
 */
import { adminClient, getCaller } from '../_shared/auth.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { CLIENT_TEMPLATES, sendTemplateEmail } from '../_shared/email.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOURLY_LIMIT = 30;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Méthode non autorisée' }, 405);

  let body: { template_name?: unknown; recipient_user_id?: unknown; variables?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'Corps JSON invalide' }, 400);
  }

  const templateName = typeof body.template_name === 'string' ? body.template_name : '';
  const recipientUserId = typeof body.recipient_user_id === 'string' ? body.recipient_user_id : '';
  const variables = (body.variables && typeof body.variables === 'object' ? body.variables : {}) as Record<string, string>;

  if (!CLIENT_TEMPLATES.has(templateName)) return json(req, { error: 'Modèle non autorisé' }, 403);
  if (!UUID_RE.test(recipientUserId)) return json(req, { error: 'Destinataire invalide' }, 400);

  const supabase = adminClient();
  const caller = await getCaller(req);

  try {
    if (!caller) {
      // Cas unique sans session : e-mail de bienvenue d'un compte créé il y a moins de 10 minutes.
      if (templateName !== 'welcome') return json(req, { error: 'Authentification requise' }, 401);
      const { data: fresh } = await supabase
        .from('users')
        .select('id, created_at')
        .eq('id', recipientUserId)
        .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString())
        .maybeSingle();
      if (!fresh) return json(req, { error: 'Authentification requise' }, 401);
      // Seul un envoi réussi bloque un nouvel essai : un échec Resend ne doit pas priver
      // définitivement le membre de son e-mail de bienvenue.
      const { count } = await supabase
        .from('email_logs')
        .select('id', { count: 'exact', head: true })
        .eq('template_name', 'welcome')
        .eq('user_id', recipientUserId)
        .eq('status', 'sent');
      if ((count ?? 0) > 0) return json(req, { success: true, skipped: 'already_sent' });
      const result = await sendTemplateEmail(supabase, { templateName, recipientUserId, variables, actorUserId: recipientUserId });
      return json(req, { success: result.sent, ...result });
    }

    // Un compte banni ou supprimé garde un JWT valide jusqu'à son expiration : il ne doit pas
    // pouvoir continuer à déclencher des e-mails vers ses interlocuteurs.
    const { data: callerProfile } = await supabase.from('users').select('status, role').eq('id', caller.id).maybeSingle();
    if (!callerProfile || callerProfile.role === 'banned' || callerProfile.status === 'deleted') {
      return json(req, { error: 'Compte suspendu ou supprimé' }, 403);
    }

    // Limite de débit par appelant.
    const { count: recent } = await supabase
      .from('email_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', caller.id)
      .gte('sent_at', new Date(Date.now() - 60 * 60_000).toISOString());
    if ((recent ?? 0) >= HOURLY_LIMIT) return json(req, { error: 'Trop d’envois, réessayez plus tard' }, 429);

    // Lien entre l'appelant et le destinataire selon le modèle.
    const proposalId = typeof variables.proposal_id === 'string' ? variables.proposal_id : '';
    const exchangeId = typeof variables.exchange_id === 'string' ? variables.exchange_id : '';

    if (templateName === 'welcome') {
      if (recipientUserId !== caller.id) return json(req, { error: 'Non autorisé' }, 403);
    } else if (templateName === 'new_proposal' || templateName === 'counter_proposal' || templateName === 'new_chat_message') {
      if (!UUID_RE.test(proposalId)) return json(req, { error: 'proposal_id requis' }, 400);
      const { data: proposal } = await supabase
        .from('proposals')
        .select('from_user_id, to_user_id')
        .eq('id', proposalId)
        .maybeSingle();
      const parties = proposal ? [proposal.from_user_id, proposal.to_user_id] : [];
      if (!parties.includes(caller.id) || !parties.includes(recipientUserId) || caller.id === recipientUserId) {
        return json(req, { error: 'Non autorisé' }, 403);
      }
      if (templateName !== 'new_chat_message' && proposal!.from_user_id !== caller.id) {
        return json(req, { error: 'Non autorisé' }, 403);
      }
    } else if (templateName === 'new_review') {
      if (!UUID_RE.test(exchangeId)) return json(req, { error: 'exchange_id requis' }, 400);
      const { data: review } = await supabase
        .from('reviews')
        .select('id')
        .eq('exchange_id', exchangeId)
        .eq('reviewer_id', caller.id)
        .eq('reviewee_id', recipientUserId)
        .maybeSingle();
      if (!review) return json(req, { error: 'Non autorisé' }, 403);
    }

    const result = await sendTemplateEmail(supabase, { templateName, recipientUserId, variables, actorUserId: caller.id });
    return json(req, { success: result.sent, ...result }, result.error && !result.sent ? 502 : 200);
  } catch (error) {
    console.error('send-email error:', error);
    return json(req, { error: 'Envoi impossible' }, 500);
  }
});
