import { useCallback, useEffect, useState } from 'react';
import { Shield, Users, Flag, AlertTriangle, Loader2, Trash2, CheckCircle, XCircle, Eye, BarChart3, Download, Gavel } from 'lucide-react';
import { supabase, errorMessage, type User, type EsignRequest, type Dispute, type Report, type ReportStatus, type UserRole } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { PageBackRowSpacer } from '../layout/PageBackLink';
import { useNotice } from '../ui/Toast';
import { DISPUTE_STATUS_CLASS, DISPUTE_STATUS_LABEL, LISTING_STATUS_LABEL, REPORT_REASON_LABEL, REPORT_STATUS_LABEL, formatDateFr, formatDateTimeFr } from '../../lib/labels';

type Tab = 'reports' | 'verification' | 'users' | 'banned-words' | 'disputes' | 'stats';

type AdminReport = Report & {
  reporter?: { display_name: string } | null;
  reported_user?: { display_name: string; role?: UserRole } | null;
  listing?: { id: string; title: string; status: string } | null;
};

type DisputeRow = Dispute & {
  opened_by_user?: { display_name: string; email: string } | null;
  resolved_by_user?: { display_name: string } | null;
  exchange?: {
    id: string;
    status: string;
    contract?: {
      proposal?: {
        id: string;
        from_user_id: string;
        to_user_id: string;
        listing?: { title: string } | null;
        from_user?: { display_name: string } | null;
        to_user?: { display_name: string } | null;
      } | null;
    } | null;
  } | null;
};

type AdminListingDetail = {
  id: string;
  title: string;
  type: string;
  status: string;
  description_offer?: string;
  desired_exchange_desc?: string;
  mode?: string;
  estimation_min?: number | null;
  estimation_max?: number | null;
  user?: { display_name: string; email: string } | null;
  media?: { url: string }[];
};

const USERS_PAGE = 50;

/** Export CSV : guillemets doublés, cellules entourées, formules neutralisées (Excel/LibreOffice). */
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Array.from(rows.reduce<Set<string>>((set, r) => (Object.keys(r).forEach((k) => set.add(k)), set), new Set()));
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [headers.map(cell).join(','), ...rows.map((r) => headers.map((h) => cell(r[h])).join(','))].join('\r\n');
}

async function fetchAll(table: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: true }).range(from, from + step - 1);
    if (error) throw error;
    out.push(...((data as Record<string, unknown>[]) ?? []));
    if (!data || data.length < step) break;
  }
  return out;
}

function tabClass(active: boolean) {
  return `inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium -mb-px ${active ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`;
}

