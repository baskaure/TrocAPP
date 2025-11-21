import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ContractRequest {
  proposal_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { proposal_id }: ContractRequest = await req.json();

    // Récupérer la proposition avec toutes les infos
    const { data: proposal, error: propError } = await supabase
      .from('proposals')
      .select(`
        *,
        listing:listings(*,user:users(*)),
        from_user:users!proposals_from_user_id_fkey(*),
        to_user:users!proposals_to_user_id_fkey(*)
      `)
      .eq('id', proposal_id)
      .maybeSingle();

    if (propError || !proposal) {
      throw new Error('Proposal not found');
    }

    // Déterminer le type de template
    const templateType = proposal.listing.type; // service ou product

    // Récupérer le template de contrat
    const { data: template, error: templateError } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('type', templateType)
      .eq('is_active', true)
      .maybeSingle();

    if (templateError || !template) {
      throw new Error(`Contract template not found for type: ${templateType}`);
    }

    // Préparer les variables du contrat
    const variables: Record<string, string> = {
      partyA_name: proposal.from_user.display_name,
      partyA_email: proposal.from_user.email,
      partyA_city: proposal.from_user.city || 'Non spécifié',
      partyB_name: proposal.to_user.display_name,
      partyB_email: proposal.to_user.email,
      partyB_city: proposal.to_user.city || 'Non spécifié',
      contract_id: proposal_id,
      generation_date: new Date().toLocaleDateString('fr-FR'),
      signature_date: new Date().toLocaleDateString('fr-FR'),
      delivery_mode: proposal.listing.mode,
      estimation_value: proposal.estimation_min?.toString() || proposal.listing.estimation_min?.toString() || '0',
      cancellation_policy: 'Chaque partie peut annuler jusqu\'à 7 jours avant l\'exécution avec préavis.',
      jurisdiction: 'France',
    };

    // Variables spécifiques selon le type
    if (templateType === 'service') {
      variables.serviceA_description = JSON.stringify(proposal.offer_payload);
      variables.serviceB_description = proposal.listing.description_offer;
      variables.delivery_deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR');
      variables.deliverables = 'Tel que décrit dans les annonces';
      variables.ip_clause = 'Les droits de propriété intellectuelle restent avec leur auteur sauf mention contraire.';
    } else {
      variables.productA_description = JSON.stringify(proposal.offer_payload);
      variables.productA_condition = 'Bon état';
      variables.productA_quantity = '1';
      variables.productB_description = proposal.listing.description_offer;
      variables.productB_condition = 'Bon état';
      variables.productB_quantity = '1';
      variables.delivery_location = proposal.to_user.city || 'À définir';
      variables.delivery_date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR');
      variables.shipping_terms = 'Chacun assume ses frais de transport';
    }

    // Remplacer les variables dans le template HTML
    let html_content = template.html_template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html_content = html_content.replace(regex, value);
    }

    // En MVP: pas de génération PDF réelle (nécessite Puppeteer)
    // On stocke juste le HTML
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        proposal_id,
        version: 1,
        html_content,
        status: 'awaiting_signatures',
      })
      .select()
      .single();

    if (contractError) {
      throw new Error('Failed to create contract: ' + contractError.message);
    }

    // Créer l'échange associé
    const { error: exchangeError } = await supabase
      .from('exchanges')
      .insert({
        contract_id: contract.id,
        status: 'not_started',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });

    if (exchangeError) {
      console.error('Failed to create exchange:', exchangeError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        contract_id: contract.id,
        html_preview: html_content.substring(0, 200) + '...',
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
