/**
 * Acceptation d'une proposition d'échange (remplace generate-contract-pdf).
 *
 * Corps : { proposal_id }
 * - l'appelant doit être le destinataire de la proposition, et celle-ci doit être `pending` ;
 * - idempotent : si un contrat existe déjà pour cette proposition, il est renvoyé ;
 * - ordre des écritures : contrat → échange → proposition `accepted` (→ annonce archivée si produit),
 *   avec nettoyage si l'échange ne peut pas être créé ;
 * - e-mails `contract_ready` envoyés aux deux parties depuis le serveur.
 */
import { adminClient, getCaller } from '../_shared/auth.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { escapeHtml, sendTemplateEmail } from '../_shared/email.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MODE_LABEL: Record<string, string> = {
  remote: 'À distance',
  on_site: 'Sur place',
  both: 'À distance ou sur place, selon accord',
};

function fr(date: Date) {
  return date.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Méthode non autorisée' }, 405);

  const caller = await getCaller(req);
  if (!caller) return json(req, { error: 'Authentification requise' }, 401);

  let proposalId = '';
  try {
    const body = await req.json();
    proposalId = typeof body?.proposal_id === 'string' ? body.proposal_id : '';
  } catch {
    return json(req, { error: 'Corps JSON invalide' }, 400);
  }
  if (!UUID_RE.test(proposalId)) return json(req, { error: 'proposal_id invalide' }, 400);

  const supabase = adminClient();

  try {
    const { data: proposal, error: propError } = await supabase
      .from('proposals')
      .select(`
        *,
        listing:listings(*),
        from_user:users!proposals_from_user_id_fkey(id, display_name, email, city, status, role),
        to_user:users!proposals_to_user_id_fkey(id, display_name, email, city, status, role)
      `)
      .eq('id', proposalId)
      .maybeSingle();

    if (propError || !proposal) return json(req, { error: 'Proposition introuvable' }, 404);
    if (proposal.to_user_id !== caller.id) return json(req, { error: 'Seul le destinataire peut accepter' }, 403);
    if (proposal.from_user?.status === 'deleted' || proposal.from_user?.role === 'banned') {
      return json(req, { error: 'Le compte de votre interlocuteur n’est plus actif' }, 409);
    }
    if (proposal.to_user?.status === 'deleted' || proposal.to_user?.role === 'banned') {
      return json(req, { error: 'Votre compte n’est pas actif' }, 403);
    }

    // Idempotence : contrat déjà généré ?
    const { data: existing } = await supabase
      .from('contracts')
      .select('id, status')
      .eq('proposal_id', proposalId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return json(req, { success: true, contract_id: existing.id, already: true });

    if (proposal.status !== 'pending') return json(req, { error: 'Cette proposition n’est plus en attente' }, 409);
    if (!proposal.listing) return json(req, { error: 'Annonce introuvable' }, 404);
    if (proposal.listing.status !== 'published') {
      return json(req, { error: 'Cette annonce n’est plus disponible : elle a été retirée ou déjà échangée.' }, 409);
    }

    const templateType = proposal.listing.type === 'product' ? 'product' : 'service';
    // Le modèle spécifique prime ; 'general' n'est qu'un repli. Deux requêtes plutôt qu'un tri sur
    // l'enum, dont l'ordre de déclaration ('service', 'product', 'general') ne reflète pas la priorité.
    const pickTemplate = async (type: string) =>
      (
        await supabase
          .from('contract_templates')
          .select('*')
          .eq('is_active', true)
          .eq('type', type)
          .order('updated_at', { ascending: false })
          .limit(1)
      ).data?.[0] ?? null;
    const template = (await pickTemplate(templateType)) ?? (await pickTemplate('general'));
    if (!template) {
      console.error('Aucun modèle de contrat actif pour', templateType);
      return json(req, { error: 'Modèle de contrat indisponible, contactez le support' }, 500);
    }

    const contractId = crypto.randomUUID();
    const now = new Date();
    const offerDescription =
      (proposal.offer_payload && typeof proposal.offer_payload.description === 'string' && proposal.offer_payload.description.trim()) ||
      proposal.message ||
      'Voir les échanges entre les parties';
    const toConvene = 'À convenir entre les parties (messagerie BonTroc)';

    const variables: Record<string, string> = {
      partyA_name: proposal.from_user?.display_name ?? '',
      partyA_email: proposal.from_user?.email ?? '',
      partyA_city: proposal.from_user?.city || 'Non renseignée',
      partyB_name: proposal.to_user?.display_name ?? '',
      partyB_email: proposal.to_user?.email ?? '',
      partyB_city: proposal.to_user?.city || 'Non renseignée',
      contract_id: contractId,
      generation_date: fr(now),
      signature_date: 'Date de la signature électronique sur BonTroc',
      delivery_mode: MODE_LABEL[proposal.listing.mode] ?? proposal.listing.mode,
      estimation_value:
        proposal.estimation_min != null
          ? String(proposal.estimation_min)
          : proposal.listing.estimation_min != null
            ? String(proposal.listing.estimation_min)
            : 'Non précisée',
      cancellation_policy:
        'Chaque partie peut annuler l’échange tant qu’il n’a pas été marqué comme livré. Au-delà, un litige peut être ouvert sur la plateforme.',
      jurisdiction: 'France',
      serviceA_description: offerDescription,
      serviceB_description: proposal.listing.description_offer ?? '',
      delivery_deadline: toConvene,
      deliverables: 'Tels que décrits dans l’annonce et la proposition',
      ip_clause: 'Les droits de propriété intellectuelle restent acquis à leur auteur, sauf accord écrit contraire entre les parties.',
      productA_description: offerDescription,
      productA_condition: toConvene,
      productA_quantity: toConvene,
      productB_description: proposal.listing.description_offer ?? '',
      productB_condition: toConvene,
      productB_quantity: toConvene,
      delivery_location: toConvene,
      delivery_date: toConvene,
      shipping_terms: 'Chaque partie assume ses propres frais de transport, sauf accord contraire.',
    };

    const htmlContent = String(template.html_template).replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_m, key: string) =>
      escapeHtml(variables[key] ?? ''),
    );

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({ id: contractId, proposal_id: proposalId, version: 1, html_content: htmlContent, status: 'awaiting_signatures' })
      .select('id')
      .single();
    if (contractError || !contract) {
      // Double clic / relance : l'index unique (proposal_id, version) a déjà tranché, on renvoie l'existant.
      if (contractError?.code === '23505') {
        const { data: raced } = await supabase.from('contracts').select('id').eq('proposal_id', proposalId).limit(1).maybeSingle();
        if (raced) return json(req, { success: true, contract_id: raced.id, already: true });
      }
      console.error('contract insert failed:', contractError?.message);
      return json(req, { error: 'Création du contrat impossible' }, 500);
    }

    const { error: exchangeError } = await supabase
      .from('exchanges')
      .insert({ contract_id: contract.id, status: 'not_started' });
    if (exchangeError) {
      console.error('exchange insert failed:', exchangeError.message);
      await supabase.from('contracts').delete().eq('id', contract.id);
      return json(req, { error: 'Création de l’échange impossible' }, 500);
    }

    const { error: statusError } = await supabase
      .from('proposals')
      .update({ status: 'accepted', updated_at: now.toISOString() })
      .eq('id', proposalId)
      .eq('status', 'pending');
    if (statusError) console.error('proposal status update failed:', statusError.message);

    // Une contre-proposition acceptée clôt la proposition dont elle découle, sinon celle-ci reste
    // « ouverte » et bloque l'index unique (un seul échange ouvert par annonce et par membre).
    if (proposal.parent_proposal_id) {
      await supabase
        .from('proposals')
        .update({ status: 'cancelled', updated_at: now.toISOString() })
        .eq('id', proposal.parent_proposal_id)
        .in('status', ['pending', 'countered']);
    }

    // Un bien ne s'échange qu'une fois : l'annonce quitte le marché et les propositions
    // concurrentes sont annulées, sinon le propriétaire pourrait en accepter une seconde.
    if (proposal.listing.type === 'product') {
      await supabase.from('listings').update({ status: 'archived', updated_at: now.toISOString() }).eq('id', proposal.listing_id);
      await supabase
        .from('proposals')
        .update({ status: 'cancelled', updated_at: now.toISOString() })
        .eq('listing_id', proposal.listing_id)
        .neq('id', proposalId)
        .in('status', ['pending', 'countered']);
    }

    const listingTitle = proposal.listing.title ?? 'Votre échange';
    await Promise.all([
      sendTemplateEmail(supabase, {
        templateName: 'contract_ready',
        recipientUserId: proposal.from_user_id,
        variables: { listing_title: listingTitle, proposal_id: proposalId, counterpart_name: proposal.to_user?.display_name ?? '' },
        actorUserId: caller.id,
      }),
      sendTemplateEmail(supabase, {
        templateName: 'contract_ready',
        recipientUserId: proposal.to_user_id,
        variables: { listing_title: listingTitle, proposal_id: proposalId, counterpart_name: proposal.from_user?.display_name ?? '' },
        actorUserId: caller.id,
      }),
    ]);

    return json(req, { success: true, contract_id: contract.id, already: false });
  } catch (error) {
    console.error('accept-proposal error:', error);
    return json(req, { error: 'Acceptation impossible pour le moment' }, 500);
  }
});
