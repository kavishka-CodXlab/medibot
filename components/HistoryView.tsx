import React, { useState, useEffect } from 'react';
import { MessageSquare, Mic, Calendar, Clock, ChevronRight, ChevronDown, User, Bot, Trash2 } from 'lucide-react';
import { ChatMessage, LiveSession, Role } from '../types';

interface HistoryViewProps {
  switchToChat: () => void;
}

type Tab = 'chat' | 'live';

const HistoryView: React.FC<HistoryViewProps> = ({ switchToChat }) => {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [liveHistory, setLiveHistory] = useState<LiveSession[]>([]);
  const [expandedLiveId, setExpandedLiveId] = useState<string | null>(null);

  useEffect(() => {
    // Load Chat History (Active + Archived)
    let allMessages: ChatMessage[] = [];

    // 1. Archive
    const savedArchive = localStorage.getItem('medibot_chat_archive');
    if (savedArchive) {
      try {
        const archive = JSON.parse(savedArchive, (key, value) =>
          key === 'timestamp' ? new Date(value) : value
        );
        allMessages = [...allMessages, ...archive];
      } catch (e) { console.error("Error parsing archive", e); }
    }

    // 2. Active Session
    const savedActive = localStorage.getItem('medibot_chat_history');
    if (savedActive) {
      try {
        const active = JSON.parse(savedActive, (key, value) =>
          key === 'timestamp' ? new Date(value) : value
        );
        // Deduplicate just in case, though usually not needed if logic is correct
        allMessages = [...allMessages, ...active];
      } catch (e) { console.error("Error parsing active history", e); }
    }

    // Sort by timestamp descending
    allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setChatHistory(allMessages);

    // Load Live History
    const savedLive = localStorage.getItem('medibot_live_history');
    if (savedLive) {
      try {
        setLiveHistory(JSON.parse(savedLive, (key, value) =>
          key === 'timestamp' || key === 'startTime' || key === 'endTime' ? new Date(value) : value
        ));
      } catch (e) { console.error(e); }
    }
  }, []);

  const clearLiveHistory = () => {
    if (confirm('Clear all voice session history?')) {
      localStorage.removeItem('medibot_live_history');
      setLiveHistory([]);
    }
  };

  const clearChatArchive = () => {
    if (confirm('Clear all archived chat logs? This will not affect your current active chat.')) {
      localStorage.removeItem('medibot_chat_archive');
      // Reload only active
      const savedActive = localStorage.getItem('medibot_chat_history');
      let active: ChatMessage[] = [];
      if (savedActive) {
        try {
          active = JSON.parse(savedActive, (key, value) =>
            key === 'timestamp' ? new Date(value) : value
          );
        } catch (e) { }
      }
      active.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setChatHistory(active);
    }
  };

  // Group chat messages by date
  const groupedChat = chatHistory.reduce((acc, msg) => {
    const date = new Date(msg.timestamp).toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {} as Record<string, ChatMessage[]>);

  // Since we sorted desc for the whole list, the groups will be roughly desc date order.
  // But inside the group, messages might be reversed (desc). Usually chat log is ASC (oldest first).
  // Let's re-sort messages inside each group to be Ascending (old -> new) for readability.
  Object.keys(groupedChat).forEach(date => {
    groupedChat[date].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Sub-header Tabs */}
      <div className="flex items-center justify-center p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'chat' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
          >
            <MessageSquare size={16} />
            Chat Log
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'live' ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
          >
            <Mic size={16} />
            Voice Sessions
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-4xl mx-auto w-full">
        {activeTab === 'chat' && (
          <div className="space-y-8">
            {Object.keys(groupedChat).length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                <p>No chat history available.</p>
                <button onClick={switchToChat} className="mt-4 text-indigo-600 font-medium hover:underline">Start a chat</button>
              </div>
            ) : (
              <>
                <div className="flex justify-end mb-2">
                  <button onClick={clearChatArchive} className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 flex items-center gap-1">
                    <Trash2 size={12} /> Clear Archived Logs
                  </button>
                </div>
                {/* Render dates */}
                {Object.entries(groupedChat).map(([date, messages]) => (
                  <div key={date} className="animate-fade-in">
                    <div className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm z-10 py-2 mb-4 flex items-center justify-center">
                      <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide">
                        {date}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === Role.USER ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-2xl p-4 text-sm ${msg.role === Role.USER
                              ? 'bg-indigo-600 text-white rounded-tr-none'
                              : msg.role === Role.SYSTEM
                                ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-tl-none'
                            }`}>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            <span className={`text-[10px] mt-2 block opacity-70 ${msg.role === Role.USER ? 'text-indigo-200' : 'text-slate-400'}`}>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === 'live' && (
          <div className="space-y-4">
            {liveHistory.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <Mic size={48} className="mx-auto mb-4 opacity-50" />
                <p>No voice sessions recorded.</p>
              </div>
            ) : (
              <>
                <div className="flex justify-end mb-2">
                  <button onClick={clearLiveHistory} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                    <Trash2 size={12} /> Clear Log
                  </button>
                </div>
                {liveHistory.slice().reverse().map((session) => (
                  <div key={session.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <button
                      onClick={() => setExpandedLiveId(expandedLiveId === session.id ? null : session.id)}
                      className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
                          <Mic size={20} />
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            Session on {new Date(session.startTime).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                            <span className="flex items-center gap-1"><Clock size={12} /> {new Date(session.startTime).toLocaleTimeString()}</span>
                            <span>•</span>
                            <span>{session.transcript.length} turns</span>
                          </div>
                        </div>
                      </div>
                      {expandedLiveId === session.id ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
                    </button>

                    {expandedLiveId === session.id && (
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 space-y-3">
                        {session.transcript.length === 0 ? (
                          <p className="text-sm text-slate-400 italic text-center">No transcript available for this session.</p>
                        ) : (
                          session.transcript.map((t, idx) => (
                            <div key={idx} className={`flex gap-3 ${t.role === Role.USER ? 'flex-row-reverse' : ''}`}>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${t.role === Role.USER ? 'bg-indigo-600' : 'bg-teal-600'}`}>
                                {t.role === Role.USER ? <User size={12} className="text-white" /> : <Bot size={12} className="text-white" />}
                              </div>
                              <div className={`p-3 rounded-lg text-sm max-w-[80%] ${t.role === Role.USER ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-200' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                                }`}>
                                {t.text}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;