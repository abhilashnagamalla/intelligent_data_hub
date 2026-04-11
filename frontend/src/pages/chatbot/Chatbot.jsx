import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../../api';
import { Send, Bot, Loader2, X, Plus, MessageSquare, Trash2, Menu, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DEFAULT_CHAT_TITLE = 'New Chat';

function stripMarkdownFormatting(text) {
  if (!text) return text;
  // Remove ## headers
  text = text.replace(/^#{1,6}\s+/gm, '');
  // Remove ** bold formatting
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  // Remove * italic formatting
  text = text.replace(/\*(.+?)\*/g, '$1');
  return text;
}

function formatChatTitle(value) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return DEFAULT_CHAT_TITLE;
  return normalized.length > 44 ? `${normalized.slice(0, 44).trimEnd()}...` : normalized;
}

function hydrateChats(chats) {
  return (Array.isArray(chats) ? chats : []).map((chat) => {
    const firstPrompt = chat?.messages?.find((message) => message?.role === 'user' && String(message?.content || '').trim());
    const derivedTitle = firstPrompt ? formatChatTitle(firstPrompt.content) : formatChatTitle(chat?.title);
    return {
      ...chat,
      title: derivedTitle,
    };
  });
}

function readStoredChats() {
  if (typeof window === 'undefined') return [];

  try {
    const rawChats = window.localStorage.getItem('chatbot_sessions');
    return hydrateChats(JSON.parse(rawChats || '[]'));
  } catch (_error) {
    try {
      window.localStorage.removeItem('chatbot_sessions');
    } catch (_storageError) {
      // Ignore storage cleanup errors and fall back to an empty session list.
    }
    return [];
  }
}

function readStoredActiveChatId() {
  if (typeof window === 'undefined') return '';

  try {
    return window.localStorage.getItem('chatbot_active_id') || '';
  } catch (_error) {
    return '';
  }
}

function persistChats(chats) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem('chatbot_sessions', JSON.stringify(chats));
  } catch (_error) {
    // Ignore storage quota/private mode errors and keep the UI responsive.
  }
}

function persistActiveChatId(activeChatId) {
  if (typeof window === 'undefined') return;

  try {
    if (activeChatId) {
      window.localStorage.setItem('chatbot_active_id', activeChatId);
    } else {
      window.localStorage.removeItem('chatbot_active_id');
    }
  } catch (_error) {
    // Ignore storage quota/private mode errors and keep the UI responsive.
  }
}

function ChartViz({ chart }) {
  if (!chart) return null;

  const chartType = String(chart.type || 'chart');
  return (
    <div className="mt-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{chartType.toUpperCase()} Chart</div>
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 h-64 flex items-center justify-center">
        <div className="text-sm text-gray-500 text-center">
          Chart data ready: {chart.x_axis?.length || 0} x {chart.y_axis?.length || 0} points<br/>
          Type: {chartType} | Sample: {chart.y_axis?.slice(0, 3).join(', ')}
        </div>
      </div>
    </div>
  );
}

