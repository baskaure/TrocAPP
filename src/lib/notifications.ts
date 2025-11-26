import { supabase } from './supabase';

type EmailVariables = Record<string, string | number | undefined | null>;

const sanitizeVariables = (variables: EmailVariables) => {
  return Object.entries(variables).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    acc[key] = String(value);
    return acc;
  }, {});
};

export async function sendTransactionalEmail(
  templateName: string,
  recipient: string | undefined,
  variables: EmailVariables = {}
) {
  if (!recipient) return;

  try {
    await supabase.functions.invoke('send-email', {
      body: {
        template_name: templateName,
        recipient,
        variables: sanitizeVariables(variables),
      },
    });
  } catch (error) {
    console.error(`Erreur lors de l'envoi de l'email ${templateName}`, error);
  }
}

