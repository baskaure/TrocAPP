import { useState, useEffect } from 'react';
import { Shield, Users, Flag, AlertTriangle, Loader2, Trash2, CheckCircle, XCircle, Eye, BarChart3, Download, Gavel } from 'lucide-react';
import { supabase, User, EsignRequest, Dispute } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { PageBackRowSpacer } from '../layout/PageBackLink';

type Tab = 'reports' | 'users' | 'verification' | 'banned-words' | 'disputes' | 'stats';

type Report = {
  id: string;
  reporter_id: string;
  reported_user_id?: string;
  listing_id?: string;
  reason: string;
  details?: string;
  status: string;
  created_at: string;
  reporter?: { display_name: string };
  reported_user?: { display_name: string };
  listing?: { id: string; title: string; status: string };
};

type VerificationRequest = User & {
  verification_document_url?: string;
  verification_status?: string;
};

type DisputeProposalInfo = {
  id: string;
  listing_id: string;
  from_user_id: string;
  to_user_id: string;
  listing?: { title: string } | null;
  from_user?: { display_name: string } | null;
  to_user?: { display_name: string } | null;
};

type EnrichedDispute = Dispute & {
  opened_by_user: { display_name: string; email: string } | null;
  resolved_by_user: { display_name: string } | null;
  exchange: {
    id: string;
    status: string;
    contract?: { proposal: DisputeProposalInfo };
  } | null;
};

type AdminListingDetail = {
  id: string;
  title: string;
  type: string;
  status: string;
  description_offer?: string;
  description_need?: string;
  user?: { display_name: string; email: string } | null;
  media?: { url: string }[];
};

