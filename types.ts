
export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export type Language = 'en' | 'si';

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  image?: string; // Base64 string for user uploads
  timestamp: Date;
  isStreaming?: boolean;
  feedback?: 'up' | 'down';
}

export enum LiveStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

export interface AudioVisualizerState {
  volume: number;
}

export interface UserProfile {
  name: string;
  age: string;
  gender: string;
  medicalConditions: string;
  allergies: string;
  medications: string;
}

export interface LiveSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  transcript: {
    role: Role;
    text: string;
    timestamp: Date;
  }[];
}

export interface AppBackupData {
  userProfile: UserProfile | null;
  chatHistory: ChatMessage[];
  chatArchive: ChatMessage[];
  liveHistory: LiveSession[];
  language: Language;
  lastSync: Date;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
