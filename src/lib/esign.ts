import { supabase } from './supabase';

type EsignProvider = 'signrequest';

const provider = (import.meta.env.VITE_ESIGN_PROVIDER as EsignProvider | undefined) || null;

type Participant = {
  id?: string;
  email?: string;
  name?: string;
};

// Signature électronique désactivée temporairement
// SignRequest ne permet plus de créer de nouveaux tokens API
// Pour réactiver : configurer HelloSign ou une autre solution
export const isEsignEnabled = () => false; // Boolean(provider);

export async function enqueueEsignRequest({
  contractId,
  participants,
  listingTitle,
}: {
  contractId: string;
  participants: Participant[];
  listingTitle?: string;
}) {
  if (!isEsignEnabled()) {
    console.log('Signature électronique désactivée - contrat généré sans signature automatique');
    return null;
  }
  
  if (!provider) {
    console.warn('VITE_ESIGN_PROVIDER not set, skipping esign request');
    return null;
  }
  
  const effectiveProvider = provider;

  const metadata = {
    participants,
    listingTitle,
    requested_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('esign_requests').insert({
    contract_id: contractId,
    provider: effectiveProvider,
    status: 'pending',
    metadata,
  });

  if (error) {
    console.error('Erreur lors de la préparation de la signature électronique', error);
    throw error;
  }

  await supabase
    .from('contracts')
    .update({
      signature_provider: effectiveProvider,
      signature_status: 'pending',
    })
    .eq('id', contractId);

  console.log('Esign request created:', { contractId, provider: effectiveProvider });
  return effectiveProvider;
}

