import { useState, useEffect, useRef } from 'react';
import { Send, AlertTriangle } from 'lucide-react';
import { supabase, ChatMessage } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { sendTransactionalEmail } from '../../lib/notifications';
import { checkContent } from '../../lib/moderation';

type ChatWindowProps = {
  proposalId: string;
  onUserClick?: (userId: string) => void;
};

export function ChatWindow({ proposalId, onUserClick }: ChatWindowProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [recipientInfo, setRecipientInfo] = useState<{ email?: string; displayName?: string } | null>(null);
  const [contentWarning, setContentWarning] = useState<string | null>(null);

  useEffect(() => {
    loadChat();
    loadProposalParticipants();
  }, [proposalId, user?.id]);

  useEffect(() => {
    if (chatId) {
      loadMessages();
      const subscription = supabase
        .channel(`chat:${chatId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${chatId}`,
        }, () => {
          loadMessages();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  async function loadChat() {
    const { data } = await supabase
      .from('chats')
      .select('id')
      .eq('proposal_id', proposalId)
      .maybeSingle();

    if (data) {
      setChatId(data.id);
    } else {
      // Créer le chat s'il n'existe pas
      const { data: newChat, error } = await supabase
        .from('chats')
        .insert({ proposal_id: proposalId })
        .select('id')
        .single();

      if (!error && newChat) {
        setChatId(newChat.id);
      }
    }
  }

  async function loadProposalParticipants() {
    if (!user) return;

    const { data } = await supabase
      .from('proposals')
      .select(`
        from_user_id,
        to_user_id,
        from_user:users!proposals_from_user_id_fkey(display_name, email),
        to_user:users!proposals_to_user_id_fkey(display_name, email)
      `)
      .eq('id', proposalId)
      .maybeSingle();

    if (data) {
      const counterpart =
        data.from_user_id === user.id ? data.to_user : data.from_user;
      setRecipientInfo({
        email: counterpart?.email || undefined,
        displayName: counterpart?.display_name || undefined,
      });
    }
  }

  async function loadMessages() {
    if (!chatId) return;

    const { data } = await supabase
      .from('chat_messages')
      .select(`
        *,
        sender:users!chat_messages_sender_id_fkey(*)
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data);
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || !user) return;

    const messageToSend = newMessage.trim();
    setContentWarning(null);

    // Vérifier les mots bannis
    const { hasWarning, hasBlock, detectedWords, warningWords, blockWords } = await checkContent(messageToSend, user.id);
    
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
      const { error } = await supabase.from('chat_messages').insert({
        chat_id: chatId,
        sender_id: user.id,
        body: messageToSend,
      });

      if (error) throw error;

      // Recharger immédiatement les messages
      await loadMessages();

      // Envoyer l'e-mail de notification
      if (recipientInfo?.email) {
        sendTransactionalEmail('new_chat_message', recipientInfo.email, {
          proposal_id: proposalId,
          sender_name: user.display_name,
          recipient_name: recipientInfo.displayName,
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageToSend); // Restaurer le message en cas d'erreur
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="bg-gray-50 rounded-2xl p-4 max-h-96 overflow-y-auto mb-4">
        {messages.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Aucun message pour le moment</p>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwn = message.sender_id === user?.id;
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      isOwn
                        ? 'bg-brand-blue text-white'
                        : 'bg-white border border-gray-100 text-gray-900'
                    }`}
                  >
                    {!isOwn && (
                      <p 
                        onClick={() => {
                          if (onUserClick && message.sender_id) {
                            onUserClick(message.sender_id);
                          }
                        }}
                        className={`text-xs font-medium mb-1 opacity-75 ${onUserClick && message.sender_id ? 'cursor-pointer hover:opacity-100 hover:text-brand-blue transition-colors' : ''}`}
                      >
                        {message.sender?.display_name}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    <p className={`text-xs mt-1 ${isOwn ? 'text-sky-100' : 'text-gray-500'}`}>
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {contentWarning && (
        <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800 mb-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{contentWarning}</span>
        </div>
      )}

      <form onSubmit={handleSend} className="flex space-x-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Écrivez votre message..."
          className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !newMessage.trim()}
          className="btn-primary p-2 rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
