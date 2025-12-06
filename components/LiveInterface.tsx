import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Volume2, Activity, Play, ThumbsUp, ThumbsDown } from 'lucide-react';
import { MODEL_LIVE_AUDIO, getSystemInstruction } from '../constants';
import { LiveStatus, UserProfile, Role, LiveSession, Language } from '../types';
import { createPcmBlob, decodeBase64, decodeAudioData } from '../utils/audio';

interface LiveInterfaceProps {
  apiKey: string;
  userProfile?: UserProfile | null;
  language: Language;
}

const LiveInterface: React.FC<LiveInterfaceProps> = ({ apiKey, userProfile, language }) => {
  const [status, setStatus] = useState<LiveStatus>(LiveStatus.DISCONNECTED);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<'up' | 'down' | null>(null);
  const [currentSessionTranscript, setCurrentSessionTranscript] = useState<{ role: Role, text: string, timestamp: Date }[]>([]);
  const sessionStartTimeRef = useRef<Date | null>(null);

  // Audio Contexts
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);

  // Stream & Processor references
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Output Audio Queue
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Session handling
  const sessionRef = useRef<Promise<any> | null>(null);
  const activeSessionRef = useRef<boolean>(false);

  // Current turn transcription accumulator
  const currentTurnUser = useRef<string>('');
  const currentTurnModel = useRef<string>('');

  const saveSession = () => {
    if (sessionStartTimeRef.current && currentSessionTranscript.length > 0) {
      const newSession: LiveSession = {
        id: Date.now().toString(),
        startTime: sessionStartTimeRef.current,
        endTime: new Date(),
        transcript: currentSessionTranscript
      };

      const saved = localStorage.getItem('medibot_live_history');
      const history: LiveSession[] = saved ? JSON.parse(saved) : [];
      history.push(newSession);
      localStorage.setItem('medibot_live_history', JSON.stringify(history));
    }
    // Reset
    setCurrentSessionTranscript([]);
    sessionStartTimeRef.current = null;
    currentTurnUser.current = '';
    currentTurnModel.current = '';
  };

  const cleanupAudio = () => {
    // Save transcript before fully cleaning up
    if (activeSessionRef.current) {
      saveSession();
    }

    // Stop all playing sources
    audioSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { }
    });
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    // Disconnect input
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Close contexts
    if (inputContextRef.current?.state !== 'closed') {
      inputContextRef.current?.close();
    }
    if (outputContextRef.current?.state !== 'closed') {
      outputContextRef.current?.close();
    }

    activeSessionRef.current = false;
  };

  const connect = async () => {
    try {
      setStatus(LiveStatus.CONNECTING);
      setErrorMsg(null);
      setLastFeedback(null);
      setCurrentSessionTranscript([]);
      sessionStartTimeRef.current = new Date();

      // Initialize Audio Contexts
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // Get Microphone Access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey });

      // Establish Live Connection
      const sessionPromise = ai.live.connect({
        model: MODEL_LIVE_AUDIO,
        callbacks: {
          onopen: () => {
            console.log("Live session opened");
            setStatus(LiveStatus.CONNECTED);
            activeSessionRef.current = true;

            // Setup Input Stream
            if (!inputContextRef.current || !mediaStreamRef.current) return;

            const source = inputContextRef.current.createMediaStreamSource(mediaStreamRef.current);
            inputSourceRef.current = source;

            const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (!activeSessionRef.current) return;

              const inputData = e.inputBuffer.getChannelData(0);

              // Simple volume meter
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              setVolumeLevel(Math.sqrt(sum / inputData.length));

              const pcmBlob = createPcmBlob(inputData);

              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Transcription
            if (message.serverContent?.outputTranscription?.text) {
              currentTurnModel.current += message.serverContent.outputTranscription.text;
            }
            if (message.serverContent?.inputTranscription?.text) {
              currentTurnUser.current += message.serverContent.inputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              const now = new Date();
              if (currentTurnUser.current.trim()) {
                setCurrentSessionTranscript(prev => [...prev, {
                  role: Role.USER,
                  text: currentTurnUser.current.trim(),
                  timestamp: now
                }]);
                currentTurnUser.current = '';
              }
              if (currentTurnModel.current.trim()) {
                setCurrentSessionTranscript(prev => [...prev, {
                  role: Role.MODEL,
                  text: currentTurnModel.current.trim(),
                  timestamp: now
                }]);
                currentTurnModel.current = '';
              }
            }

            if (!outputContextRef.current) return;

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              setLastFeedback(null);
              const ctx = outputContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

              const audioBuffer = await decodeAudioData(
                decodeBase64(base64Audio),
                ctx,
                24000,
                1
              );

              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);

              source.addEventListener('ended', () => {
                audioSourcesRef.current.delete(source);
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              audioSourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              console.log("Interrupted!");
              audioSourcesRef.current.forEach(src => src.stop());
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              // Clear partial model transcript on interruption
              currentTurnModel.current = '';
            }
          },
          onclose: () => {
            console.log("Live session closed");
            setStatus(LiveStatus.DISCONNECTED);
            cleanupAudio();
          },
          onerror: (err) => {
            console.error("Live session error", err);
            setStatus(LiveStatus.ERROR);
            setErrorMsg("Connection error. Please try again.");
            cleanupAudio();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          // Pass language specific instruction to the model
          systemInstruction: getSystemInstruction(userProfile || undefined, language)
        }
      });

      sessionRef.current = sessionPromise;

    } catch (e) {
      console.error("Failed to connect", e);
      setStatus(LiveStatus.ERROR);
      setErrorMsg("Failed to access microphone or connect.");
      cleanupAudio();
    }
  };

  const disconnect = () => {
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => {
        try { session.close(); } catch (e) { console.error(e); }
      });
    }
    cleanupAudio();
    setStatus(LiveStatus.DISCONNECTED);
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFeedback = (type: 'up' | 'down') => {
    setLastFeedback(prev => prev === type ? null : type);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">

      {/* Visualizer / Status Area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg">
        <div className={`relative w-48 h-48 rounded-full flex items-center justify-center transition-all duration-500 ${status === LiveStatus.CONNECTED ? 'bg-teal-100 dark:bg-teal-900/30 shadow-[0_0_60px_rgba(20,184,166,0.3)]' : 'bg-slate-200 dark:bg-slate-800'
          }`}>
          {status === LiveStatus.CONNECTING && (
            <div className="absolute inset-0 rounded-full border-4 border-teal-400 border-t-transparent animate-spin" />
          )}

          {status === LiveStatus.CONNECTED ? (
            <div className="relative">
              {/* Simulated Waveform based on volume */}
              <div className="absolute inset-0 bg-teal-400 dark:bg-teal-500 rounded-full opacity-50 transition-transform duration-75"
                style={{ transform: `scale(${1 + volumeLevel * 4})` }}
              />
              <Activity size={64} className="text-teal-600 dark:text-teal-400 relative z-10" />
            </div>
          ) : (
            <Volume2 size={64} className="text-slate-400 dark:text-slate-600" />
          )}
        </div>

        <h2 className="mt-8 text-2xl font-semibold text-slate-700 dark:text-slate-200">
          {status === LiveStatus.DISCONNECTED && (language === 'si' ? "කතා කිරීමට සූදානම්" : "Ready to Talk")}
          {status === LiveStatus.CONNECTING && (language === 'si' ? "සම්බන්ධ වෙමින්..." : "Connecting...")}
          {status === LiveStatus.CONNECTED && (language === 'si' ? "සවන් දෙමින්..." : "Listening...")}
          {status === LiveStatus.ERROR && (language === 'si' ? "සම්බන්ධතාවය අසාර්ථක විය" : "Connection Failed")}
        </h2>

        {errorMsg && (
          <p className="mt-2 text-red-500 text-sm">{errorMsg}</p>
        )}

        <p className="mt-4 text-center text-slate-500 dark:text-slate-400 max-w-xs">
          {status === LiveStatus.CONNECTED
            ? (language === 'si' ? "ස්වාභාවිකව කතා කරන්න. සැසිය අවසන් කිරීමට පහළ බොත්තම ඔබන්න." : "Speak naturally. Tap the button below to end the session.")
            : (language === 'si' ? "MediBot සමඟ සජීවීව කතා කිරීමට අරඹන්න." : "Start a real-time voice conversation with MediBot for hands-free assistance.")}
        </p>

        {/* Feedback Controls for Live Mode */}
        {status === LiveStatus.CONNECTED && (
          <div className="mt-8 flex items-center gap-4 animate-fade-in">
            <span className="text-sm text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">
              {language === 'si' ? "ප්‍රතිචාරය ශ්‍රේණිගත කරන්න" : "Rate last response"}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleFeedback('up')}
                className={`p-2 rounded-full transition-all ${lastFeedback === 'up'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 scale-110'
                    : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-green-600 shadow-sm'
                  }`}
              >
                <ThumbsUp size={20} />
              </button>
              <button
                onClick={() => handleFeedback('down')}
                className={`p-2 rounded-full transition-all ${lastFeedback === 'down'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-500 scale-110'
                    : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 shadow-sm'
                  }`}
              >
                <ThumbsDown size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mb-12">
        {status === LiveStatus.CONNECTED ? (
          <button
            onClick={disconnect}
            className="flex items-center gap-3 px-8 py-4 bg-red-500 hover:bg-red-600 text-white rounded-full font-semibold shadow-lg transition-transform hover:scale-105"
          >
            <MicOff size={24} />
            {language === 'si' ? "ඇමතුම අවසන් කරන්න" : "End Call"}
          </button>
        ) : (
          <button
            onClick={connect}
            disabled={status === LiveStatus.CONNECTING}
            className="flex items-center gap-3 px-8 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-full font-semibold shadow-lg shadow-teal-200 dark:shadow-none transition-transform hover:scale-105 disabled:opacity-70 disabled:scale-100"
          >
            {status === LiveStatus.CONNECTING ? <Activity size={24} className="animate-pulse" /> : <Mic size={24} />}
            {language === 'si' ? "හඬ සංවාදය අරඹන්න" : "Start Voice Chat"}
          </button>
        )}
      </div>
    </div>
  );
};

export default LiveInterface;