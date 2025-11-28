import { supabase } from './supabase';

type EsignProvider = 'docusign' | 'signrequest';

const provider = (import.meta.env.VITE_ESIGN_PROVIDER as EsignProvider | undefined) || null;

type Participant = {
  id?: string;
  email?: string;
  name?: string;
};

export const isEsignEnabled = () => Boolean(provider);

export async function enqueueEsignRequest({
  contractId,
  participants,
  listingTitle,
}: {
  contractId: string;
  participants: Participant[];
  listingTitle?: string;
}) {
  // Pour le test, créer une demande même si provider n'est pas défini
  const effectiveProvider = provider || 'docusign';
  
  if (!effectiveProvider) {
    console.warn('VITE_ESIGN_PROVIDER not set, skipping esign request');
    return null;
  }

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

