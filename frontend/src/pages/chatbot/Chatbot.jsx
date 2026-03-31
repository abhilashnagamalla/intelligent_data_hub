import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../../api';
import { Send, Bot, User, Loader2, X, Plus, MessageSquare, Trash2, Menu, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Chatbot({ onClose, sector: propSector }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { sector: urlSector } = useParams();
  const messagesEndRef = useRef(null);

  const currentSector = propSector || urlSector || (location.pathname.match(/\/domain\/([^/]+)/)?.[1] ?? 'all');
  const sectorTitle = currentSector === 'all' ? 'General' : currentSector.charAt(0).toUpperCase() + currentSector.slice(1);

  const [chats, setChats] = useState(() => JSON.parse(localStorage.getItem('chatbot_sessions') || '[]'));
  const [activeChatId, setActiveChatId] = useState(() => localStorage.getItem('chatbot_active_id') || '');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    localStorage.setItem('chatbot_sessions', JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (activeChatId) localStorage.setItem('chatbot_active_id', activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, activeChatId, isLoading]);

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId) || null, [chats, activeChatId]);
  const messages = activeChat?.messages || [];

  const createNewChat = () => {
    const newChat = { id: Date.now().toString(), title: 'New Chat', sector: currentSector, messages: [] };
    setChats((current) => [newChat, ...current]);
    setActiveChatId(newChat.id);
  };

  const deleteChat = (id, event) => {
    event.stopPropagation();
    setChats((current) => current.filter((chat) => chat.id !== id));
    if (activeChatId === id) setActiveChatId('');
  };

  const appendMessage = (chatId, message) => {
    setChats((current) => current.map((chat) => (chat.id === chatId ? { ...chat, messages: [...chat.messages, message] } : chat)));
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    let chatId = activeChatId;
    if (!chatId) {
      const newChat = { id: Date.now().toString(), title: input.slice(0, 30), sector: currentSector, messages: [] };
      setChats((current) => [newChat, ...current]);
      setActiveChatId(newChat.id);
      chatId = newChat.id;
    }

    const userMessage = { role: 'user', content: input, timestamp: new Date().toLocaleTimeString() };
    appendMessage(chatId, userMessage);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.post('/chatbot/query', {
        query: input,
        session_id: chatId,
        sector: currentSector !== 'all' ? currentSector : null,
      });

      const botMessage = {
        role: 'bot',
        content: response.data?.content || 'No response available.',
        restricted: !!response.data?.restricted,
        matches: response.data?.matches || [],
        insights: response.data?.insights || [],
        timestamp: new Date().toLocaleTimeString(),
      };
      appendMessage(chatId, botMessage);
    } catch (error) {
      console.error(error);
      appendMessage(chatId, {
        role: 'bot',
        content: 'Sorry, something went wrong. Please try again.',
        restricted: false,
        matches: [],
        insights: [],
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openDataset = (match) => {
    if (match.kind === 'sector') {
      navigate(match.href);
      onClose?.();
      return;
    }
    navigate(match.href, { state: { id: match.id, title: match.title, sectorKey: match.sector, sector: match.sector } });
    onClose?.();
  };

  return (
    <div className="flex h-full min-h-[600px] w-full overflow-hidden bg-white dark:bg-gray-950 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl relative">
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div initial={{ x: -240, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -240, opacity: 0 }} className="absolute lg:relative z-20 w-72 h-full bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <button onClick={createNewChat} className="w-full flex items-center gap-3 px-4 py-3 bg-black text-white rounded-xl">
                <Plus className="w-5 h-5" /> New Chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chats.map((chat) => (
                <div key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer ${activeChatId === chat.id ? 'bg-gray-100 dark:bg-gray-900' : 'hover:bg-gray-50 dark:hover:bg-gray-900/70'}`}>
                  <div className="flex items-center gap-3 truncate">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm truncate">{chat.title || 'Untitled Chat'}</span>
                  </div>
                  <button onClick={(event) => deleteChat(chat.id, event)} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-950 transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen((value) => !value)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 lg:hidden"><Menu className="w-5 h-5" /></button>
            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-900"><Bot className="w-5 h-5" /></div>
            <div>
              <div className="font-bold text-gray-900 dark:text-white">Dataset Chatbot</div>
              <div className="text-xs text-gray-500">Restricted to {sectorTitle} datasets and dataset-derived insights</div>
            </div>
          </div>
          {onClose && <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900"><X className="w-5 h-5" /></button>}
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 text-gray-500">
              <div className="w-20 h-20 rounded-3xl bg-black text-white flex items-center justify-center"><Bot className="w-10 h-10" /></div>
              <div>
                <div className="text-3xl font-black text-gray-900 dark:text-white">Dataset Chatbot</div>
                <div className="mt-2">Ask for matching datasets, details, or dataset-only insights.</div>
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 ${message.role === 'user' ? 'bg-black text-white' : 'bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100'}`}>
                  {message.restricted && (
                    <div className="mb-3 flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/50 rounded-xl px-3 py-2 text-sm">
                      <AlertTriangle className="w-4 h-4" /> Domain restriction active
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
                  {message.matches?.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {message.matches.map((match) => (
                        <button key={match.id} onClick={() => openDataset(match)} className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3 hover:border-black dark:hover:border-white transition-colors">
                          <div className="font-semibold">{match.title}</div>
                          <div className="text-xs text-gray-500">{match.kind === 'sector' ? 'Open sector page' : 'Open dataset details'}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {message.insights?.length > 0 && (
                    <ul className="mt-4 space-y-2 list-disc pl-5 text-sm">
                      {message.insights.map((insight, insightIndex) => (
                        <li key={insightIndex}>{insight}</li>
                      ))}
                    </ul>
                  )}
                  <div className="text-[10px] uppercase tracking-wide text-gray-400 mt-3">{message.timestamp}</div>
                </div>
              </motion.div>
            ))
          )}
          {isLoading && (
            <div className="flex items-center gap-3 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Generating response...</div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
          <div className="relative">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask about dataset names, matching catalogs, or insights from a dataset"
              rows={2}
              className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 pl-4 pr-16 py-4 resize-none"
            />
            <button onClick={sendMessage} disabled={isLoading || !input.trim()} className="absolute right-3 bottom-3 p-3 rounded-xl bg-black text-white disabled:opacity-50">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

