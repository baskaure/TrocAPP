/**
 * Rappels d'avis (cron quotidien). Appelable uniquement avec la clé service_role
 * (Authorization: Bearer <service_role>), comme configuré dans le job pg_cron.
 * Un échec d'envoi n'interrompt plus la tournée : chaque participant est traité isolément.
 */
import { adminClient, SERVICE_ROLE_KEY } from '../_shared/auth.ts';
import { sendTemplateEmail } from '../_shared/email.ts';

type Participant = { id: string; email: string; display_name: string };

Deno.serve(async (req: Request) => {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token !== SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const supabase = adminClient();
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const { data: exchanges, error } = await supabase
    .from('exchanges')
    .select(`
      id,
      confirmed_at,
      status,
      contract:contracts(
        proposal:proposals(
          id,
          listing:listings(title),
          from_user:users!proposals_from_user_id_fkey(id, email, display_name),
          to_user:users!proposals_to_user_id_fkey(id, email, display_name)
        )
      )
    `)
    .eq('status', 'confirmed')
    .not('confirmed_at', 'is', null)
    .lte('confirmed_at', twoDaysAgo)
    .gte('confirmed_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .limit(500);

  if (error || !exchanges) {
    return new Response(JSON.stringify({ error: error?.message ?? 'No exchanges to process' }), {
      headers: { 'Content-Type': 'application/json' },
      status: error ? 500 : 200,
    });
  }

  let remindersSent = 0;
  let failed = 0;
  let skipped = 0;

  for (const exchange of exchanges) {
    const contract = exchange.contract as { proposal?: { listing?: { title?: string } | null; from_user?: Participant | null; to_user?: Participant | null } } | null;
    const proposal = contract?.proposal;
    if (!proposal) continue;
    const confirmedAt = new Date(exchange.confirmed_at as string);
    const daysSinceConfirmation = Math.floor((now.getTime() - confirmedAt.getTime()) / 86_400_000);
    const reminderType: 'first' | 'second' = daysSinceConfirmation >= 7 ? 'second' : 'first';
    const participants = [proposal.from_user, proposal.to_user].filter(Boolean) as Participant[];

    for (const participant of participants) {
      try {
        const { count: reviewed } = await supabase
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .eq('exchange_id', exchange.id)
          .eq('reviewer_id', participant.id);
        if ((reviewed ?? 0) > 0) { skipped++; continue; }

        const { count: alreadySent } = await supabase
          .from('review_reminders')
          .select('id', { count: 'exact', head: true })
          .eq('exchange_id', exchange.id)
          .eq('recipient_id', participant.id)
          .eq('reminder_type', reminderType);
        if ((alreadySent ?? 0) > 0) { skipped++; continue; }

        const result = await sendTemplateEmail(supabase, {
          templateName: 'review_reminder',
          recipientUserId: participant.id,
          variables: { recipient_name: participant.display_name, listing_title: proposal.listing?.title ?? 'votre échange' },
          actorUserId: null,
        });

        // On journalise même un envoi ignoré (préférences) pour ne pas retenter chaque jour.
        if (result.sent || result.skipped) {
          await supabase.from('review_reminders').insert({
            exchange_id: exchange.id,
            recipient_id: participant.id,
            reminder_type: reminderType,
            sent_at: now.toISOString(),
          });
        }
        if (result.sent) remindersSent += 1;
        else if (result.error) failed += 1;
        else skipped += 1;
      } catch (e) {
        failed += 1;
        console.error('reminder failed for', participant.id, e);
      }
    }
  }

  return new Response(JSON.stringify({ remindersSent, failed, skipped }), { headers: { 'Content-Type': 'application/json' } });
});
