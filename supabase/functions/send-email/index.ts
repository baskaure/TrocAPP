import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailRequest {
  template_name: string;
  recipient: string;
  variables: Record<string, string>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { template_name, recipient, variables }: EmailRequest = await req.json();

    // Récupérer le template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('name', template_name)
      .eq('is_active', true)
      .maybeSingle();

    if (templateError || !template) {
      throw new Error(`Template not found: ${template_name}`);
    }

    // Remplacer les variables dans le sujet et le body
    let subject = template.subject;
    let html_body = template.html_body;
    let text_body = template.text_body || '';

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      html_body = html_body.replace(regex, value);
      text_body = text_body.replace(regex, value);
    }

    // En MVP, on log juste l'email (pas d'envoi réel)
    // Plus tard: intégrer Resend/Sendgrid/Postmark
    console.log('📧 EMAIL TO SEND:', {
      to: recipient,
      subject,
      html_preview: html_body.substring(0, 100) + '...',
    });

    // Enregistrer dans email_logs
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        template_name,
        recipient,
        subject,
        status: 'sent', // En MVP on marque comme envoyé même si juste loggé
        sent_at: new Date().toISOString(),
      });

    if (logError) {
      console.error('Failed to log email:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email logged successfully (MVP mode)',
        email: { subject, recipient },
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
