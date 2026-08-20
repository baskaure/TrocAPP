import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const functionsBaseUrl = `https://${projectRef}.functions.supabase.co`;

type Participant = {
  id: string;
  email: string;
  display_name: string;
};

async function alreadyReviewed(exchangeId: string, reviewerId: string) {
  const { data } = await supabase
    .from('reviews')
    .select('id')
    .eq('exchange_id', exchangeId)
    .eq('reviewer_id', reviewerId)
    .maybeSingle();

  return Boolean(data);
}

async function reminderExists(exchangeId: string, recipientId: string, reminderType: 'first' | 'second') {
  const { data } = await supabase
    .from('review_reminders')
    .select('id')
    .eq('exchange_id', exchangeId)
    .eq('recipient_id', recipientId)
    .eq('reminder_type', reminderType)
    .maybeSingle();

  return Boolean(data);
}

async function logReminder(exchangeId: string, recipientId: string, reminderType: 'first' | 'second') {
  await supabase.from('review_reminders').insert({
    exchange_id: exchangeId,
    recipient_id: recipientId,
    reminder_type: reminderType,
    sent_at: new Date().toISOString(),
  });
}

async function sendEmail(template: string, recipient: string, variables: Record<string, string>) {
  const response = await fetch(`${functionsBaseUrl}/send-email`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template_name: template,
      recipient,
      variables,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Failed to send reminder email', text);
    throw new Error(text);
  }
}

serve(async () => {
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
          from_user_id,
          to_user_id,
          listing:listings(title),
          from_user:users!proposals_from_user_id_fkey(id, email, display_name),
          to_user:users!proposals_to_user_id_fkey(id, email, display_name)
        )
      )
    `)
    .eq('status', 'confirmed')
    .not('confirmed_at', 'is', null)
    .lte('confirmed_at', twoDaysAgo);

  if (error || !exchanges) {
    return new Response(JSON.stringify({ error: error?.message ?? 'No exchanges to process' }), {
      headers: { 'Content-Type': 'application/json' },
      status: error ? 500 : 200,
    });
  }

  let remindersSent = 0;

  for (const exchange of exchanges) {
    if (!exchange.contract?.proposal) continue;
    const confirmedAt = new Date(exchange.confirmed_at);
    const daysSinceConfirmation = Math.floor((now.getTime() - confirmedAt.getTime()) / (1000 * 60 * 60 * 24));

    const participants: Participant[] = [
      exchange.contract.proposal.from_user,
      exchange.contract.proposal.to_user,
    ].filter(Boolean) as Participant[];

    for (const participant of participants) {
      if (!participant.email) continue;
      const hasReview = await alreadyReviewed(exchange.id, participant.id);
      if (hasReview) continue;

      const reminderType = daysSinceConfirmation >= 7 ? 'second' : 'first';
      const alreadySent = await reminderExists(exchange.id, participant.id, reminderType);
      if (alreadySent) continue;

      await sendEmail('review_reminder', participant.email, {
        recipient_name: participant.display_name,
        listing_title: exchange.contract.proposal.listing?.title ?? 'votre échange',
      });

      await logReminder(exchange.id, participant.id, reminderType);
      remindersSent += 1;
    }
  }

  return new Response(JSON.stringify({ remindersSent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

