import { useState, useEffect } from 'react';
import { Shield, Users, FileText, Flag, AlertTriangle, Loader2, Trash2, CheckCircle, XCircle, Eye } from 'lucide-react';
import { supabase, User } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';

type Tab = 'reports' | 'users' | 'verification' | 'banned-words';

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
};

type VerificationRequest = User & {
  verification_document_url?: string;
  verification_status?: string;
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
  const [newWord, setNewWord] = useState('');
  const [newSeverity, setNewSeverity] = useState<'warning' | 'block'>('warning');

  useEffect(() => {
    if (tab === 'reports') loadReports();
    if (tab === 'users') loadUsers();
    if (tab === 'verification') loadVerificationRequests();
    if (tab === 'banned-words') loadBannedWords();
  }, [tab]);

  async function loadReports() {
    setLoading(true);
    const { data } = await supabase
      .from('reports')
      .select(`
        *,
        reporter:users!reports_reporter_id_fkey(display_name),
        reported_user:users!reports_reported_user_id_fkey(display_name)
      `)
      .order('created_at', { ascending: false });
    if (data) setReports(data);
    setLoading(false);
  }

  async function loadUsers() {
    setLoading(true);
    let query = supabase.from('users').select('*').order('created_at', { ascending: false });
    if (userSearch) {
      query = query.or(`display_name.ilike.%${userSearch}%,email.ilike.%${userSearch}%,username.ilike.%${userSearch}%`);
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
    setLoading(true);
    const { data } = await supabase.from('banned_words').select('*').order('word');
    if (data) setBannedWords(data);
    setLoading(false);
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
    if (!newWord.trim()) return;
    await supabase.from('banned_words').insert({ word: newWord.toLowerCase().trim(), severity: newSeverity });
    setNewWord('');
    loadBannedWords();
  }

  async function removeBannedWord(id: string) {
    await supabase.from('banned_words').delete().eq('id', id);
    loadBannedWords();
  }

  if (!user || !['admin', 'moderator'].includes(user.role)) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">Accès refusé</h2>
        <p className="text-gray-500">Cette page est réservée aux administrateurs.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-blue-600" />
        <h1 className="text-2xl font-bold">Administration</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setTab('reports')}
          className={`px-4 py-2 font-medium border-b-2 -mb-px ${tab === 'reports' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
        >
          <Flag className="w-4 h-4 inline mr-2" />
          Signalements
        </button>
        <button
          onClick={() => setTab('verification')}
          className={`px-4 py-2 font-medium border-b-2 -mb-px ${tab === 'verification' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
        >
          <CheckCircle className="w-4 h-4 inline mr-2" />
          Vérifications
        </button>
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 font-medium border-b-2 -mb-px ${tab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Utilisateurs
        </button>
        <button
          onClick={() => setTab('banned-words')}
          className={`px-4 py-2 font-medium border-b-2 -mb-px ${tab === 'banned-words' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
        >
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          Mots bannis
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* Reports Tab */}
          {tab === 'reports' && (
            <div className="space-y-4">
              {reports.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucun signalement</p>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className="bg-white rounded-lg shadow p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium mb-2 ${
                          report.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          report.status === 'resolved' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {report.status}
                        </span>
                        <p className="font-medium">{report.reason}</p>
                        {report.details && <p className="text-sm text-gray-600 mt-1">{report.details}</p>}
                        <p className="text-xs text-gray-400 mt-2">
                          Par {report.reporter?.display_name} • {new Date(report.created_at).toLocaleDateString('fr-FR')}
                          {report.reported_user && ` • Contre ${report.reported_user.display_name}`}
                        </p>
                      </div>
                      {report.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReportStatus(report.id, 'resolved')}
                            className="p-2 text-green-600 hover:bg-green-50 rounded"
                            title="Résolu"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleReportStatus(report.id, 'dismissed')}
                            className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                            title="Rejeter"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
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
                <p className="text-gray-500 text-center py-8">Aucune demande de vérification en attente</p>
              ) : (
                verificationRequests.map((req) => (
                  <div key={req.id} className="bg-white rounded-lg shadow p-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        {req.avatar_url ? (
                          <img src={req.avatar_url} alt="" className="w-12 h-12 rounded-full" />
                        ) : (
                          <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                            {req.display_name[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{req.display_name}</p>
                          <p className="text-sm text-gray-500">@{req.username} • {req.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {req.verification_document_url && (
                          <a
                            href={req.verification_document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                            title="Voir le document"
                          >
                            <Eye className="w-5 h-5" />
                          </a>
                        )}
                        <button
                          onClick={() => handleVerification(req.id, 'verified')}
                          className="p-2 text-green-600 hover:bg-green-50 rounded"
                          title="Approuver"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleVerification(req.id, 'rejected')}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
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
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Utilisateur</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Rôle</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Inscrit le</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {u.is_verified && <CheckCircle className="w-4 h-4 text-blue-600" />}
                            <span className="font-medium">{u.display_name}</span>
                            <span className="text-gray-400">@{u.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            onChange={(e) => handleUserRole(u.id, e.target.value as any)}
                            className="text-sm border rounded px-2 py-1"
                            disabled={u.id === user?.id}
                          >
                            <option value="user">User</option>
                            <option value="moderator">Modérateur</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
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
                  className="flex-1 px-4 py-2 border rounded-lg"
                />
                <select
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value as any)}
                  className="px-4 py-2 border rounded-lg"
                >
                  <option value="warning">Warning</option>
                  <option value="block">Bloquer</option>
                </select>
                <button
                  onClick={addBannedWord}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Ajouter
                </button>
              </div>
              <div className="bg-white rounded-lg shadow">
                <div className="divide-y">
                  {bannedWords.map((w) => (
                    <div key={w.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{w.word}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          w.severity === 'block' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {w.severity}
                        </span>
                      </div>
                      <button
                        onClick={() => removeBannedWord(w.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

