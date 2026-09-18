import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM = Deno.env.get('EMAIL_FROM') ?? 'BonTroc <noreply@bontroc.fr>';

/** Modèles que le navigateur a le droit de déclencher (les autres ne partent que du serveur). */
export const CLIENT_TEMPLATES = new Set(['welcome', 'new_proposal', 'counter_proposal', 'new_chat_message', 'new_review']);

/** Modèle → clé de préférence dans users.notification_settings (absent = toujours envoyé). */
const SETTING_FOR_TEMPLATE: Record<string, string> = {
  new_proposal: 'email_new_proposal',
  counter_proposal: 'email_new_proposal',
  contract_ready: 'email_accepted_proposal',
  new_chat_message: 'email_new_message',
  review_reminder: 'email_review_request',
  exchange_reminder: 'email_exchange_reminder',
};

/**
 * Fenêtre anti-rafale, en minutes, par (modèle, destinataire, contexte). Le contexte évite de
 * supprimer une notification légitime : deux conversations différentes, ou deux propositions de
 * membres différents, ne se font pas taire l'une l'autre.
 */
const DEDUPE_MINUTES: Record<string, number> = {
  new_chat_message: 15,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Remplace uniquement les {{clés}} présentes dans le modèle, sans construire de RegExp à
 * partir des données reçues. Les valeurs sont tronquées et échappées dans le HTML.
 */
export function render(template: string, variables: Record<string, string>, html: boolean): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_m, key: string) => {
    const raw = variables[key];
    if (raw === undefined || raw === null) return '';
    const value = String(raw).slice(0, 500);
    return html ? escapeHtml(value) : value;
  });
}

export type SendResult = { sent: boolean; skipped?: string; error?: string };

export async function sendTemplateEmail(
  supabase: SupabaseClient,
  params: {
    templateName: string;
    recipientUserId: string;
    variables: Record<string, string>;
    /** Utilisateur à l'origine de l'envoi (journalisé), s'il y en a un. */
    actorUserId?: string | null;
  },
): Promise<SendResult> {
  const { templateName, recipientUserId, actorUserId } = params;
  const variables = Object.fromEntries(
    Object.entries(params.variables ?? {})
      .filter(([k, v]) => /^[a-zA-Z0-9_]{1,40}$/.test(k) && (typeof v === 'string' || typeof v === 'number'))
      .map(([k, v]) => [k, String(v)]),
  );

  const { data: recipient } = await supabase
    .from('users')
    .select('id, email, display_name, status, role, notification_settings')
    .eq('id', recipientUserId)
    .maybeSingle();

  if (!recipient || !recipient.email || !EMAIL_RE.test(recipient.email)) return { sent: false, skipped: 'recipient_unknown' };
  if (recipient.status === 'deleted' || recipient.role === 'banned') return { sent: false, skipped: 'recipient_inactive' };

  const settingKey = SETTING_FOR_TEMPLATE[templateName];
  if (settingKey && recipient.notification_settings && recipient.notification_settings[settingKey] === false) {
    return { sent: false, skipped: 'opted_out' };
  }

  const dedupeMinutes = DEDUPE_MINUTES[templateName];
  const contextId = typeof variables.proposal_id === 'string' ? variables.proposal_id : typeof variables.exchange_id === 'string' ? variables.exchange_id : '';
  if (dedupeMinutes) {
    const since = new Date(Date.now() - dedupeMinutes * 60_000).toISOString();
    let query = supabase
      .from('email_logs')
      .select('id', { count: 'exact', head: true })
      .eq('template_name', templateName)
      .eq('recipient', recipient.email)
      .eq('status', 'sent')
      .gte('sent_at', since);
    // Le contexte est repris dans le sujet rendu (voir plus bas) : on s'en sert comme clé.
    if (contextId) query = query.ilike('subject', `%${contextId.slice(0, 8)}%`);
    const { count } = await query;
    if ((count ?? 0) > 0) return { sent: false, skipped: 'deduplicated' };
  }

  const { data: template } = await supabase
    .from('email_templates')
    .select('subject, html_body, text_body')
    .eq('name', templateName)
    .eq('is_active', true)
    .maybeSingle();
  if (!template) return { sent: false, error: `template_not_found:${templateName}` };

  const vars = { recipient_name: recipient.display_name ?? '', display_name: recipient.display_name ?? '', ...variables };
  let subject = render(template.subject, vars, false).replace(/[\r\n]+/g, ' ').slice(0, 180);
  if (dedupeMinutes && contextId) subject = `${subject} [${contextId.slice(0, 8)}]`;
  const html = render(template.html_body, vars, true);
  const text = render(template.text_body ?? '', vars, false);

  let status: 'sent' | 'failed' | 'pending' = 'pending';
  let errorMessage: string | null = null;

  if (!RESEND_API_KEY) {
    errorMessage = 'RESEND_API_KEY manquante';
    status = 'failed';
    console.warn('EMAIL non envoyé (pas de clé Resend):', { to: recipient.email, subject });
  } else {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [recipient.email], subject, html, text }),
      });
      if (res.ok) {
        status = 'sent';
      } else {
        status = 'failed';
        errorMessage = (await res.text()).slice(0, 500);
        console.error('Resend error:', errorMessage);
      }
    } catch (e) {
      status = 'failed';
      errorMessage = e instanceof Error ? e.message : String(e);
    }
  }

  const { error: logError } = await supabase.from('email_logs').insert({
    user_id: actorUserId ?? recipient.id,
    template_name: templateName,
    recipient: recipient.email,
    subject,
    status,
    error_message: errorMessage,
    sent_at: new Date().toISOString(),
  });
  if (logError) console.error('email_logs insert failed:', logError.message);

  return status === 'sent' ? { sent: true } : { sent: false, error: errorMessage ?? 'send_failed' };
}