function StructuredResult({ message, result }) {
  const resolvedMessage = message || (result ? { result } : null);
  const resolvedResult = resolvedMessage?.result || result || null;
  const type = resolvedMessage?.type || resolvedResult?.intent || 'insight';

  if (!resolvedResult && !resolvedMessage?.chart) return null;

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/60">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {type.toUpperCase()} {resolvedResult?.title ? `- ${resolvedResult.title}` : ''}
      </div>
      {resolvedMessage?.chart && <ChartViz chart={resolvedMessage.chart} />}
      {resolvedResult?.title && <div className="mt-1 font-semibold text-gray-900 dark:text-white">{resolvedResult.title}</div>}
      {resolvedResult?.metrics?.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {resolvedResult.metrics.map((metric, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white px-3 py-3 dark:border-gray-700 dark:bg-gray-950">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{metric.label}</div>
              <div className="mt-1 font-semibold text-gray-900 dark:text-white">{metric.value}</div>
            </div>
          ))}
        </div>
      )}
      {resolvedResult?.sections?.length > 0 && (
        <div className="mt-4 space-y-4">
          {resolvedResult.sections.map((section, i) => (
            <div key={i}>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">{section.title}</div>
              <ul className="mt-2 space-y-2 list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
                {section.items?.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Chatbot({ onClose, sector: propSector }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { sector: urlSector } = useParams();
  const messagesEndRef = useRef(null);

  const currentSector = propSector || urlSector || (location.pathname.match(/\/domain\/([^/]+)/)?.[1] ?? 'all');
  const sectorTitle = currentSector === 'all' ? 'General' : currentSector.charAt(0).toUpperCase() + currentSector.slice(1);

  const [chats, setChats] = useState(() => readStoredChats());
  const [activeChatId, setActiveChatId] = useState(() => readStoredActiveChatId());
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    persistChats(chats);
  }, [chats]);

  useEffect(() => {
    persistActiveChatId(activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, activeChatId, isLoading]);

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId) || null, [chats, activeChatId]);
  const messages = activeChat?.messages || [];

  const createNewChat = () => {
    const newChat = { id: Date.now().toString(), title: DEFAULT_CHAT_TITLE, sector: currentSector, messages: [] };
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

  const setChatTitle = (chatId, title) => {
    setChats((current) =>
      current.map((chat) => (
        chat.id === chatId
          ? { ...chat, title: formatChatTitle(title) }
          : chat
      )),
    );
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const trimmedInput = input.trim();

    let chatId = activeChatId;
    if (!chatId) {
      const newChat = { id: Date.now().toString(), title: formatChatTitle(trimmedInput), sector: currentSector, messages: [] };
      setChats((current) => [newChat, ...current]);
      setActiveChatId(newChat.id);
      chatId = newChat.id;
    } else if (!activeChat?.messages?.length || activeChat?.title === DEFAULT_CHAT_TITLE) {
      setChatTitle(chatId, trimmedInput);
    }

    const userMessage = { role: 'user', content: trimmedInput, timestamp: new Date().toLocaleTimeString() };
    appendMessage(chatId, userMessage);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.post('/chatbot/query', {
        query: trimmedInput,
        session_id: chatId,
        sector: currentSector !== 'all' ? currentSector : null,
      });

      const responseData = response.data;
      const botMessage = {
        role: 'bot',
        content: responseData.content || responseData.type || 'No response available.',
        restricted: !!responseData?.restricted,
        matches: responseData.matches || responseData.datasets || [],
        insights: responseData.insights || [],
        result: responseData.result || responseData,
        chart: responseData.chart || null,
        type: responseData.type || null,
        timestamp: new Date().toLocaleTimeString(),
      };
      appendMessage(chatId, botMessage);
    } catch (error) {
      appendMessage(chatId, {
        role: 'bot',
        content: 'Sorry, something went wrong. Please try again.',
        restricted: false,
        matches: [],
        insights: [],
        result: null,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openDataset = (match) => {
    const targetHref = match?.href
      || (match?.kind === 'sector' && match?.sector ? `/domain/${match.sector}` : null)
      || (match?.id ? `/dataset/${match.id}` : null);

    if (!targetHref) return;

    if (match.kind === 'sector') {
      navigate(targetHref);
      onClose?.();
      return;
    }
    navigate(targetHref, { state: { id: match.id, title: match.title, sectorKey: match.sector, sector: match.sector } });
    onClose?.();
  };

  return (
      <div className="flex h-full min-h-[600px] w-full overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950 relative">
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
              <div className="text-xs text-gray-500">AI-powered search and insights for {sectorTitle} datasets</div>
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
                <div className="mt-2">Search datasets by topic, state, or sector, then ask for insights from the dataset you want to explore.</div>
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
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{stripMarkdownFormatting(message.content)}</div>
                  <StructuredResult message={message} />
                  {message.matches?.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {message.matches.map((match, matchIndex) => (
                        <div key={`${match.id}-${matchIndex}`} className="rounded-xl border border-gray-200 px-4 py-4 dark:border-gray-800">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                            {match.rank || matchIndex + 1}. {match.kind === 'sector' ? 'Sector result' : 'Dataset result'}
                          </div>
                          <div className="mt-1 font-semibold text-gray-900 dark:text-white">{match.title}</div>
                          {match.description && (
                            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">{match.description}</div>
                          )}
                          {match.organization && (
                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{match.organization}</div>
                          )}
                          {match.tags?.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {match.tags.slice(0, 6).map((tag) => (
                                <span key={`${match.id}-${tag}`} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              onClick={() => openDataset(match)}
                              className="inline-flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                            >
                              {match.kind === 'sector' ? 'Open sector' : 'Open dataset'}
                            </button>
                            {match.sourceUrl && (
                              <a
                                href={match.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-black hover:text-black dark:border-gray-700 dark:text-gray-200 dark:hover:border-white dark:hover:text-white"
                              >
                                Source link
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
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
            <div className="flex items-center gap-3 rounded-2xl border border-black bg-white/92 p-4 dark:bg-gray-950/92 text-gray-700 dark:text-gray-300"><Loader2 className="w-5 h-5 animate-spin" /> Generating response...</div>
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
              placeholder="Search datasets or ask for insights from a specific dataset"
              rows={2}
              className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 pl-4 pr-16 py-4 resize-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
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
