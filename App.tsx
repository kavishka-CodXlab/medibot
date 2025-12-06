
import React, { useState, useEffect } from 'react';
import { MessageSquare, Mic, HeartPulse, Info, History, UserCircle2, Sun, Moon, Stethoscope } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import LiveInterface from './components/LiveInterface';
import HistoryView from './components/HistoryView';
import ProfileModal from './components/ProfileModal';

import { UserProfile, Language, AppBackupData } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'live' | 'history'>('chat');
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Load profile and language from local storage on mount
  useEffect(() => {
    const savedProfile = localStorage.getItem('medibot_user_profile');
    if (savedProfile) {
      try {
        setUserProfile(JSON.parse(savedProfile));
      } catch (e) {
        console.error("Failed to parse user profile", e);
      }
    }
    const savedLang = localStorage.getItem('medibot_language');
    if (savedLang === 'si' || savedLang === 'en') {
      setLanguage(savedLang);
    }
    const savedTheme = localStorage.getItem('medibot_theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('medibot_theme', theme);
  }, [theme]);

  const handleSaveProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem('medibot_user_profile', JSON.stringify(profile));
  };

  const handleTabChange = (tab: 'chat' | 'live' | 'history') => {
    setActiveTab(tab);
    // Proactive prompt: If accessing Live Voice and profile is incomplete (missing name), prompt user
    if (tab === 'live' && (!userProfile || !userProfile.name)) {
      setShowProfile(true);
    }
  };

  const setLanguageAndPersist = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('medibot_language', lang);
  }

  const toggleLanguage = () => {
    setLanguageAndPersist(language === 'en' ? 'si' : 'en');
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };



  // Note: In a real app, this would be handled via a secure backend or environment setup
  // For this demo, we assume the environment variable is injected.
  // Use standard Vite env var pattern
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

  if (!API_KEY) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <HeartPulse size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Configuration Error</h1>
          <p className="text-slate-600">
            API Key is missing. Please ensure <code>VITE_GEMINI_API_KEY</code> is configured correctly in your environment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-300 overflow-hidden font-sans`}>
      {/* Disclaimer Modal */}
      {showDisclaimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl transform transition-all scale-100">
            <div className="flex items-center gap-3 mb-4 text-amber-600 dark:text-amber-500">
              <Info size={28} />
              <h2 className="text-xl font-bold dark:text-white">
                {language === 'si' ? "වැදගත් වෛද්‍ය වියාචනය" : "Important Medical Disclaimer"}
              </h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              {language === 'si' ? (
                <>
                  MediBot යනු AI සහායකයෙකු වන අතර <strong>වෛද්‍යවරයෙක් නොවේ</strong>. සපයනු ලබන තොරතුරු අධ්‍යාපනික අරමුණු සඳහා පමණි.
                  <br /><br />
                  එය වෘත්තීය වෛද්‍ය උපදෙස්, රෝග විනිශ්චය හෝ ප්‍රතිකාර සඳහා ආදේශකයක් නොවේ. වෛද්‍ය තත්වයක් සම්බන්ධයෙන් ඔබට ඇති ඕනෑම ගැටළුවක් සඳහා සෑම විටම ඔබේ වෛද්‍යවරයාගේ උපදෙස් ලබා ගන්න.
                  <br /><br />
                  <strong>හදිසි වෛද්‍ය අවස්ථාවකදී, වහාම ඔබේ ප්‍රාදේශීය හදිසි ඇමතුම් සේවා (1990) අමතන්න.</strong>
                </>
              ) : (
                <>
                  MediBot is an AI assistant and <strong>not a doctor</strong>. The information provided is for educational and informational purposes only.
                  <br /><br />
                  It is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.
                  <br /><br />
                  <strong>In case of a medical emergency, call your local emergency services immediately.</strong>
                </>
              )}
            </p>
            <button
              onClick={() => setShowDisclaimer(false)}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              {language === 'si' ? "මම එකඟ වෙමි" : "I Understand"}
            </button>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      <ProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        currentProfile={userProfile}
        onSave={handleSaveProfile}
      />

      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shrink-0 transition-colors duration-300 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/30 rounded-xl flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Stethoscope size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">MediBot</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">AI Health Assistant</p>
          </div>
        </div>

        <nav className="hidden md:flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => handleTabChange('chat')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'chat'
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
          >
            <MessageSquare size={16} />
            <span>Chat</span>
          </button>
          <button
            onClick={() => handleTabChange('live')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'live'
              ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
          >
            <Mic size={16} />
            <span>Live</span>
          </button>
          <button
            onClick={() => handleTabChange('history')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'history'
              ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
          >
            <History size={16} />
            <span>History</span>
          </button>
        </nav>

        {/* Mobile Nav Only Icons */}
        <nav className="flex md:hidden bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mx-2">
          <button
            onClick={() => handleTabChange('chat')}
            className={`p-2 rounded-md transition-all ${activeTab === 'chat' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
          >
            <MessageSquare size={18} />
          </button>
          <button
            onClick={() => handleTabChange('live')}
            className={`p-2 rounded-md transition-all ${activeTab === 'live' ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm' : 'text-slate-500'}`}
          >
            <Mic size={18} />
          </button>
          <button
            onClick={() => handleTabChange('history')}
            className={`p-2 rounded-md transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm' : 'text-slate-500'}`}
          >
            <History size={18} />
          </button>
        </nav>

        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title={theme === 'light' ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setLanguageAndPersist('en')}
              className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${language === 'en' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguageAndPersist('si')}
              className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${language === 'si' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
            >
              සිං
            </button>
          </div>

          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-2 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="User Profile"
          >
            {userProfile?.name ? (
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded-full flex items-center justify-center font-bold border border-indigo-200 dark:border-indigo-800">
                {userProfile.name.charAt(0).toUpperCase()}
              </div>
            ) : (
              <UserCircle2 size={24} className="text-slate-400 dark:text-slate-500" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        {activeTab === 'chat' ? (
          <ChatInterface apiKey={API_KEY} userProfile={userProfile} language={language} />
        ) : activeTab === 'live' ? (
          <LiveInterface apiKey={API_KEY} userProfile={userProfile} language={language} />
        ) : (
          <HistoryView switchToChat={() => setActiveTab('chat')} />
        )}
      </main>
    </div>
  );
}

export default App;
