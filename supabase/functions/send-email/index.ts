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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { template_name, recipient, variables }: EmailRequest = await req.json();

    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('name', template_name)
      .eq('is_active', true)
      .maybeSingle();

    if (templateError || !template) {
      throw new Error(`Template not found: ${template_name}`);
    }

    let subject = template.subject;
    let html_body = template.html_body;
    let text_body = template.text_body || '';

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      html_body = html_body.replace(regex, value);
      text_body = text_body.replace(regex, value);
    }

    // Charger le logo pour l'inclure en inline
    let logoBase64: string | null = null;
    try {
      // Essayer depuis l'URL publique du site
      const logoUrl = 'https://bontroc.fr/logo/mail.png';
      const logoResponse = await fetch(logoUrl);
      if (logoResponse.ok) {
        const logoBuffer = await logoResponse.arrayBuffer();
        const bytes = new Uint8Array(logoBuffer);
        // Convertir en base64 (méthode compatible Deno)
        const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
        // @ts-ignore - btoa est disponible dans Deno
        logoBase64 = btoa(binary);
      }
    } catch (e) {
      console.log('Logo non disponible, utilisation de l\'URL externe');
    }

    let emailStatus = 'sent';
    let errorMessage = null;

    if (resendApiKey) {
      // Remplacer les URLs de logo par CID si le logo est disponible
      if (logoBase64) {
        html_body = html_body.replace(
          /<img[^>]+src=["']https:\/\/bontroc\.fr\/logo\/mail\.png["'][^>]*>/gi,
          '<img src="cid:logo" alt="BonTroc" style="height:40px; width:auto;" />'
        );
      }

      const emailPayload: any = {
        from: 'BonTroc <noreply@bontroc.fr>',
        to: recipient,
        subject,
        html: html_body,
        text: text_body,
      };

      // Ajouter le logo en attachment inline si disponible
      if (logoBase64) {
        emailPayload.attachments = [{
          filename: 'logo.png',
          content: logoBase64,
          content_id: 'logo',
          content_type: 'image/png',
        }];
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('Resend error:', err);
        emailStatus = 'failed';
        errorMessage = err;
      }
    } else {
      console.log('📧 EMAIL (no SMTP):', { to: recipient, subject });
    }

    await supabase.from('email_logs').insert({
      template_name,
      recipient,
      subject,
      status: emailStatus,
      error_message: errorMessage,
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ success: emailStatus === 'sent', email: { subject, recipient } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});