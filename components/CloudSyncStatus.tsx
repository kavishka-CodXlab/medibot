
import React, { useState, useEffect } from 'react';
import { Cloud, Check, Loader2, AlertTriangle, Settings, LogIn, HardDriveDownload, HardDriveUpload } from 'lucide-react';
import { initGapiClient, initGisClient, handleAuthClick, handleSignoutClick, syncToDrive, restoreFromDrive, isAuthorized } from '../utils/drive';
import { AppBackupData, Language, SyncStatus } from '../types';

interface CloudSyncStatusProps {
  language: Language;
  onRestore: (data: AppBackupData) => void;
  getBackupData: () => AppBackupData;
}

const CloudSyncStatus: React.FC<CloudSyncStatusProps> = ({ language, onRestore, getBackupData }) => {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [showConfig, setShowConfig] = useState(false);
  const [clientId, setClientId] = useState(process.env.GOOGLE_CLIENT_ID || '');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    // Attempt to init if Client ID is present
    if (clientId) {
      initializeGoogle(clientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeGoogle = async (cid: string) => {
    try {
      await initGapiClient();
      initGisClient(cid);
      setIsConfigured(true);
      // Check if we are already signed in (token might be missing on refresh, requiring explicit sign in usually)
    } catch (e) {
      console.error("Failed to init Google Drive", e);
    }
  };

  const handleSignIn = async () => {
    try {
      await handleAuthClick();
      setIsSignedIn(true);
    } catch (error) {
      console.error("Sign in failed", error);
    }
  };

  const handleSyncUp = async () => {
    if (!isSignedIn) return;
    setSyncStatus('syncing');
    try {
      const data = getBackupData();
      await syncToDrive(data);
      setSyncStatus('success');
      setLastSyncTime(new Date());
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (e) {
      console.error(e);
      setSyncStatus('error');
    }
  };

  const handleSyncDown = async () => {
    if (!isSignedIn) return;
    setSyncStatus('syncing');
    try {
      const data = await restoreFromDrive();
      if (data) {
        onRestore(data);
        setSyncStatus('success');
        setLastSyncTime(new Date(data.lastSync));
      } else {
        alert(language === 'si' ? "උපස්ථ දත්ත හමු නොවීය." : "No backup found in Drive.");
        setSyncStatus('idle');
      }
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (e) {
      console.error(e);
      setSyncStatus('error');
    }
  };

  const handleConfigSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (clientId.trim()) {
      initializeGoogle(clientId);
      setShowConfig(false);
    }
  };

  // If not configured, show simple setup button
  if (!isConfigured) {
    return (
      <>
        <button 
          onClick={() => setShowConfig(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
          title={language === 'si' ? "Google Drive සකසන්න" : "Setup Cloud Sync"}
        >
          <Settings size={18} />
          <span className="hidden sm:inline">{language === 'si' ? "සැකසුම්" : "Setup Sync"}</span>
        </button>

        {showConfig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <Cloud className="text-indigo-600" />
                Google Drive Setup
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                To enable Cloud Sync, you need a Google Cloud Client ID with <code>drive.appdata</code> scope.
              </p>
              <form onSubmit={handleConfigSubmit}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Google Client ID</label>
                <input 
                  type="text" 
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="xxxx.apps.googleusercontent.com"
                  className="w-full px-3 py-2 border rounded-lg mb-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowConfig(false)} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button type="submit" className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  // Configured but not signed in
  if (!isSignedIn) {
    return (
      <button 
        onClick={handleSignIn}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
      >
        <LogIn size={18} />
        <span className="hidden sm:inline">{language === 'si' ? "ඇතුල් වන්න" : "Sign In"}</span>
      </button>
    );
  }

  // Signed in and ready
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
      <div className="px-2 flex flex-col items-end">
         <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
             {syncStatus === 'syncing' ? (language === 'si' ? "සම්බන්ධ වෙමින්..." : "Syncing...") : 
              syncStatus === 'success' ? (language === 'si' ? "සාර්ථකයි" : "Saved") : 
              syncStatus === 'error' ? (language === 'si' ? "දෝෂයකි" : "Error") : "Drive"}
         </span>
      </div>
      
      <button 
        onClick={handleSyncUp}
        disabled={syncStatus === 'syncing'}
        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-md transition-all disabled:opacity-50"
        title={language === 'si' ? "උපස්ථ කරන්න (Upload)" : "Backup to Drive"}
      >
        {syncStatus === 'syncing' ? <Loader2 size={16} className="animate-spin" /> : <HardDriveUpload size={16} />}
      </button>

      <button 
        onClick={handleSyncDown}
        disabled={syncStatus === 'syncing'}
        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-md transition-all disabled:opacity-50"
        title={language === 'si' ? "ප්‍රතිසාධනය කරන්න (Download)" : "Restore from Drive"}
      >
         <HardDriveDownload size={16} />
      </button>
    </div>
  );
};

export default CloudSyncStatus;
