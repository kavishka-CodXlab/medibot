
import { AppBackupData } from '../types';

// Constants
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'medibot_backup.json';

// Extend the Window interface to include Google API properties
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

// Initialize the Google API Client
export async function initGapiClient() {
  await new Promise<void>((resolve, reject) => {
    window.gapi.load('client', { callback: resolve, onerror: reject });
  });
  await window.gapi.client.init({
    discoveryDocs: [DISCOVERY_DOC],
  });
  gapiInited = true;
}

// Initialize the Google Identity Services Client
export function initGisClient(clientId: string) {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: '', // defined at request time
  });
  gisInited = true;
  return true;
}

// Check if authorized
export function isAuthorized(): boolean {
  return window.gapi.client.getToken() !== null;
}

// Trigger Sign In flow
export async function handleAuthClick(): Promise<void> {
  if (!tokenClient) throw new Error("Google Identity Client not initialized");
  
  return new Promise((resolve, reject) => {
    tokenClient.callback = async (resp: any) => {
      if (resp.error) {
        reject(resp);
      }
      resolve();
    };

    if (window.gapi.client.getToken() === null) {
      // Prompt the user to select a Google Account and ask for consent to share their data
      // when establishing a new session.
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      // Skip display of account chooser and consent dialog for an existing session.
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
}

// Sign Out
export function handleSignoutClick() {
  const token = window.gapi.client.getToken();
  if (token !== null) {
    window.google.accounts.oauth2.revoke(token.access_token);
    window.gapi.client.setToken(null);
  }
}

// --- Drive Operations ---

// 1. Find the backup file in AppData folder
async function findBackupFileId(): Promise<string | null> {
  try {
    const response = await window.gapi.client.drive.files.list({
      spaces: 'appDataFolder',
      q: `name = '${FILE_NAME}' and trashed = false`,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 1,
    });
    const files = response.result.files;
    if (files && files.length > 0) {
      return files[0].id;
    }
    return null;
  } catch (err) {
    console.error('Error finding file', err);
    throw err;
  }
}

// 2. Upload Data (Create or Update)
export async function syncToDrive(data: AppBackupData): Promise<void> {
  if (!gapiInited || !gisInited) throw new Error("Google API not initialized");

  const fileContent = JSON.stringify(data);
  const fileId = await findBackupFileId();

  const fileMetadata = {
    name: FILE_NAME,
    mimeType: 'application/json',
    parents: ['appDataFolder'] // Save to hidden AppData folder
  };

  if (fileId) {
    // Update existing file
    await window.gapi.client.request({
      path: `/upload/drive/v3/files/${fileId}`,
      method: 'PATCH',
      params: { uploadType: 'media' },
      body: fileContent
    });
  } else {
    // Create new file
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
    form.append('file', new Blob([fileContent], { type: 'application/json' }));

    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: new Headers({ 'Authorization': 'Bearer ' + window.gapi.client.getToken().access_token }),
      body: form
    });
  }
}

// 3. Download Data
export async function restoreFromDrive(): Promise<AppBackupData | null> {
  if (!gapiInited || !gisInited) throw new Error("Google API not initialized");

  const fileId = await findBackupFileId();
  if (!fileId) return null;

  const response = await window.gapi.client.drive.files.get({
    fileId: fileId,
    alt: 'media',
  });

  // The result is the JSON object
  return response.result as AppBackupData;
}
