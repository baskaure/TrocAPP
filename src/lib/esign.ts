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
  if (!provider) return null;

  const metadata = {
    participants,
    listingTitle,
    requested_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('esign_requests').insert({
    contract_id: contractId,
    provider,
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
      signature_provider: provider,
      signature_status: 'pending',
    })
    .eq('id', contractId);

  return provider;
}

