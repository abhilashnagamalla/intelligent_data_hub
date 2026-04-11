import { useEffect, useMemo, useRef, useState, useContext } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Send, Bot, Loader2, X, Plus, MessageSquare, Trash2, Menu, AlertTriangle, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import api from '../../api';
import { AuthContext } from '../../context/AuthContext';
import {
  getUserChats,
  createChat,
  updateChat,
  addMessageToChat,
  deleteChat,
  updateChatTitle,
  updateChatDataset,
  syncLocalStorageChatsToFirebase,
} from '../../services/chatService';

const DEFAULT_CHAT_TITLE = 'New Chat';

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
      dataset: chat?.dataset || null,
      title: derivedTitle,
    };
  });
}

function readStoredChats() {
  // Deprecated - kept for fallback only
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
  // Deprecated - kept for fallback only
  if (typeof window === 'undefined') return '';

  try {
    return window.localStorage.getItem('chatbot_active_id') || '';
  } catch (_error) {
    return '';
  }
}

// Firebase persistence removed - using cloud-based storage now
// Keeping these for backward compatibility only
function persistChats(_chats) {
  // No-op - Firebase handles persistence
}

function persistActiveChatId(_activeChatId) {
  // No-op - Firebase handles persistence
}

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

function StructuredResult({ result }) {
  if (!result) return null;

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/60">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Analysis</div>
      <div className="mt-1 font-semibold text-gray-900 dark:text-white">{result.title}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{result.dataset?.title}</div>
      {result.metrics?.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {result.metrics.map((metric) => (
            <div key={`${metric.label}-${metric.value}`} className="rounded-xl border border-gray-200 bg-white px-3 py-3 dark:border-gray-700 dark:bg-gray-950">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{metric.label}</div>
              <div className="mt-1 font-semibold text-gray-900 dark:text-white">{metric.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatbotDataset({ onClose, sector: propSector }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { sector: urlSector } = useParams();
  const messagesEndRef = useRef(null);
  
  // Get user from AuthContext
  const { user, loading: authLoading } = useContext(AuthContext);

  const currentSector = propSector || urlSector || (location.pathname.match(/\/domain\/([^/]+)/)?.[1] ?? 'all');
  const sectorTitle = currentSector === 'all' ? 'General' : currentSector.charAt(0).toUpperCase() + currentSector.slice(1);

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [datasetQuery, setDatasetQuery] = useState('');
  const [datasetResults, setDatasetResults] = useState([]);
  const [isSearchingDatasets, setIsSearchingDatasets] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [chatsError, setChatsError] = useState(null);

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId) || null, [chats, activeChatId]);
  const messages = activeChat?.messages || [];
  const selectedDataset = activeChat?.dataset || null;

  // Load chats from Firebase when user is authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      setChatsError('Please log in to use the chatbot');
      setIsLoadingChats(false);
      return;
    }

    if (!authLoading && user) {
      loadUserChats();
    }
  }, [authLoading, user]);

  const loadUserChats = async () => {
    try {
      setIsLoadingChats(true);
      setChatsError(null);
      
      const userChats = await getUserChats(user.id);
      
      // If no chats in Firebase, try to migrate from localStorage
      if (userChats.length === 0) {
        const migratedChats = await syncLocalStorageChatsToFirebase(user.id, user.email);
        if (migratedChats.length > 0) {
          setChats(userChats);
          return;
        }
      }
      
      setChats(userChats);
      
      // Set active chat to the most recent one if available
      if (userChats.length > 0 && !activeChatId) {
        setActiveChatId(userChats[0].id);
      }
    } catch (error) {
      console.error('[ChatbotDataset] Error loading chats:', error);
      setChatsError('Failed to load chat history. Please try again.');
    } finally {
      setIsLoadingChats(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, activeChatId, isLoading]);

  useEffect(() => {
    setDatasetQuery(activeChat?.dataset?.title || '');
    setDatasetResults([]);
  }, [activeChatId, activeChat?.dataset?.id]);

  const ensureActiveChat = async () => {
    if (activeChatId) {
      return activeChatId;
    }

    try {
      const newChat = await createChat(user.id, user.email, {
        title: DEFAULT_CHAT_TITLE,
        sector: currentSector,
        dataset: null,
      });
      setChats((current) => [newChat, ...current]);
      setActiveChatId(newChat.id);
      return newChat.id;
    } catch (error) {
      console.error('[ChatbotDataset] Error creating new chat:', error);
      alert('Failed to create new chat. Please try again.');
      return null;
    }
  };

  const createNewChat = async () => {
    try {
      const newChat = await createChat(user.id, user.email, {
        title: DEFAULT_CHAT_TITLE,
        sector: currentSector,
        dataset: null,
      });
      setChats((current) => [newChat, ...current]);
      setActiveChatId(newChat.id);
    } catch (error) {
      console.error('[ChatbotDataset] Error creating new chat:', error);
      alert('Failed to create new chat. Please try again.');
    }
  };

  const deleteChatHandler = async (id, event) => {
    event.stopPropagation();
    try {
      await deleteChat(id, user.id);
      setChats((current) => current.filter((chat) => chat.id !== id));
      if (activeChatId === id) setActiveChatId('');
    } catch (error) {
      console.error('[ChatbotDataset] Error deleting chat:', error);
      alert('Failed to delete chat. Please try again.');
    }
  };

  useEffect(() => {
    const query = datasetQuery.trim();
    if (!activeChatId || !query) {
      setDatasetResults([]);
      setIsSearchingDatasets(false);
      return undefined;
    }

    if (selectedDataset?.title === query) {
      setDatasetResults([]);
      setIsSearchingDatasets(false);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsSearchingDatasets(true);
      try {
        const response = await api.get('/datasets/search', {
          params: {
            q: query,
            sector: currentSector !== 'all' ? currentSector : undefined,
          },
        });

        if (!cancelled) {
          setDatasetResults((response.data || []).slice(0, 8));
        }
      } catch (_error) {
        if (!cancelled) {
          setDatasetResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsSearchingDatasets(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [datasetQuery, activeChatId, currentSector, selectedDataset?.id, selectedDataset?.title]);

  const handleDatasetQueryChange = (event) => {
    setDatasetQuery(event.target.value);
  };

  const selectDataset = async (dataset) => {
    const chatId = activeChatId || (await ensureActiveChat());
    if (!chatId) return;

    const selected = {
      id: dataset.id,
      title: dataset.title,
      sector: dataset.sectorKey || dataset.sector,
    };
    
    try {
      const updated = await updateChatDataset(chatId, user.id, selected);
      setChats((current) =>
        current.map((chat) => (chat.id === chatId ? updated : chat))
      );
      setDatasetQuery(selected.title);
      setDatasetResults([]);
    } catch (error) {
      console.error('[ChatbotDataset] Error selecting dataset:', error);
      alert('Failed to update dataset. Please try again.');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const trimmedInput = input.trim();

    let chatId = activeChatId;
    if (!chatId) {
      chatId = await ensureActiveChat();
      if (!chatId) return;
    }

    const chat = chats.find((entry) => entry.id === chatId) || activeChat;
    const dataset = chat?.dataset || selectedDataset;

    if (!dataset?.id) {
      const botMessage = {
        role: 'bot',
        content: 'Select a dataset before asking a question. This chatbot only answers dataset-specific questions.',
        restricted: true,
        matches: [],
        insights: [],
        result: null,
        timestamp: new Date().toLocaleTimeString(),
      };
      try {
        const updated = await addMessageToChat(chatId, user.id, botMessage);
        setChats((current) =>
          current.map((c) => (c.id === chatId ? updated : c))
        );
      } catch (error) {
        console.error('[ChatbotDataset] Error adding message:', error);
      }
      return;
    }

    if (!chat?.messages?.length || chat?.title === DEFAULT_CHAT_TITLE) {
      try {
        const titleUpdated = await updateChatTitle(chatId, user.id, trimmedInput);
        setChats((current) =>
          current.map((c) => (c.id === chatId ? titleUpdated : c))
        );
      } catch (error) {
        console.error('[ChatbotDataset] Error updating chat title:', error);
      }
    }

    const userMessage = {
      role: 'user',
      content: trimmedInput,
      timestamp: new Date().toLocaleTimeString(),
    };
    
    try {
      const withUserMsg = await addMessageToChat(chatId, user.id, userMessage);
      setChats((current) =>
        current.map((c) => (c.id === chatId ? withUserMsg : c))
      );
    } catch (error) {
      console.error('[ChatbotDataset] Error adding user message:', error);
    }

    setInput('');
    setIsLoading(true);

    try {
      const response = await api.post('/chatbot/query', {
        query: trimmedInput,
        session_id: chatId,
        user_email: user.email,
        user_id: user.id,
        sector: currentSector !== 'all' ? currentSector : null,
        dataset_id: dataset.id,
        dataset_title: dataset.title,
      });

      const botMessage = {
        role: 'bot',
        content: response.data?.content || 'No response available.',
        restricted: !!response.data?.restricted,
        matches: response.data?.matches || [],
        insights: response.data?.insights || [],
        result: response.data?.result || null,
        timestamp: new Date().toLocaleTimeString(),
      };

      try {
        const updated = await addMessageToChat(chatId, user.id, botMessage);
        setChats((current) =>
          current.map((c) => (c.id === chatId ? updated : c))
        );
      } catch (error) {
        console.error('[ChatbotDataset] Error adding bot message:', error);
      }
    } catch (_error) {
      const errorDetails = _error?.response?.data?.detail || _error?.message || 'Unknown error';
      const statusCode = _error?.response?.status || 'N/A';
      
      console.error('[ChatbotDataset] Full API error details:', {
        message: _error?.message,
        status: statusCode,
        data: _error?.response?.data,
        fullError: _error,
      });
      
      const errorContent = statusCode === 500 
        ? 'Backend error occurred. Please check server logs or try again later.'
        : statusCode === 'N/A'
        ? 'Network error: Cannot reach the server. Make sure the backend is running on port 8000.'
        : `Error (${statusCode}): ${errorDetails}`;
      
      const errorMessage = {
        role: 'bot',
        content: `Sorry, something went wrong. ${errorContent}`,
        restricted: false,
        matches: [],
        insights: [],
        result: null,
        timestamp: new Date().toLocaleTimeString(),
      };
      
      try {
        const updated = await addMessageToChat(chatId, user.id, errorMessage);
        setChats((current) =>
          current.map((c) => (c.id === chatId ? updated : c))
        );
      } catch (error) {
        console.error('[ChatbotDataset] Error adding error message:', error);
      }
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

  // Show loading state if auth is loading or chats are loading
  if (authLoading || isLoadingChats) {
    return (
      <div className="flex h-full min-h-[600px] w-full items-center justify-center bg-white dark:bg-gray-950 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
          <p className="text-sm text-gray-500">Loading chatbot...</p>
        </div>
      </div>
    );
  }

  // Show error state if not authenticated
  if (!user) {
    return (
      <div className="flex h-full min-h-[600px] w-full flex-col items-center justify-center bg-white dark:bg-gray-950 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Sign In Required</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-sm">
          Please sign in to use the dataset chatbot and access your chat history.
        </p>
      </div>
    );
  }

  if (chatsError) {
    return (
      <div className="flex h-full min-h-[600px] w-full flex-col items-center justify-center bg-white dark:bg-gray-950 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-sm">{chatsError}</p>
      </div>
    );
  }

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
                  <div className="flex items-center gap-3 min-w-0">
                    <MessageSquare className="w-4 h-4" />
                    <div className="min-w-0">
                      <div className="text-sm truncate">{chat.title || 'Untitled Chat'}</div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-400 truncate">{chat.dataset?.title || 'No dataset selected'}</div>
                    </div>
                  </div>
                  <button onClick={(event) => deleteChatHandler(chat.id, event)} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-950 transition-all"><Trash2 className="w-4 h-4" /></button>
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
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">Dataset Context</div>
            <div className="mt-3 relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={datasetQuery}
                onChange={handleDatasetQueryChange}
                onFocus={() => ensureActiveChat()}
                placeholder={`Search ${sectorTitle.toLowerCase()} datasets`}
                className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>

            {selectedDataset && (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Active dataset</div>
                <div className="mt-1 font-semibold text-gray-900 dark:text-white">{selectedDataset.title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{selectedDataset.sector || sectorTitle}</div>
              </div>
            )}

            {isSearchingDatasets && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching datasets...
              </div>
            )}

            {!isSearchingDatasets && datasetResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {datasetResults.map((dataset) => (
                  <button
                    key={dataset.id}
                    type="button"
                    onClick={() => selectDataset(dataset)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-left hover:border-black dark:border-gray-800 dark:hover:border-white"
                  >
                    <div className="font-semibold text-gray-900 dark:text-white">{dataset.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{dataset.sectorKey || dataset.sector}</div>
                  </button>
                ))}
              </div>
            )}

            {!selectedDataset && (
              <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                Select a dataset to enable mean, min, max, count, column, and trend analysis.
              </div>
            )}
          </div>

          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 text-gray-500">
              <div className="w-20 h-20 rounded-3xl bg-black text-white flex items-center justify-center"><Bot className="w-10 h-10" /></div>
              <div>
                <div className="text-3xl font-black text-gray-900 dark:text-white">Dataset Chatbot</div>
                <div className="mt-2">Select a dataset, then ask for mean, min, max, count, column details, or trend insights.</div>
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 ${message.role === 'user' ? 'bg-black text-white' : 'bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100'}`}>
                  {message.restricted && (
                    <div className="mb-3 flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/50 rounded-xl px-3 py-2 text-sm">
                      <AlertTriangle className="w-4 h-4" /> Dataset restriction active
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{stripMarkdownFormatting(message.content)}</div>
                  <StructuredResult result={message.result} />
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
              placeholder={selectedDataset ? 'Ask about the selected dataset' : 'Select a dataset to begin'}
              rows={2}
              className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 pl-4 pr-16 py-4 resize-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
            <button onClick={sendMessage} disabled={isLoading || !input.trim() || !selectedDataset} className="absolute right-3 bottom-3 p-3 rounded-xl bg-black text-white disabled:opacity-50">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