export function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('reports');
  const [loading, setLoading] = useState(false);
  
  // Reports
  const [reports, setReports] = useState<Report[]>([]);
  
  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');
  
  // Verification
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  
  // Banned words
  const [bannedWords, setBannedWords] = useState<{ id: string; word: string; severity: string }[]>([]);
  const [_bannedWordsLoading, setBannedWordsLoading] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newSeverity, setNewSeverity] = useState<'warning' | 'block'>('warning');

  // Disputes
  const [disputes, setDisputes] = useState<EnrichedDispute[]>([]);
  const [disputeNotes, setDisputeNotes] = useState<Record<string, string>>({});
  
  // Viewing
  const [viewingListingId, setViewingListingId] = useState<string | null>(null);
  const [viewingListing, setViewingListing] = useState<AdminListingDetail | null>(null);

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalListings: 0,
    totalProposals: 0,
    totalExchanges: 0,
    acceptedProposals: 0,
    confirmedExchanges: 0,
  });
  const [esignRequests, setEsignRequests] = useState<EsignRequest[]>([]);

  useEffect(() => {
    if (tab === 'reports') loadReports();
    if (tab === 'users') loadUsers();
    if (tab === 'verification') loadVerificationRequests();
    if (tab === 'banned-words') loadBannedWords();
    if (tab === 'disputes') loadDisputes();
    if (tab === 'stats') loadStats();
  }, [tab]);

  useEffect(() => {
    if (viewingListingId) {
      loadListingDetail(viewingListingId);
    } else {
      setViewingListing(null);
    }
  }, [viewingListingId]);

  async function loadListingDetail(id: string) {
    const { data } = await supabase
      .from('listings')
      .select(`*, user:users(display_name, email), media:listing_media(url)`)
      .eq('id', id)
      .single();
    setViewingListing(data);
  }

  async function loadStats() {
    setLoading(true);
    const [usersRes, listingsRes, proposalsRes, exchangesRes, acceptedRes, confirmedRes, esignRes] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('listings').select('*', { count: 'exact', head: true }),
      supabase.from('proposals').select('*', { count: 'exact', head: true }),
      supabase.from('exchanges').select('*', { count: 'exact', head: true }),
      supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('status', 'accepted'),
      supabase.from('exchanges').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
      supabase.from('esign_requests').select('*').order('created_at', { ascending: false }).limit(10),
    ]);
    setStats({
      totalUsers: usersRes.count || 0,
      totalListings: listingsRes.count || 0,
      totalProposals: proposalsRes.count || 0,
      totalExchanges: exchangesRes.count || 0,
      acceptedProposals: acceptedRes.count || 0,
      confirmedExchanges: confirmedRes.count || 0,
    });
    setEsignRequests(esignRes.data || []);
    setLoading(false);
  }

  async function exportCSV(table: string) {
    const { data } = await supabase.from(table).select('*');
    if (!data || data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${table}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  async function loadReports() {
    setLoading(true);
    const { data } = await supabase
      .from('reports')
      .select(`
        *,
        reporter:users!reports_reporter_id_fkey(display_name),
        reported_user:users!reports_reported_user_id_fkey(display_name),
        listing:listings(id, title, status)
      `)
      .order('created_at', { ascending: false });
    if (data) setReports(data);
    setLoading(false);
  }

  async function loadDisputes() {
    setLoading(true);
    try {
      // D'abord, récupérer les litiges de base
      const { data: disputesData, error: disputesError } = await supabase
        .from('disputes')
        .select('*')
        .order('created_at', { ascending: false });

      if (disputesError) {
        console.error('Erreur lors du chargement des litiges', disputesError);
        alert('Erreur: ' + disputesError.message);
        setLoading(false);
        return;
      }

      if (!disputesData || disputesData.length === 0) {
        setDisputes([]);
        setLoading(false);
        return;
      }

      // Enrichir avec les données des utilisateurs et échanges
      const enrichedDisputes = await Promise.all(
        disputesData.map(async (dispute) => {
          // Récupérer l'utilisateur qui a ouvert le litige
          const { data: openedByUser } = await supabase
            .from('users')
            .select('display_name, email')
            .eq('id', dispute.opened_by)
            .maybeSingle();

          // Récupérer l'utilisateur qui a résolu (si applicable)
          let resolvedByUser = null;
          if (dispute.resolved_by) {
            const { data: resolvedUser } = await supabase
              .from('users')
              .select('display_name')
              .eq('id', dispute.resolved_by)
              .maybeSingle();
            resolvedByUser = resolvedUser;
          }

          // Récupérer l'échange et ses détails
          let exchangeData: EnrichedDispute['exchange'] = null;
          const { data: exchange, error: exchangeError } = await supabase
            .from('exchanges')
            .select('id, status, contract_id')
            .eq('id', dispute.exchange_id)
            .maybeSingle();

          if (exchangeError) {
            console.warn('Erreur lors de la récupération de l\'échange', exchangeError);
          } else if (exchange) {
            exchangeData = { id: exchange.id, status: exchange.status };

            // Récupérer le contrat
            if (exchange.contract_id) {
              const { data: contract } = await supabase
                .from('contracts')
                .select('proposal_id')
                .eq('id', exchange.contract_id)
                .maybeSingle();

              if (contract?.proposal_id) {
                // Récupérer la proposition
                const { data: proposal } = await supabase
                  .from('proposals')
                  .select(`
                    id,
                    listing_id,
                    from_user_id,
                    to_user_id,
                    listing:listings(title),
                    from_user:users!proposals_from_user_id_fkey(display_name),
                    to_user:users!proposals_to_user_id_fkey(display_name)
                  `)
                  .eq('id', contract.proposal_id)
                  .maybeSingle();

                if (proposal) {
                  const listing = Array.isArray(proposal.listing) ? proposal.listing[0] : proposal.listing;
                  const fromUser = Array.isArray(proposal.from_user) ? proposal.from_user[0] : proposal.from_user;
                  const toUser = Array.isArray(proposal.to_user) ? proposal.to_user[0] : proposal.to_user;
                  exchangeData.contract = {
                    proposal: {
                      id: proposal.id,
                      listing_id: proposal.listing_id,
                      from_user_id: proposal.from_user_id,
                      to_user_id: proposal.to_user_id,
                      listing: listing ?? null,
                      from_user: fromUser ?? null,
                      to_user: toUser ?? null,
                    },
                  };
                }
              }
            }
          }

          return {
            ...dispute,
            opened_by_user: openedByUser,
            resolved_by_user: resolvedByUser,
            exchange: exchangeData,
          };
        })
      );

      setDisputes(enrichedDisputes);
      setDisputeNotes((prev) => {
        const next = { ...prev };
        enrichedDisputes.forEach((dispute) => {
          if (dispute.resolution_notes && !next[dispute.id]) {
            next[dispute.id] = dispute.resolution_notes;
          }
        });
        return next;
      });
    } catch (err) {
      console.error('Exception lors du chargement des litiges', err);
      alert('Erreur: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  async function deleteListing(listingId: string, reportId: string) {
    if (!confirm('Supprimer cette annonce définitivement ?')) return;
    const { error } = await supabase.from('listings').delete().eq('id', listingId).select();
    if (error) {
      console.error('Erreur lors de la suppression de l\'annonce:', error);
    }
    if (!error && reportId) {
      await handleReportStatus(reportId, 'resolved');
    }
    loadReports();
  }

  async function suspendListing(listingId: string) {
    const { error } = await supabase.from('listings').update({ status: 'suspended' }).eq('id', listingId).select();
    if (error) {
      console.error('Erreur lors de la suspension de l\'annonce:', error);
    }
    loadReports();
  }

  async function banUser(userId: string, reportId: string) {
    if (!confirm('Bannir cet utilisateur ? Il ne pourra plus se connecter.')) return;
    const { error } = await supabase.from('users').update({ role: 'banned' }).eq('id', userId);
    if (error) {
      console.error('Erreur lors du bannissement:', error);
    }
    if (!error) {
      await handleReportStatus(reportId, 'resolved');
    }
  }

  async function loadUsers() {
    setLoading(true);
    let query = supabase.from('users').select('*').order('created_at', { ascending: false });
    // Neutraliser les caractères de syntaxe PostgREST pour éviter de casser le filtre .or()
    const sanitizedSearch = userSearch.replace(/[,()"'\\]/g, ' ').trim();
    if (sanitizedSearch) {
      query = query.or(`display_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%,username.ilike.%${sanitizedSearch}%`);
    }
    const { data } = await query.limit(50);
    if (data) setUsers(data);
    setLoading(false);
  }

  async function loadVerificationRequests() {
    setLoading(true);
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: false });
    if (data) setVerificationRequests(data);
    setLoading(false);
  }

  async function loadBannedWords() {
    setBannedWordsLoading(true);
    const { data, error } = await supabase.from('banned_words').select('*').order('word');
    if (error) {
      console.error('Error loading banned words:', error);
    }
    if (data) setBannedWords(data);
    setBannedWordsLoading(false);
  }

  async function handleDisputeStatus(
    disputeId: string,
    status: 'open' | 'in_review' | 'resolved' | 'dismissed'
  ) {
    if (!user?.id) {
      alert('Session expirée, veuillez vous reconnecter.');
      return;
    }

    // Validation explicite du statut
    const validStatuses = ['open', 'in_review', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      console.error('Statut invalide:', status);
      alert('Statut invalide: ' + status);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        status: status.trim(),
      };

      if (status === 'resolved' || status === 'dismissed') {
        payload.resolved_by = user.id;
        payload.resolved_at = new Date().toISOString();
        // Utiliser les notes seulement si elles existent dans le state
        const notes = disputeNotes[disputeId];
        if (notes) {
          payload.resolution_notes = notes;
        }
        if (status === 'resolved') {
          payload.resolution = notes || 'Litige résolu';
        }
      }

      const { error } = await supabase
        .from('disputes')
        .update(payload)
        .eq('id', disputeId)
        .select();

      if (error) {
        console.error('Erreur lors de la mise à jour du litige', error);
        alert('Erreur: ' + error.message + (error.details ? '\n' + error.details : ''));
      } else {
        loadDisputes();
      }
    } catch (err) {
      console.error('Exception lors de la mise à jour', err);
      alert('Erreur: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function handleReportStatus(reportId: string, status: 'resolved' | 'dismissed') {
    await supabase.from('reports').update({ 
      status, 
      moderator_id: user?.id,
      resolved_at: new Date().toISOString() 
    }).eq('id', reportId);
    loadReports();
  }

  async function handleVerification(userId: string, status: 'verified' | 'rejected') {
    await supabase.from('users').update({
      verification_status: status,
      verification_reviewed_at: new Date().toISOString(),
      is_verified: status === 'verified',
    }).eq('id', userId);
    loadVerificationRequests();
  }

  async function handleUserRole(userId: string, role: 'user' | 'moderator' | 'admin') {
    await supabase.from('users').update({ role }).eq('id', userId);
    loadUsers();
  }

  async function addBannedWord() {
    const value = newWord.toLowerCase().trim();
    const severity = newSeverity === 'block' ? 'block' : 'warning';
    if (!value) return;
    setBannedWordsLoading(true);
    const { error } = await supabase.from('banned_words').insert({ word: value, severity });
    if (error) {
      console.error('Error adding banned word:', error);
      setBannedWordsLoading(false);
      return;
    }
    setNewWord('');
    setNewSeverity('warning');
    await loadBannedWords();
    setBannedWordsLoading(false);
  }

  async function removeBannedWord(id: string) {
    setBannedWordsLoading(true);
    const { error } = await supabase.from('banned_words').delete().eq('id', id);
    if (error) {
      console.error('Error removing banned word:', error);
      setBannedWordsLoading(false);
      return;
    }
    await loadBannedWords();
    setBannedWordsLoading(false);
  }

  if (!user || !['admin', 'moderator'].includes(user.role)) {
    return (
      <div className="w-full max-w-4xl text-center">
        <Shield className="w-16 h-16 text-primary/20 mx-auto mb-4" />
        <h2 className="text-xl font-headline font-semibold text-on-surface">Accès refusé</h2>
        <p className="text-on-surface-variant">Cette page est réservée aux administrateurs.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl">
      <PageBackRowSpacer />
      <div className="mb-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-headline font-semibold text-on-surface">Administration</h1>
          <p className="text-xs text-on-surface-variant">Modération, gestion des utilisateurs et statistiques BonTroc</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-outline-variant/15 overflow-x-auto pb-1">
        <button
          onClick={() => setTab('reports')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
            tab === 'reports' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'
          }`}
        >
          <Flag className="w-4 h-4 inline mr-2" />
          Signalements
        </button>
        <button
          onClick={() => setTab('verification')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
            tab === 'verification' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'
          }`}
        >
          <CheckCircle className="w-4 h-4 inline mr-2" />
          Vérifications
        </button>
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
            tab === 'users' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Utilisateurs
        </button>
        <button
          onClick={() => setTab('banned-words')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
            tab === 'banned-words' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'
          }`}
        >
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          Mots bannis
        </button>
        <button
          onClick={() => setTab('disputes')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
            tab === 'disputes' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'
          }`}
        >
          <Gavel className="w-4 h-4 inline mr-2" />
          Litiges
        </button>
        <button
          onClick={() => setTab('stats')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
            tab === 'stats' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Statistiques
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Reports Tab */}
          {tab === 'reports' && (
            <div className="space-y-4">
              {reports.length === 0 ? (
                <p className="text-on-surface-variant text-center py-8">Aucun signalement</p>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            report.status === 'pending' ? 'bg-secondary-container/40 text-on-secondary-container' :
                            report.status === 'resolved' ? 'bg-green-100 text-green-800' :
                            'bg-surface-container text-on-surface'
                          }`}>
                            {report.status}
                          </span>
                          {report.listing_id && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">Annonce</span>}
                          {report.reported_user_id && !report.listing_id && <span className="text-xs bg-primary-container text-on-primary-container px-2 py-1 rounded">Utilisateur</span>}
                        </div>
                        
                        <p className="font-medium">{report.reason}</p>
                        {report.details && <p className="text-sm text-on-surface-variant mt-1">{report.details}</p>}
                        
                        {report.listing && (
                          <div className={`mt-3 p-3 rounded-lg flex items-center justify-between ${
                            report.listing.status === 'suspended' ? 'bg-secondary-container/40 border border-secondary-container' :
                            report.listing.status === 'published' ? 'bg-surface-container-low' : 'bg-error-container/50 border border-error/30'
                          }`}>
                            <div>
                              <p className="text-sm font-medium">Annonce : {report.listing.title}</p>
                              <p className={`text-xs font-medium ${
                                report.listing.status === 'suspended' ? 'text-on-secondary-container' :
                                report.listing.status === 'published' ? 'text-on-surface-variant' : 'text-on-error-container'
                              }`}>
                                Statut : {report.listing.status === 'suspended' ? '⚠️ Suspendue' : 
                                         report.listing.status === 'published' ? '✓ Publiée' : '❌ ' + report.listing.status}
                              </p>
                            </div>
                            <button
                              onClick={() => setViewingListingId(report.listing_id!)}
                              className="flex items-center gap-1 rounded bg-primary/15 px-3 py-1 text-sm text-primary hover:bg-primary/25"
                            >
                              <Eye className="w-4 h-4" />
                              Voir
                            </button>
                          </div>
                        )}
                        {report.listing_id && !report.listing && (
                          <div className="mt-3 p-3 bg-error-container/50 border border-error/30 rounded-lg">
                            <p className="text-sm font-medium text-on-error-container">🗑️ Annonce supprimée</p>
                          </div>
                        )}
                        
                        <p className="text-xs text-on-surface-variant/70 mt-2">
                          Par {report.reporter?.display_name} • {new Date(report.created_at).toLocaleDateString('fr-FR')}
                          {report.reported_user && ` • Contre ${report.reported_user.display_name}`}
                        </p>
                      </div>
                      
                      {report.status === 'pending' && (
                        <div className="flex flex-col gap-2 ml-4">
                          {report.listing_id && (
                            <>
                              <button
                                onClick={() => suspendListing(report.listing_id!)}
                                className="px-3 py-2 text-xs min-h-9 bg-secondary-container/40 text-on-secondary-container rounded-full hover:bg-secondary-container/60"
                                title="Suspendre l'annonce"
                              >
                                Suspendre
                              </button>
                              <button
                                onClick={() => deleteListing(report.listing_id!, report.id)}
                                className="px-3 py-2 text-xs min-h-9 bg-error-container/50 text-on-error-container rounded-full hover:bg-error-container"
                                title="Supprimer l'annonce"
                              >
                                Supprimer
                              </button>
                            </>
                          )}
                          {report.reported_user_id && (
                            <button
                              onClick={() => banUser(report.reported_user_id!, report.id)}
                              className="px-3 py-2 text-xs min-h-9 bg-error-container/50 text-on-error-container rounded-full hover:bg-error-container"
                              title="Bannir l'utilisateur"
                            >
                              Bannir
                            </button>
                          )}
                          <div className="flex gap-1 mt-2">
                            <button
                              onClick={() => handleReportStatus(report.id, 'resolved')}
                              className="flex h-10 w-10 items-center justify-center text-green-600 hover:bg-green-50 rounded-full"
                              title="Marquer résolu"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleReportStatus(report.id, 'dismissed')}
                              className="flex h-10 w-10 items-center justify-center text-on-surface-variant hover:bg-surface-container-low rounded-full"
                              title="Rejeter"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Verification Tab */}
          {tab === 'verification' && (
            <div className="space-y-4">
              {verificationRequests.length === 0 ? (
                <p className="text-on-surface-variant text-center py-8">Aucune demande de vérification en attente</p>
              ) : (
                verificationRequests.map((req) => (
                  <div key={req.id} className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg p-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        {req.avatar_url ? (
                          <img src={req.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container font-bold text-on-secondary-container">
                            {req.display_name[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{req.display_name}</p>
                          <p className="text-sm text-on-surface-variant">@{req.username} • {req.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {req.verification_document_url && (
                          <button
                            onClick={async () => {
                              // Extraire le chemin du fichier depuis l'URL
                              const url = new URL(req.verification_document_url!);
                              const path = url.pathname.split('/verification-documents/')[1];
                              if (path) {
                                const { data } = await supabase.storage
                                  .from('verification-documents')
                                  .createSignedUrl(decodeURIComponent(path), 300); // 5 minutes
                                if (data?.signedUrl) {
                                  window.open(data.signedUrl, '_blank');
                                }
                              }
                            }}
                            className="flex h-10 w-10 items-center justify-center text-primary hover:bg-primary/10 rounded-full"
                            title="Voir le document"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleVerification(req.id, 'verified')}
                          className="flex h-10 w-10 items-center justify-center text-green-600 hover:bg-green-50 rounded-full"
                          title="Approuver"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleVerification(req.id, 'rejected')}
                          className="flex h-10 w-10 items-center justify-center text-error hover:bg-error-container/50 rounded-full"
                          title="Refuser"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Users Tab */}
          {tab === 'users' && (
            <div>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Rechercher un utilisateur..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
                  className="w-full px-4 py-2 border border-outline-variant/30 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-surface-container-low focus:bg-surface-container-lowest"
                />
              </div>
              <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-surface-container-low">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant">Utilisateur</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant">Rôle</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant">Inscrit le</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {u.is_verified && <CheckCircle className="w-4 h-4 text-primary" />}
                            <span className="font-medium">{u.display_name}</span>
                            <span className="text-on-surface-variant/70">@{u.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">{u.email}</td>
                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            onChange={(e) => handleUserRole(u.id, e.target.value as 'user' | 'moderator' | 'admin')}
                            className="text-sm border border-outline-variant/30 rounded-full px-3 py-1 bg-surface-container-lowest"
                            disabled={u.id === user?.id}
                          >
                            <option value="user">User</option>
                            <option value="moderator">Modérateur</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">
                          {new Date(u.created_at).toLocaleDateString('fr-FR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Banned Words Tab */}
          {tab === 'banned-words' && (
            <div>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Nouveau mot..."
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  className="flex-1 px-4 py-2 border border-outline-variant/30 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-surface-container-low focus:bg-surface-container-lowest"
                />
                <select
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value as 'warning' | 'block')}
                  className="px-4 py-2 border border-outline-variant/30 rounded-full text-sm bg-surface-container-lowest"
                >
                  <option value="warning">Warning</option>
                  <option value="block">Bloquer</option>
                </select>
                <button
                  onClick={addBannedWord}
                  className="px-4 py-2 btn-primary rounded-full text-sm"
                >
                  Ajouter
                </button>
              </div>
              <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg">
                <div className="divide-y">
                  {bannedWords.map((w) => (
                    <div key={w.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{w.word}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          w.severity === 'block' ? 'bg-error-container/50 text-on-error-container' : 'bg-secondary-container/40 text-on-secondary-container'
                        }`}>
                          {w.severity}
                        </span>
                      </div>
                      <button
                        onClick={() => removeBannedWord(w.id)}
                        className="flex h-10 w-10 items-center justify-center text-error hover:bg-error-container/50 rounded-full"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Disputes Tab */}
          {tab === 'disputes' && (
            <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : disputes.length === 0 ? (
                <p className="text-on-surface-variant text-center py-8">Aucun litige pour le moment</p>
              ) : (
                disputes.map((dispute) => {
                  const proposal = dispute.exchange?.contract?.proposal;
                  const listingTitle = proposal?.listing?.title || 'Annonce supprimée';
                  const statusStyles: Record<string, string> = {
                    open: 'bg-error-container/50 text-on-error-container',
                    in_review: 'bg-secondary-container/40 text-on-secondary-container',
                    resolved: 'bg-green-100 text-green-700',
                    dismissed: 'bg-surface-container text-on-surface',
                  };
                  const statusLabels: Record<string, string> = {
                    open: 'Ouvert',
                    in_review: 'En cours',
                    resolved: 'Résolu',
                    dismissed: 'Rejeté',
                  };
                  return (
                    <div key={dispute.id} className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg p-4">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${statusStyles[dispute.status] || 'bg-surface-container text-on-surface'}`}
                            >
                              {statusLabels[dispute.status] || dispute.status}
                            </span>
                            <span className="text-xs text-on-surface-variant">
                              Ouvert le {new Date(dispute.created_at).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          <p className="text-sm text-on-surface-variant">
                            {dispute.exchange?.id ? `Échange #${dispute.exchange.id}` : 'Échange supprimé'} • {listingTitle}
                          </p>
                          <p className="font-semibold text-on-surface">{dispute.reason}</p>
                          {dispute.resolution && (
                            <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded p-2">
                              Résolution : {dispute.resolution}
                            </p>
                          )}
                          {proposal && (
                            <p className="text-xs text-on-surface-variant">
                              {proposal.from_user?.display_name} ↔ {proposal.to_user?.display_name}
                            </p>
                          )}
                          <p className="text-xs text-on-surface-variant">
                            Ouvert par {dispute.opened_by_user?.display_name || 'Utilisateur'} ({dispute.opened_by_user?.email || 'email inconnu'})
                          </p>
                          {dispute.resolved_by_user && (
                            <p className="text-xs text-on-surface-variant">
                              Traité par {dispute.resolved_by_user.display_name} {dispute.resolved_at && `le ${new Date(dispute.resolved_at).toLocaleDateString('fr-FR')}`}
                            </p>
                          )}
                          <textarea
                            value={disputeNotes[dispute.id] || dispute.resolution_notes || ''}
                            onChange={(e) =>
                              setDisputeNotes((prev) => ({ ...prev, [dispute.id]: e.target.value }))
                            }
                            placeholder="Notes de résolution (visibles uniquement pour l'équipe)"
                            rows={3}
                            className="w-full border border-outline-variant/30 rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30"
                          />
                          <button
                            onClick={async () => {
                              const notes = disputeNotes[dispute.id] || '';
                              const { error } = await supabase
                                .from('disputes')
                                .update({ resolution_notes: notes || null })
                                .eq('id', dispute.id);
                              if (error) {
                                alert('Erreur lors de la sauvegarde des notes: ' + error.message);
                              } else {
                                alert('Notes sauvegardées avec succès');
                                loadDisputes();
                              }
                            }}
                            className="mt-2 px-3 py-2 min-h-9 rounded-full text-xs bg-primary/10 text-primary hover:bg-primary/20"
                          >
                            Sauvegarder les notes
                          </button>
                        </div>
                        <div className="flex flex-col gap-2 w-full md:w-56">
                          <button
                            onClick={() => handleDisputeStatus(dispute.id, 'in_review')}
                            className="px-3 py-2 rounded-full text-xs sm:text-sm bg-secondary-container/40 text-on-secondary-container hover:bg-secondary-container/60 disabled:opacity-50"
                            disabled={['resolved', 'dismissed', 'in_review'].includes(dispute.status)}
                          >
                            Prendre en charge
                          </button>
                          <button
                            onClick={() => handleDisputeStatus(dispute.id, 'resolved')}
                            className="px-3 py-2 rounded-full text-xs sm:text-sm bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                            disabled={dispute.status === 'resolved'}
                          >
                            Résoudre
                          </button>
                          <button
                            onClick={() => handleDisputeStatus(dispute.id, 'dismissed')}
                            className="px-3 py-2 rounded-full text-xs sm:text-sm bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-50"
                            disabled={dispute.status === 'dismissed'}
                          >
                            Rejeter
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Stats Tab */}
          {tab === 'stats' && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg p-6 text-center">
                  <div className="text-3xl font-headline font-semibold text-primary">{stats.totalUsers}</div>
                  <div className="text-on-surface-variant text-sm mt-1">Utilisateurs</div>
                </div>
                <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg p-6 text-center">
                  <div className="text-3xl font-headline font-semibold text-primary">{stats.totalListings}</div>
                  <div className="text-on-surface-variant text-sm mt-1">Annonces</div>
                </div>
                <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg p-6 text-center">
                  <div className="text-3xl font-headline font-semibold text-primary">{stats.totalProposals}</div>
                  <div className="text-on-surface-variant text-sm mt-1">Propositions</div>
                </div>
                <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg p-6 text-center">
                  <div className="text-3xl font-headline font-semibold text-green-500">{stats.acceptedProposals}</div>
                  <div className="text-on-surface-variant text-sm mt-1">Acceptées</div>
                </div>
                <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg p-6 text-center">
                  <div className="text-3xl font-headline font-semibold text-primary">{stats.totalExchanges}</div>
                  <div className="text-on-surface-variant text-sm mt-1">Échanges</div>
                </div>
                <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg p-6 text-center">
                  <div className="text-3xl font-headline font-semibold text-green-500">{stats.confirmedExchanges}</div>
                  <div className="text-on-surface-variant text-sm mt-1">Confirmés</div>
                </div>
              </div>

              <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg p-6">
                <h3 className="font-semibold mb-4">Exporter les données (CSV)</h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => exportCSV('users')} className="flex items-center gap-2 px-4 py-2 bg-surface-container rounded-full hover:bg-surface-container-high text-sm">
                    <Download className="w-4 h-4" /> Utilisateurs
                  </button>
                  <button onClick={() => exportCSV('listings')} className="flex items-center gap-2 px-4 py-2 bg-surface-container rounded-full hover:bg-surface-container-high text-sm">
                    <Download className="w-4 h-4" /> Annonces
                  </button>
                  <button onClick={() => exportCSV('proposals')} className="flex items-center gap-2 px-4 py-2 bg-surface-container rounded-full hover:bg-surface-container-high text-sm">
                    <Download className="w-4 h-4" /> Propositions
                  </button>
                  <button onClick={() => exportCSV('exchanges')} className="flex items-center gap-2 px-4 py-2 bg-surface-container rounded-full hover:bg-surface-container-high text-sm">
                    <Download className="w-4 h-4" /> Échanges
                  </button>
                  <button onClick={() => exportCSV('reviews')} className="flex items-center gap-2 px-4 py-2 bg-surface-container rounded-full hover:bg-surface-container-high text-sm">
                    <Download className="w-4 h-4" /> Avis
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg p-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Gavel className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Signatures électroniques</h3>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm('Traiter les demandes de signature en attente ?')) return;
                      setLoading(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('process-esign-requests', {
                          body: {},
                        });
                        
                        if (error) {
                          console.error('Edge Function error:', error);
                          throw error;
                        }
                        
                        if (data?.error) {
                          throw new Error(data.error);
                        }
                        
                        alert(`Demandes traitées : ${data?.processed || 0} réussies, ${data?.failed || 0} échouées`);
                        loadStats();
                      } catch (err) {
                        console.error('Error processing esign requests:', err);
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        alert('Erreur: ' + errorMessage + '\n\nVérifie les logs dans Supabase Dashboard → Edge Functions → process-esign-requests → Logs');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="px-3 py-2 min-h-9 btn-primary text-xs rounded-full disabled:opacity-50"
                  >
                    {loading ? 'Traitement...' : 'Traiter les demandes'}
                  </button>
                </div>
                {esignRequests.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">Aucune demande de signature.</p>
                ) : (
                  <div className="space-y-3">
                    {esignRequests.map((req) => {
                      const statusLabels: Record<string, string> = {
                        pending: 'En attente',
                        sent: 'Envoyé',
                        completed: 'Complété',
                        failed: 'Échoué',
                      };
                      return (
                        <div key={req.id} className="border border-outline-variant/15 rounded-lg px-4 py-3">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-on-surface">
                                Contrat #{req.contract_id.slice(0, 8)} • {req.provider?.toUpperCase() || 'N/A'}
                              </p>
                              <p className="text-xs text-on-surface-variant">
                                Créé le {new Date(req.created_at).toLocaleDateString('fr-FR')} à {new Date(req.created_at).toLocaleTimeString('fr-FR')}
                              </p>
                              {req.envelope_id && (
                                <p className="text-xs text-on-surface-variant/70 mt-1">
                                  Envelope ID: {req.envelope_id}
                                </p>
                              )}
                            </div>
                            <span
                              className={`px-3 py-1 rounded text-xs font-semibold ${
                                req.status === 'completed'
                                  ? 'bg-green-100 text-green-700'
                                  : req.status === 'failed'
                                  ? 'bg-error-container/50 text-on-error-container'
                                  : req.status === 'sent'
                                  ? 'bg-primary/15 text-primary'
                                  : 'bg-secondary-container/40 text-on-secondary-container'
                              }`}
                            >
                              {statusLabels[req.status] || req.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
        <div className="mt-4 p-3 bg-secondary-container/40 border border-secondary-container rounded-lg">
          <p className="text-xs text-on-secondary-container">
            <strong>⚠️ Signature électronique désactivée :</strong> SignRequest ne permet plus de créer de nouveaux tokens API.
            <br />
            Les contrats sont toujours générés, mais sans signature électronique automatique.
            <br />
            Pour réactiver : configurer HelloSign (Dropbox Sign) ou une autre solution de signature électronique.
          </p>
        </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Voir Annonce */}
      {viewingListing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-headline font-semibold text-on-surface">{viewingListing.title}</h3>
                <button onClick={() => setViewingListingId(null)} className="text-on-surface-variant/70 hover:text-on-surface">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {viewingListing.media && viewingListing.media.length > 0 && (
                <div className="mb-4">
                  <img src={viewingListing.media[0].url} alt="" className="w-full h-48 object-cover rounded-2xl" />
                </div>
              )}

              <div className="space-y-3">
                <div className="flex gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${viewingListing.type === 'service' ? 'bg-primary/10 text-primary' : 'bg-secondary-container/40 text-on-secondary-container'}`}>
                    {viewingListing.type}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    viewingListing.status === 'published' ? 'bg-green-100 text-green-700' :
                    viewingListing.status === 'suspended' ? 'bg-error-container/50 text-on-error-container' :
                    'bg-surface-container text-on-surface'
                  }`}>
                    {viewingListing.status}
                  </span>
                </div>

                <div>
                  <p className="text-sm font-medium text-on-surface-variant">Créateur</p>
                  <p className="text-on-surface">{viewingListing.user?.display_name} ({viewingListing.user?.email})</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-on-surface-variant">Description</p>
                  <p className="text-on-surface">{viewingListing.description_offer}</p>
                </div>

                {viewingListing.description_need && (
                  <div>
                    <p className="text-sm font-medium text-on-surface-variant">Recherche</p>
                    <p className="text-on-surface">{viewingListing.description_need}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <button
                    onClick={() => { suspendListing(viewingListing.id); setViewingListingId(null); }}
                    className="px-4 py-2 bg-secondary-container/40 text-on-secondary-container rounded-full hover:bg-secondary-container/60 text-sm"
                  >
                    Suspendre
                  </button>
                  <button
                    onClick={() => { deleteListing(viewingListing.id, ''); setViewingListingId(null); }}
                    className="px-4 py-2 bg-error-container/50 text-on-error-container rounded-full hover:bg-error-container text-sm"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

