import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Send, AlertTriangle } from 'lucide-react';
import { supabase, errorMessage, type ChatMessage, type PublicProfile } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { sendTransactionalEmail } from '../../lib/notifications';
import { checkContent } from '../../lib/moderation';

type ChatWindowProps = {
  proposalId: string;
  onUserClick?: (userId: string) => void;
  /** Carte sous la modale (historique) ou panneau intégré page détail */
  variant?: 'card' | 'immersive';
};

type Participant = Pick<PublicProfile, 'id' | 'display_name' | 'avatar_url'>;

const HISTORY_LIMIT = 100;
const MESSAGE_SELECT = `*, sender:public_profiles!chat_messages_sender_id_fkey(id, display_name, avatar_url)`;

export function ChatWindow({ proposalId, onUserClick, variant = 'card' }: ChatWindowProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [counterpart, setCounterpart] = useState<Participant | null>(null);
  const [contentWarning, setContentWarning] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLLIElement>(null);
  const participantsRef = useRef(participants);
  participantsRef.current = participants;

  const loadChat = useCallback(async () => {
    setLoadError('');
    const { data } = await supabase.from('chats').select('id').eq('proposal_id', proposalId).limit(1);
    if (data && data.length > 0) {
      setChatId(data[0].id);
      return;
    }
    const { data: created, error } = await supabase.from('chats').insert({ proposal_id: proposalId }).select('id').single();
    if (!error && created) {
      setChatId(created.id);
      return;
    }
    // Créé en parallèle par l'autre partie : on relit.
    const { data: again } = await supabase.from('chats').select('id').eq('proposal_id', proposalId).limit(1);
    if (again && again.length > 0) setChatId(again[0].id);
    else setLoadError(errorMessage(error, 'Conversation indisponible'));
  }, [proposalId]);

  const loadParticipants = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('proposals')
      .select(
        `from_user_id, to_user_id,
         from_user:public_profiles!proposals_from_user_id_fkey(id, display_name, avatar_url),
         to_user:public_profiles!proposals_to_user_id_fkey(id, display_name, avatar_url)`,
      )
      .eq('id', proposalId)
      .maybeSingle();
    if (!data) return;
    const fromU = data.from_user as unknown as Participant | null;
    const toU = data.to_user as unknown as Participant | null;
    const map: Record<string, Participant> = {};
    if (fromU) map[fromU.id] = fromU;
    if (toU) map[toU.id] = toU;
    setParticipants(map);
    setCounterpart(data.from_user_id === user.id ? toU : fromU);
  }, [proposalId, user]);

  const loadMessages = useCallback(async () => {
    if (!chatId) return;
    const { data, error } = await supabase
      .from('chat_messages')
      .select(MESSAGE_SELECT)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);
    if (error) {
      setLoadError(errorMessage(error, 'Messages indisponibles'));
      return;
    }
    setMessages(((data as unknown as ChatMessage[]) || []).slice().reverse());
  }, [chatId]);

  useEffect(() => {
    void loadChat();
    void loadParticipants();
  }, [loadChat, loadParticipants]);

  useEffect(() => {
    if (!chatId) return;
    void loadMessages();
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, { ...row, sender: participantsRef.current[row.sender_id] ?? null }];
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: messages.length > 1 ? 'smooth' : 'auto', block: 'end' });
  }, [messages.length]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || !user) return;

    const messageToSend = newMessage.trim().slice(0, 2000);
    setContentWarning(null);

    const { hasWarning, hasBlock, warningWords, blockWords } = await checkContent(messageToSend, user.id);
    if (hasBlock && blockWords.length > 0) {
      setContentWarning(`Ce message contient un terme interdit (${blockWords.join(', ')}). Envoi bloqué.`);
      return;
    }
    if (hasWarning && warningWords.length > 0) {
      setContentWarning(`Attention : votre message contient des termes sensibles (${warningWords.join(', ')}). Restez vigilant face aux arnaques.`);
    }

    setLoading(true);
    setNewMessage('');
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({ chat_id: chatId, sender_id: user.id, body: messageToSend })
        .select(MESSAGE_SELECT)
        .single();
      if (error) throw error;
      const inserted = data as unknown as ChatMessage;
      setMessages((prev) => (prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]));

      if (counterpart?.id) {
        void sendTransactionalEmail('new_chat_message', counterpart.id, {
          proposal_id: proposalId,
          sender_name: user.display_name,
          recipient_name: counterpart.display_name,
        });
      }
    } catch (error) {
      setContentWarning(errorMessage(error, 'Message non envoyé'));
      setNewMessage(messageToSend);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: string) => new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const isToday = (date: string) => {
    const d = new Date(date);
    const t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  };

  const senderName = (m: ChatMessage) => m.sender?.display_name ?? participants[m.sender_id]?.display_name ?? 'Membre';
  const senderAvatar = (m: ChatMessage) => m.sender?.avatar_url ?? participants[m.sender_id]?.avatar_url ?? null;

  const messagesBody = (
    <>
      {loadError ? (
        <p role="alert" className="py-8 text-center text-sm text-error">
          {loadError}
        </p>
      ) : messages.length === 0 ? (
        <p className="py-12 text-center text-on-surface-variant">Aucun message pour le moment. Écrivez pour lancer la discussion.</p>
      ) : (
        <ol className="space-y-6" aria-label="Messages">
          {messages[0] && isToday(messages[0].created_at) ? (
            <li className="flex justify-center">
              <span className="rounded-full bg-surface-container px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-outline">Aujourd&apos;hui</span>
            </li>
          ) : null}
          {messages.map((message) => {
            const isOwn = message.sender_id === user?.id;
            return (
              <li key={message.id} className={`flex max-w-[85%] items-end gap-3 md:max-w-[80%] ${isOwn ? 'ml-auto flex-row-reverse' : ''}`}>
                {!isOwn ? (
                  senderAvatar(message) ? (
                    <img src={senderAvatar(message)!} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-container-high text-xs font-bold text-primary" aria-hidden>
                      {(senderName(message)[0] ?? '?').toUpperCase()}
                    </div>
                  )
                ) : null}
                <div className={`min-w-0 space-y-1 ${isOwn ? 'text-right' : ''}`}>
                  <div
                    className={`rounded-2xl px-5 py-3 text-sm ${
                      isOwn ? 'rounded-br-none bg-primary text-on-primary shadow-lg shadow-primary/20' : 'rounded-bl-none bg-surface-container-highest text-on-surface'
                    }`}
                  >
                    {!isOwn && (
                      <button
                        type="button"
                        onClick={() => onUserClick?.(message.sender_id)}
                        disabled={!onUserClick}
                        className={`mb-1 block text-left text-xs font-medium text-outline ${onUserClick ? 'cursor-pointer hover:text-primary' : ''}`}
                      >
                        {senderName(message)}
                      </button>
                    )}
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  </div>
                  <span className="block px-1 text-[10px] text-outline">{formatTime(message.created_at)}</span>
                </div>
              </li>
            );
          })}
          <li ref={messagesEndRef} aria-hidden />
        </ol>
      )}
    </>
  );

  const composer = (compact: boolean) => (
    <form onSubmit={handleSend} className={compact ? 'flex space-x-2' : 'relative flex items-center'}>
      <label htmlFor={`chat-input-${proposalId}`} className="sr-only">
        Votre message
      </label>
      <input
        id={`chat-input-${proposalId}`}
        type="text"
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        placeholder="Écrivez votre message…"
        maxLength={2000}
        autoComplete="off"
        className={
          compact
            ? 'flex-1 rounded-full border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
            : 'w-full rounded-full border-0 bg-surface-container-lowest py-4 pl-5 pr-16 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/20'
        }
        disabled={loading || !chatId}
      />
      <button
        type="submit"
        disabled={loading || !newMessage.trim() || !chatId}
        aria-label="Envoyer le message"
        className={
          compact
            ? 'btn-primary flex h-10 w-10 items-center justify-center rounded-full p-2 disabled:cursor-not-allowed disabled:opacity-50'
            : 'absolute right-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg shadow-primary/30 transition-transform active:scale-90 disabled:opacity-40'
        }
      >
        <Send className="h-5 w-5" aria-hidden />
      </button>
    </form>
  );

  if (variant === 'immersive') {
    return (
      <section aria-label="Discussion" className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-soft-lg md:min-h-[700px]">
        <div className="flex items-center justify-between border-b border-outline-variant/10 px-4 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative flex-shrink-0">
              {counterpart?.avatar_url ? (
                <img src={counterpart.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high font-bold text-primary" aria-hidden>
                  {(counterpart?.display_name?.[0] ?? '?').toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-on-surface">{counterpart?.display_name || 'Contrepartie'}</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Discussion</p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(45,141,191,0.03),transparent_40%)]">
          <div className="flex-1 overflow-y-auto p-4 md:p-6" aria-live="polite">
            {messagesBody}
          </div>

          {contentWarning ? (
            <div role="alert" className="mx-4 mb-2 flex items-start gap-2 rounded-xl border border-secondary-container/40 bg-secondary-container/10 p-3 text-sm text-on-secondary-container md:mx-6">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
              <span>{contentWarning}</span>
            </div>
          ) : null}

          <div className="border-t border-outline-variant/10 bg-surface-container-low p-4 md:p-6">{composer(false)}</div>
        </div>
      </section>
    );
  }

  return (
    <div className="mt-4 border-t border-outline-variant/20 pt-4">
      <div className="mb-4 max-h-96 overflow-y-auto rounded-2xl bg-surface-container-low p-4" aria-live="polite">
        {messagesBody}
      </div>

      {contentWarning && (
        <div role="alert" className="mb-2 flex items-start gap-2 rounded-xl border border-secondary-container bg-secondary-container/20 p-3 text-sm text-on-secondary-container">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
          <span>{contentWarning}</span>
        </div>
      )}

      {composer(true)}
    </div>
  );
}