export function AdminPage() {
  const { user } = useAuth();
  const { toast, confirm } = useNotice();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<Tab>('reports');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [showTreatedReports, setShowTreatedReports] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [usersTotal, setUsersTotal] = useState<number | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userSearchApplied, setUserSearchApplied] = useState('');

  const [verificationRequests, setVerificationRequests] = useState<User[]>([]);
  const [verificationNotes, setVerificationNotes] = useState<Record<string, string>>({});

  const [bannedWords, setBannedWords] = useState<{ id: string; word: string; severity: string }[]>([]);
  const [newWord, setNewWord] = useState('');
  const [newSeverity, setNewSeverity] = useState<'warning' | 'block'>('warning');
  const [bannedWordsError, setBannedWordsError] = useState('');

  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [disputeNotes, setDisputeNotes] = useState<Record<string, string>>({});
  const [disputeResolution, setDisputeResolution] = useState<Record<string, string>>({});

  const [viewingListingId, setViewingListingId] = useState<string | null>(null);
  const [viewingListing, setViewingListing] = useState<AdminListingDetail | null>(null);

  const [stats, setStats] = useState({ totalUsers: 0, totalListings: 0, totalProposals: 0, totalExchanges: 0, acceptedProposals: 0, confirmedExchanges: 0, openReports: 0, openDisputes: 0 });
  const [esignRequests, setEsignRequests] = useState<EsignRequest[]>([]);
  const [busy, setBusy] = useState(false);

  // ── Chargements ────────────────────────────────────────────────────────────
  const loadReports = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    let query = supabase
      .from('reports')
      .select(`*, reporter:users!reports_reporter_id_fkey(display_name), reported_user:users!reports_reported_user_id_fkey(display_name, role), listing:listings(id, title, status)`)
      .order('created_at', { ascending: false })
      .limit(300);
    if (!showTreatedReports) query = query.eq('status', 'pending');
    const { data, error } = await query;
    if (error) setLoadError(errorMessage(error));
    setReports((data as unknown as AdminReport[]) ?? []);
    setLoading(false);
  }, [showTreatedReports]);

  const loadUsers = useCallback(
    async (append = false) => {
      setLoading(!append);
      setLoadError('');
      const from = append ? users.length : 0;
      let query = supabase.from('users').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + USERS_PAGE - 1);
      const sanitized = userSearchApplied.replace(/[,()"'\\%]/g, ' ').trim();
      if (sanitized) query = query.or(`display_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,username.ilike.%${sanitized}%`);
      const { data, error, count } = await query;
      if (error) setLoadError(errorMessage(error));
      setUsers((prev) => (append ? [...prev, ...((data as User[]) ?? [])] : ((data as User[]) ?? [])));
      setUsersTotal(count ?? null);
      setLoading(false);
    },
    [userSearchApplied, users.length],
  );

  const loadVerificationRequests = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase.from('users').select('*').eq('verification_status', 'pending').order('verification_submitted_at', { ascending: true }).limit(200);
    if (error) setLoadError(errorMessage(error));
    setVerificationRequests((data as User[]) ?? []);
    setLoading(false);
  }, []);

  const loadBannedWords = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase.from('banned_words').select('*').order('word');
    if (error) setLoadError(errorMessage(error));
    setBannedWords(data ?? []);
    setLoading(false);
  }, []);

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase
      .from('disputes')
      .select(
        `*,
        opened_by_user:users!disputes_opened_by_fkey(display_name, email),
        resolved_by_user:users!disputes_resolved_by_fkey(display_name),
        exchange:exchanges(id, status, contract:contracts(proposal:proposals(id, from_user_id, to_user_id, listing:listings(title),
          from_user:users!proposals_from_user_id_fkey(display_name), to_user:users!proposals_to_user_id_fkey(display_name))))`,
      )
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) setLoadError(errorMessage(error));
    const rows = ((data as unknown as DisputeRow[]) ?? []).map((d) => ({ ...d, exchange: Array.isArray(d.exchange) ? d.exchange[0] : d.exchange }));
    setDisputes(rows);
    setDisputeNotes((prev) => {
      const next = { ...prev };
      rows.forEach((d) => {
        if (next[d.id] === undefined) next[d.id] = d.resolution_notes ?? '';
      });
      return next;
    });
    setDisputeResolution((prev) => {
      const next = { ...prev };
      rows.forEach((d) => {
        if (next[d.id] === undefined) next[d.id] = d.resolution ?? '';
      });
      return next;
    });
    setLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const count = (table: string, filter?: (q: ReturnType<typeof supabase.from>) => unknown) => {
      const base = supabase.from(table).select('id', { count: 'exact', head: true });
      return (filter ? (filter(supabase.from(table)) as typeof base) : base) as unknown as Promise<{ count: number | null; error: unknown }>;
    };
    const [u, l, p, e, ap, ce, r, d, es] = await Promise.all([
      count('users'),
      count('listings'),
      count('proposals'),
      count('exchanges'),
      supabase.from('proposals').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
      supabase.from('exchanges').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('disputes').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_review']),
      supabase.from('esign_requests').select('*').order('created_at', { ascending: false }).limit(10),
    ]);
    setStats({
      totalUsers: u.count ?? 0,
      totalListings: l.count ?? 0,
      totalProposals: p.count ?? 0,
      totalExchanges: e.count ?? 0,
      acceptedProposals: ap.count ?? 0,
      confirmedExchanges: ce.count ?? 0,
      openReports: r.count ?? 0,
      openDisputes: d.count ?? 0,
    });
    setEsignRequests((es.data as EsignRequest[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'reports') void loadReports();
    if (tab === 'users') void loadUsers(false);
    if (tab === 'verification') void loadVerificationRequests();
    if (tab === 'banned-words') void loadBannedWords();
    if (tab === 'disputes') void loadDisputes();
    if (tab === 'stats') void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, showTreatedReports, userSearchApplied]);

  useEffect(() => {
    if (!viewingListingId) {
      setViewingListing(null);
      return;
    }
    supabase
      .from('listings')
      .select(`id, title, type, status, description_offer, desired_exchange_desc, mode, estimation_min, estimation_max, user:users(display_name, email), media:listing_media(url)`)
      .eq('id', viewingListingId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error(errorMessage(error));
        setViewingListing((data as unknown as AdminListingDetail) ?? null);
      });
  }, [viewingListingId, toast]);

  useEffect(() => {
    if (!viewingListingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewingListingId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewingListingId]);

  // ── Actions ────────────────────────────────────────────────────────────────
  /** Exécute une mutation et vérifie qu'au moins une ligne a été touchée (sinon la RLS l'a refusée). */
  async function mutate<T>(promise: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, success: string) {
    setBusy(true);
    try {
      const { data, error } = await promise;
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Action refusée par la base (droits insuffisants ou ligne inexistante).');
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function setListingStatus(listingId: string, status: 'suspended' | 'published', reportId?: string) {
    const ok = await mutate(supabase.from('listings').update({ status, updated_at: new Date().toISOString() }).eq('id', listingId).select('id'), status === 'suspended' ? 'Annonce suspendue.' : 'Annonce remise en ligne.');
    if (ok && reportId) await handleReportStatus(reportId, 'resolved', true);
    if (ok) void loadReports();
  }

  async function banUser(userId: string, reportId?: string) {
    if (!isAdmin) return toast.error('Réservé aux administrateurs.');
    const ok = await confirm({ title: 'Bannir ce membre ?', description: 'Ses annonces seront suspendues, ses propositions annulées et il ne pourra plus se connecter.', confirmLabel: 'Bannir', danger: true });
    if (!ok) return;
    const done = await mutate(supabase.from('users').update({ role: 'banned' }).eq('id', userId).select('id'), 'Membre banni.');
    if (done && reportId) await handleReportStatus(reportId, 'resolved', true);
    if (done) {
      void loadReports();
      if (tab === 'users') void loadUsers(false);
    }
  }

  async function handleReportStatus(reportId: string, status: ReportStatus, silent = false) {
    const ok = await mutate(
      supabase.from('reports').update({ status, moderator_id: user?.id ?? null, resolved_at: new Date().toISOString() }).eq('id', reportId).select('id'),
      status === 'resolved' ? 'Signalement résolu.' : 'Signalement rejeté.',
    );
    if (ok && !silent) void loadReports();
    return ok;
  }

  async function handleVerification(target: User, status: 'verified' | 'rejected') {
    const notes = (verificationNotes[target.id] ?? '').trim();
    if (status === 'rejected' && notes.length < 5) return toast.error('Indiquez un motif de refus (il sera montré au membre).');
    const ok = await mutate(
      supabase
        .from('users')
        .update({
          verification_status: status,
          verification_reviewed_at: new Date().toISOString(),
          is_verified: status === 'verified',
          verification_notes: status === 'rejected' ? notes : null,
          verification_document_url: null,
        })
        .eq('id', target.id)
        .select('id'),
      status === 'verified' ? 'Identité validée.' : 'Vérification refusée.',
    );
    if (!ok) return;
    // Le document n'a plus de raison d'être conservé.
    const path = target.verification_document_url
      ? target.verification_document_url.startsWith('http')
        ? decodeURIComponent(target.verification_document_url.split('/verification-documents/')[1] ?? '')
        : target.verification_document_url
      : '';
    if (path) await supabase.storage.from('verification-documents').remove([path]);
    void loadVerificationRequests();
  }

  async function openVerificationDocument(target: User) {
    const raw = target.verification_document_url;
    if (!raw) return;
    const path = raw.startsWith('http') ? decodeURIComponent(raw.split('/verification-documents/')[1] ?? '') : raw;
    const { data, error } = await supabase.storage.from('verification-documents').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return toast.error('Document introuvable dans le stockage.');
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function handleUserRole(target: User, role: UserRole) {
    if (!isAdmin) return toast.error('Réservé aux administrateurs.');
    if (target.id === user?.id) return;
    const ok = await confirm({ title: `Passer ${target.display_name} en « ${role} » ?`, confirmLabel: 'Confirmer', danger: role === 'banned' || role === 'admin' });
    if (!ok) return;
    const done = await mutate(supabase.from('users').update({ role }).eq('id', target.id).select('id'), 'Rôle mis à jour.');
    if (done) void loadUsers(false);
  }

  async function addBannedWord() {
    const value = newWord.toLowerCase().trim();
    if (!value) return;
    setBannedWordsError('');
    const { error } = await supabase.from('banned_words').insert({ word: value, severity: newSeverity });
    if (error) {
      setBannedWordsError(error.message.includes('duplicate') ? 'Ce mot est déjà dans la liste.' : isAdmin ? errorMessage(error) : 'Action réservée aux administrateurs.');
      return;
    }
    setNewWord('');
    setNewSeverity('warning');
    void loadBannedWords();
  }

  async function removeBannedWord(id: string) {
    setBannedWordsError('');
    const { data, error } = await supabase.from('banned_words').delete().eq('id', id).select('id');
    if (error || !data || data.length === 0) {
      setBannedWordsError(isAdmin ? errorMessage(error, 'Suppression refusée.') : 'Action réservée aux administrateurs.');
      return;
    }
    void loadBannedWords();
  }

  async function saveDisputeNotes(disputeId: string) {
    const notes = (disputeNotes[disputeId] ?? '').trim();
    await mutate(supabase.from('disputes').update({ resolution_notes: notes || null }).eq('id', disputeId).select('id'), 'Notes enregistrées.');
  }

  async function handleDisputeStatus(disputeId: string, status: Dispute['status']) {
    if (!user?.id) return;
    const payload: Record<string, unknown> = { status };
    if (status === 'resolved' || status === 'dismissed') {
      const resolution = (disputeResolution[disputeId] ?? '').trim();
      if (resolution.length < 5) return toast.error('Rédigez la décision communiquée aux parties (5 caractères minimum).');
      const ok = await confirm({ title: status === 'resolved' ? 'Clore ce litige comme résolu ?' : 'Classer ce litige sans suite ?', description: 'La décision sera visible par les deux parties.', confirmLabel: 'Confirmer' });
      if (!ok) return;
      payload.resolved_by = user.id;
      payload.resolved_at = new Date().toISOString();
      payload.resolution = resolution;
      payload.resolution_notes = (disputeNotes[disputeId] ?? '').trim() || null;
    }
    const done = await mutate(supabase.from('disputes').update(payload).eq('id', disputeId).select('id'), 'Litige mis à jour.');
    if (done) void loadDisputes();
  }

  async function exportCSV(table: 'users' | 'listings' | 'proposals' | 'exchanges' | 'reviews') {
    if (!isAdmin) return toast.error('Réservé aux administrateurs.');
    setBusy(true);
    try {
      const rows = await fetchAll(table);
      if (rows.length === 0) return toast.info('Aucune ligne à exporter.');
      const blob = new Blob(['\ufeff' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${table}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${rows.length} ligne${rows.length > 1 ? 's' : ''} exportée${rows.length > 1 ? 's' : ''}.`);
    } catch (err) {
      toast.error(errorMessage(err, 'Export impossible'));
    } finally {
      setBusy(false);
    }
  }

  async function processEsign() {
    const ok = await confirm({ title: 'Traiter les demandes de signature en attente ?', confirmLabel: 'Traiter' });
    if (!ok) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-esign-requests', { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      toast.success(`Demandes traitées : ${data?.processed ?? 0} réussies, ${data?.failed ?? 0} échouées.`);
      void loadStats();
    } catch (err) {
      toast.error(errorMessage(err, 'Traitement impossible'));
    } finally {
      setBusy(false);
    }
  }

  if (!user || !['admin', 'moderator'].includes(user.role)) {
    return (
      <div className="w-full max-w-4xl text-center">
        <Shield className="mx-auto mb-4 h-16 w-16 text-primary/20" aria-hidden />
        <h1 className="font-headline text-xl font-semibold text-on-surface">Accès réservé</h1>
        <p className="text-on-surface-variant">Cette page est réservée à l’équipe de modération.</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { key: 'reports', label: 'Signalements', icon: <Flag className="h-4 w-4" aria-hidden /> },
    { key: 'verification', label: 'Vérifications', icon: <CheckCircle className="h-4 w-4" aria-hidden /> },
    { key: 'disputes', label: 'Litiges', icon: <Gavel className="h-4 w-4" aria-hidden /> },
    { key: 'users', label: 'Membres', icon: <Users className="h-4 w-4" aria-hidden />, adminOnly: true },
    { key: 'banned-words', label: 'Mots interdits', icon: <AlertTriangle className="h-4 w-4" aria-hidden />, adminOnly: true },
    { key: 'stats', label: 'Statistiques', icon: <BarChart3 className="h-4 w-4" aria-hidden /> },
  ];

  const cardClass = 'rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-soft-lg sm:p-6';

  return (
    <div className="w-full max-w-6xl">
      <PageBackRowSpacer />
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10">
          <Shield className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div>
          <h1 className="font-headline text-2xl font-semibold text-on-surface">Administration</h1>
          <p className="text-xs text-on-surface-variant">
            Connecté en tant que {isAdmin ? 'administrateur' : 'modérateur'} · {user.display_name}
          </p>
        </div>
      </div>

      <nav className="mb-6 flex gap-2 overflow-x-auto border-b border-outline-variant/15 pb-1" aria-label="Sections d’administration">
        {tabs
          .filter((t) => !t.adminOnly || isAdmin)
          .map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className={tabClass(tab === t.key)} aria-current={tab === t.key ? 'page' : undefined}>
              {t.icon}
              {t.label}
            </button>
          ))}
      </nav>

      {loadError ? (
        <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-error/30 bg-error-container/30 p-4 text-sm text-on-error-container">
          <span>Chargement impossible : {loadError}</span>
          <button type="button" onClick={() => setTab((t) => t)} className="btn-secondary min-h-10">
            Réessayer
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12" role="status" aria-label="Chargement">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {tab === 'reports' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-on-surface-variant">{reports.length} signalement{reports.length > 1 ? 's' : ''}</p>
                <label className="flex min-h-10 items-center gap-2 text-sm text-on-surface-variant">
                  <input type="checkbox" checked={showTreatedReports} onChange={(e) => setShowTreatedReports(e.target.checked)} className="h-4 w-4 rounded border-outline-variant text-primary" />
                  Afficher les signalements traités
                </label>
              </div>
              {reports.length === 0 ? (
                <p className="py-8 text-center text-on-surface-variant">Aucun signalement à traiter.</p>
              ) : (
                reports.map((report) => (
                  <article key={report.id} className={cardClass}>
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${report.status === 'pending' ? 'bg-secondary-container/40 text-on-secondary-container' : report.status === 'resolved' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface'}`}>
                            {REPORT_STATUS_LABEL[report.status] ?? report.status}
                          </span>
                          {report.listing_id ? <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">Annonce</span> : null}
                          {report.reported_user_id && !report.listing_id ? <span className="rounded bg-primary-container px-2 py-1 text-xs text-on-primary-container">Membre</span> : null}
                          {report.proposal_id ? <span className="rounded bg-surface-container px-2 py-1 text-xs">Proposition</span> : null}
                          {report.chat_id ? <span className="rounded bg-surface-container px-2 py-1 text-xs">Conversation</span> : null}
                        </div>
                        <p className="font-medium">{REPORT_REASON_LABEL[report.reason] ?? report.reason}</p>
                        {report.details ? <p className="mt-1 whitespace-pre-line text-sm text-on-surface-variant">{report.details}</p> : null}

                        {report.listing ? (
                          <div className={`mt-3 flex items-center justify-between gap-3 rounded-lg p-3 ${report.listing.status === 'suspended' ? 'border border-secondary-container bg-secondary-container/40' : report.listing.status === 'published' ? 'bg-surface-container-low' : 'border border-error/30 bg-error-container/50'}`}>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">Annonce : {report.listing.title}</p>
                              <p className="text-xs font-medium text-on-surface-variant">Statut : {LISTING_STATUS_LABEL[report.listing.status as keyof typeof LISTING_STATUS_LABEL] ?? report.listing.status}</p>
                            </div>
                            <button type="button" onClick={() => setViewingListingId(report.listing!.id)} className="flex min-h-10 items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-sm text-primary hover:bg-primary/25">
                              <Eye className="h-4 w-4" aria-hidden />
                              Voir
                            </button>
                          </div>
                        ) : report.listing_id ? (
                          <p className="mt-3 rounded-lg border border-error/30 bg-error-container/50 p-3 text-sm font-medium text-on-error-container">Annonce introuvable (supprimée).</p>
                        ) : null}

                        <p className="mt-2 text-xs text-on-surface-variant">
                          Par {report.reporter?.display_name ?? 'membre'} · {formatDateTimeFr(report.created_at)}
                          {report.reported_user ? ` · Contre ${report.reported_user.display_name}${report.reported_user.role === 'banned' ? ' (banni)' : ''}` : ''}
                        </p>
                      </div>

                      {report.status === 'pending' ? (
                        <div className="flex flex-wrap gap-2 md:w-52 md:flex-col">
                          {report.listing_id && report.listing?.status === 'published' ? (
                            <button type="button" disabled={busy} onClick={() => setListingStatus(report.listing_id!, 'suspended', report.id)} className="min-h-10 rounded-full bg-secondary-container/40 px-3 py-2 text-xs text-on-secondary-container hover:bg-secondary-container/60 disabled:opacity-50">
                              Suspendre l’annonce
                            </button>
                          ) : null}
                          {report.listing_id && report.listing?.status === 'suspended' ? (
                            <button type="button" disabled={busy} onClick={() => setListingStatus(report.listing_id!, 'published')} className="min-h-10 rounded-full bg-surface-container px-3 py-2 text-xs text-on-surface hover:bg-surface-container-high disabled:opacity-50">
                              Remettre en ligne
                            </button>
                          ) : null}
                          {report.reported_user_id && isAdmin && report.reported_user?.role !== 'banned' ? (
                            <button type="button" disabled={busy} onClick={() => banUser(report.reported_user_id!, report.id)} className="min-h-10 rounded-full bg-error-container/50 px-3 py-2 text-xs text-on-error-container hover:bg-error-container disabled:opacity-50">
                              Bannir le membre
                            </button>
                          ) : null}
                          <div className="flex gap-1">
                            <button type="button" disabled={busy} onClick={() => handleReportStatus(report.id, 'resolved')} className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-primary/10" aria-label="Marquer résolu" title="Marquer résolu">
                              <CheckCircle className="h-5 w-5" aria-hidden />
                            </button>
                            <button type="button" disabled={busy} onClick={() => handleReportStatus(report.id, 'dismissed')} className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low" aria-label="Rejeter le signalement" title="Rejeter">
                              <XCircle className="h-5 w-5" aria-hidden />
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          )}

          {tab === 'verification' && (
            <div className="space-y-4">
              {verificationRequests.length === 0 ? (
                <p className="py-8 text-center text-on-surface-variant">Aucune demande de vérification en attente.</p>
              ) : (
                verificationRequests.map((req) => (
                  <article key={req.id} className={cardClass}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-center gap-4">
                        {req.avatar_url ? (
                          <img src={req.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container font-bold text-on-secondary-container" aria-hidden>
                            {req.display_name[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{req.display_name}</p>
                          <p className="text-sm text-on-surface-variant">
                            @{req.username} · {req.email}
                          </p>
                          <p className="text-xs text-on-surface-variant">Envoyé le {formatDateTimeFr(req.verification_submitted_at)}</p>
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 md:max-w-md">
                        <label htmlFor={`verif-notes-${req.id}`} className="text-xs font-semibold text-on-surface-variant">
                          Motif (obligatoire en cas de refus, montré au membre)
                        </label>
                        <textarea id={`verif-notes-${req.id}`} rows={2} maxLength={500} value={verificationNotes[req.id] ?? ''} onChange={(e) => setVerificationNotes((p) => ({ ...p, [req.id]: e.target.value }))} className="w-full rounded-xl border border-outline-variant/30 px-3 py-2 text-sm" placeholder="Ex. : document illisible, expiré…" />
                        <div className="flex flex-wrap items-center gap-2">
                          {req.verification_document_url ? (
                            <button type="button" onClick={() => openVerificationDocument(req)} className="flex min-h-10 items-center gap-1 rounded-full bg-primary/10 px-3 text-sm text-primary hover:bg-primary/20">
                              <Eye className="h-4 w-4" aria-hidden />
                              Voir le document
                            </button>
                          ) : (
                            <span className="text-xs text-error">Aucun document</span>
                          )}
                          <button type="button" disabled={busy} onClick={() => handleVerification(req, 'verified')} className="flex min-h-10 items-center gap-1 rounded-full bg-primary px-3 text-sm font-semibold text-on-primary disabled:opacity-50">
                            <CheckCircle className="h-4 w-4" aria-hidden />
                            Approuver
                          </button>
                          <button type="button" disabled={busy} onClick={() => handleVerification(req, 'rejected')} className="flex min-h-10 items-center gap-1 rounded-full bg-error-container px-3 text-sm font-semibold text-on-error-container disabled:opacity-50">
                            <XCircle className="h-4 w-4" aria-hidden />
                            Refuser
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}

          {tab === 'users' && isAdmin && (
            <div>
              <form
                className="mb-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setUserSearchApplied(userSearch);
                }}
              >
                <label htmlFor="admin-user-search" className="sr-only">
                  Rechercher un membre
                </label>
                <input id="admin-user-search" type="search" placeholder="Nom, e-mail ou pseudo…" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} maxLength={100} className="w-full rounded-full border border-outline-variant/30 bg-surface-container-low px-4 py-2 text-sm focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary" />
                <button type="submit" className="btn-primary min-h-10 px-5">
                  Rechercher
                </button>
              </form>
              <p className="mb-3 text-sm text-on-surface-variant">
                {usersTotal ?? users.length} membre{(usersTotal ?? users.length) > 1 ? 's' : ''}
              </p>
              <div className="overflow-x-auto rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-surface-container-low">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant">Membre</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant">E-mail</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant">Rôle</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-on-surface-variant">Inscrit le</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {users.map((u) => (
                      <tr key={u.id} className={u.role === 'banned' || u.status === 'deleted' ? 'opacity-60' : ''}>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {u.is_verified ? <CheckCircle className="h-4 w-4 text-primary" aria-label="Vérifié" /> : null}
                            <span className="font-medium">{u.display_name}</span>
                            <span className="text-on-surface-variant">@{u.username}</span>
                            {u.role === 'banned' ? <span className="rounded bg-error-container px-2 py-0.5 text-xs text-on-error-container">Banni</span> : null}
                            {u.status === 'deleted' ? <span className="rounded bg-surface-container px-2 py-0.5 text-xs">Supprimé</span> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">{u.email}</td>
                        <td className="px-4 py-3">
                          <label htmlFor={`role-${u.id}`} className="sr-only">
                            Rôle de {u.display_name}
                          </label>
                          <select id={`role-${u.id}`} value={u.role} onChange={(e) => handleUserRole(u, e.target.value as UserRole)} className="min-h-10 rounded-full border border-outline-variant/30 bg-surface-container-lowest px-3 py-1 text-sm" disabled={u.id === user.id || busy}>
                            <option value="user">Membre</option>
                            <option value="moderator">Modérateur</option>
                            <option value="admin">Administrateur</option>
                            <option value="banned">Banni</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">{formatDateFr(u.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {usersTotal !== null && users.length < usersTotal ? (
                <div className="mt-4 flex justify-center">
                  <button type="button" onClick={() => loadUsers(true)} className="btn-secondary min-h-11 px-6">
                    Afficher plus ({users.length}/{usersTotal})
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {tab === 'banned-words' && isAdmin && (
            <div>
              <form
                className="mb-2 flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addBannedWord();
                }}
              >
                <label htmlFor="admin-new-word" className="sr-only">
                  Nouveau mot
                </label>
                <input id="admin-new-word" type="text" placeholder="Nouveau mot…" value={newWord} onChange={(e) => setNewWord(e.target.value)} maxLength={60} className="min-w-[12rem] flex-1 rounded-full border border-outline-variant/30 bg-surface-container-low px-4 py-2 text-sm focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary" />
                <label htmlFor="admin-new-severity" className="sr-only">
                  Sévérité
                </label>
                <select id="admin-new-severity" value={newSeverity} onChange={(e) => setNewSeverity(e.target.value as 'warning' | 'block')} className="min-h-10 rounded-full border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-sm">
                  <option value="warning">Avertir</option>
                  <option value="block">Bloquer</option>
                </select>
                <button type="submit" className="btn-primary min-h-10 px-5">
                  Ajouter
                </button>
              </form>
              {bannedWordsError ? (
                <p role="alert" className="mb-4 text-sm text-error">
                  {bannedWordsError}
                </p>
              ) : null}
              <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg">
                {bannedWords.length === 0 ? (
                  <p className="p-6 text-sm text-on-surface-variant">Aucun mot interdit.</p>
                ) : (
                  <ul className="divide-y divide-outline-variant/10">
                    {bannedWords.map((w) => (
                      <li key={w.id} className="flex items-center justify-between px-4 py-2">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{w.word}</span>
                          <span className={`rounded px-2 py-1 text-xs ${w.severity === 'block' ? 'bg-error-container/50 text-on-error-container' : 'bg-secondary-container/40 text-on-secondary-container'}`}>{w.severity === 'block' ? 'Bloqué' : 'Avertissement'}</span>
                        </div>
                        <button type="button" onClick={() => removeBannedWord(w.id)} className="flex h-10 w-10 items-center justify-center rounded-full text-error hover:bg-error-container/50" aria-label={`Supprimer ${w.word}`}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === 'disputes' && (
            <div className="space-y-4">
              {disputes.length === 0 ? (
                <p className="py-8 text-center text-on-surface-variant">Aucun litige.</p>
              ) : (
                disputes.map((dispute) => {
                  const proposal = dispute.exchange?.contract?.proposal;
                  const closed = dispute.status === 'resolved' || dispute.status === 'dismissed';
                  return (
                    <article key={dispute.id} className={cardClass}>
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded px-2 py-1 text-xs font-semibold ${DISPUTE_STATUS_CLASS[dispute.status]}`}>{DISPUTE_STATUS_LABEL[dispute.status]}</span>
                            <span className="text-xs text-on-surface-variant">Ouvert le {formatDateTimeFr(dispute.created_at)}</span>
                          </div>
                          <p className="text-sm text-on-surface-variant">
                            {proposal?.listing?.title ?? 'Annonce inconnue'} · {proposal?.from_user?.display_name ?? '?'} ↔ {proposal?.to_user?.display_name ?? '?'}
                            {dispute.exchange ? ` · échange ${dispute.exchange.status}` : ''}
                          </p>
                          <p className="whitespace-pre-line font-semibold text-on-surface">{dispute.reason}</p>
                          <p className="text-xs text-on-surface-variant">
                            Ouvert par {dispute.opened_by_user?.display_name ?? 'membre'} ({dispute.opened_by_user?.email ?? 'e-mail inconnu'})
                          </p>
                          {dispute.resolved_by_user ? (
                            <p className="text-xs text-on-surface-variant">
                              Traité par {dispute.resolved_by_user.display_name} le {formatDateTimeFr(dispute.resolved_at)}
                            </p>
                          ) : null}

                          <label htmlFor={`resolution-${dispute.id}`} className="block pt-2 text-xs font-semibold text-on-surface-variant">
                            Décision communiquée aux deux parties
                          </label>
                          <textarea id={`resolution-${dispute.id}`} value={disputeResolution[dispute.id] ?? ''} onChange={(e) => setDisputeResolution((p) => ({ ...p, [dispute.id]: e.target.value }))} rows={2} maxLength={2000} disabled={closed} className="w-full rounded-2xl border border-outline-variant/30 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 disabled:opacity-70" />

                          <label htmlFor={`notes-${dispute.id}`} className="block text-xs font-semibold text-on-surface-variant">
                            Notes internes (équipe uniquement)
                          </label>
                          <textarea id={`notes-${dispute.id}`} value={disputeNotes[dispute.id] ?? ''} onChange={(e) => setDisputeNotes((p) => ({ ...p, [dispute.id]: e.target.value }))} rows={2} maxLength={4000} className="w-full rounded-2xl border border-outline-variant/30 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30" />
                          <button type="button" disabled={busy} onClick={() => saveDisputeNotes(dispute.id)} className="min-h-10 rounded-full bg-primary/10 px-3 py-2 text-xs text-primary hover:bg-primary/20 disabled:opacity-50">
                            Enregistrer les notes
                          </button>
                        </div>
                        <div className="flex w-full flex-col gap-2 md:w-56">
                          <button type="button" onClick={() => handleDisputeStatus(dispute.id, 'in_review')} disabled={busy || closed || dispute.status === 'in_review'} className="min-h-10 rounded-full bg-secondary-container/40 px-3 py-2 text-sm text-on-secondary-container hover:bg-secondary-container/60 disabled:opacity-50">
                            Prendre en charge
                          </button>
                          <button type="button" onClick={() => handleDisputeStatus(dispute.id, 'resolved')} disabled={busy || closed} className="min-h-10 rounded-full bg-primary-container px-3 py-2 text-sm text-on-primary-container hover:brightness-95 disabled:opacity-50">
                            Résoudre
                          </button>
                          <button type="button" onClick={() => handleDisputeStatus(dispute.id, 'dismissed')} disabled={busy || closed} className="min-h-10 rounded-full bg-surface-container px-3 py-2 text-sm text-on-surface hover:bg-surface-container-high disabled:opacity-50">
                            Classer sans suite
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          )}

          {tab === 'stats' && (
            <div>
              <dl className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  ['Membres', stats.totalUsers],
                  ['Annonces', stats.totalListings],
                  ['Propositions', stats.totalProposals],
                  ['Acceptées', stats.acceptedProposals],
                  ['Échanges', stats.totalExchanges],
                  ['Confirmés', stats.confirmedExchanges],
                  ['Signalements ouverts', stats.openReports],
                  ['Litiges ouverts', stats.openDisputes],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 text-center shadow-soft-lg">
                    <dd className="font-headline text-3xl font-semibold text-primary">{value}</dd>
                    <dt className="mt-1 text-sm text-on-surface-variant">{label}</dt>
                  </div>
                ))}
              </dl>

              {isAdmin ? (
                <div className={cardClass}>
                  <h2 className="mb-4 font-semibold">Exporter les données (CSV)</h2>
                  <div className="flex flex-wrap gap-2">
                    {(['users', 'listings', 'proposals', 'exchanges', 'reviews'] as const).map((t) => (
                      <button key={t} type="button" disabled={busy} onClick={() => exportCSV(t)} className="flex min-h-10 items-center gap-2 rounded-full bg-surface-container px-4 py-2 text-sm hover:bg-surface-container-high disabled:opacity-50">
                        <Download className="h-4 w-4" aria-hidden />
                        {{ users: 'Membres', listings: 'Annonces', proposals: 'Propositions', exchanges: 'Échanges', reviews: 'Avis' }[t]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-on-surface-variant">Ces fichiers contiennent des données personnelles : à conserver de façon sécurisée et à supprimer après usage.</p>
                </div>
              ) : null}

              <div className={`${cardClass} mt-6`}>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gavel className="h-5 w-5 text-primary" aria-hidden />
                    <h2 className="font-semibold">Signatures électroniques (désactivé)</h2>
                  </div>
                  <button type="button" onClick={processEsign} disabled={busy} className="btn-primary min-h-10 text-xs">
                    {busy ? 'Traitement…' : 'Traiter les demandes'}
                  </button>
                </div>
                <p className="mb-4 text-xs text-on-surface-variant">SignRequest ne délivre plus de clés API : les contrats sont signés par un clic sur BonTroc (signature électronique simple). Cette file n’est conservée que pour une éventuelle intégration future.</p>
                {esignRequests.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">Aucune demande.</p>
                ) : (
                  <ul className="space-y-2">
                    {esignRequests.map((req) => (
                      <li key={req.id} className="flex flex-col justify-between gap-1 rounded-lg border border-outline-variant/15 px-4 py-3 md:flex-row md:items-center">
                        <span className="text-sm">
                          Contrat {req.contract_id.slice(0, 8)} · {formatDateTimeFr(req.created_at)}
                        </span>
                        <span className="text-xs font-semibold uppercase text-on-surface-variant">{req.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {viewingListingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/50 p-4">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Fermer" onClick={() => setViewingListingId(null)} />
          <div role="dialog" aria-modal="true" aria-labelledby="admin-listing-title" className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg">
            <div className="p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <h2 id="admin-listing-title" className="font-headline text-xl font-semibold text-on-surface">
                  {viewingListing?.title ?? 'Chargement…'}
                </h2>
                <button type="button" onClick={() => setViewingListingId(null)} className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low" aria-label="Fermer">
                  <XCircle className="h-6 w-6" aria-hidden />
                </button>
              </div>
              {viewingListing ? (
                <div className="space-y-3">
                  {viewingListing.media && viewingListing.media.length > 0 ? <img src={viewingListing.media[0].url} alt="" className="h-48 w-full rounded-2xl object-cover" /> : null}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">{viewingListing.type === 'service' ? 'Service' : 'Objet'}</span>
                    <span className="rounded-full bg-surface-container px-2 py-1">{LISTING_STATUS_LABEL[viewingListing.status as keyof typeof LISTING_STATUS_LABEL] ?? viewingListing.status}</span>
                    {viewingListing.mode ? <span className="rounded-full bg-surface-container px-2 py-1">{viewingListing.mode}</span> : null}
                  </div>
                  <p className="text-sm">
                    <span className="font-medium text-on-surface-variant">Auteur : </span>
                    {viewingListing.user?.display_name} ({viewingListing.user?.email})
                  </p>
                  <div>
                    <p className="text-sm font-medium text-on-surface-variant">Offre</p>
                    <p className="whitespace-pre-line text-on-surface">{viewingListing.description_offer}</p>
                  </div>
                  {viewingListing.desired_exchange_desc ? (
                    <div>
                      <p className="text-sm font-medium text-on-surface-variant">Recherche</p>
                      <p className="whitespace-pre-line text-on-surface">{viewingListing.desired_exchange_desc}</p>
                    </div>
                  ) : null}
                  {viewingListing.estimation_min != null || viewingListing.estimation_max != null ? (
                    <p className="text-sm text-on-surface-variant">
                      Estimation : {viewingListing.estimation_min ?? '?'} – {viewingListing.estimation_max ?? '?'} €
                    </p>
                  ) : null}
                  <div className="flex gap-2 border-t border-outline-variant/15 pt-4">
                    {viewingListing.status === 'published' ? (
                      <button type="button" disabled={busy} onClick={() => setListingStatus(viewingListing.id, 'suspended').then(() => setViewingListingId(null))} className="min-h-10 rounded-full bg-secondary-container/40 px-4 py-2 text-sm text-on-secondary-container hover:bg-secondary-container/60 disabled:opacity-50">
                        Suspendre
                      </button>
                    ) : viewingListing.status === 'suspended' ? (
                      <button type="button" disabled={busy} onClick={() => setListingStatus(viewingListing.id, 'published').then(() => setViewingListingId(null))} className="min-h-10 rounded-full bg-surface-container px-4 py-2 text-sm hover:bg-surface-container-high disabled:opacity-50">
                        Remettre en ligne
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
