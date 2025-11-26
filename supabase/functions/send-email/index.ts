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

    let emailStatus = 'sent';
    let errorMessage = null;

    if (resendApiKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'TrocHub <onboarding@resend.dev>',
          to: recipient,
          subject,
          html: html_body,
          text: text_body,
        }),
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