import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse, Content, Part } from "@google/genai";
import { Send, Image as ImageIcon, Loader2, User, Bot, AlertTriangle, Trash2, Mic, Square, ThumbsUp, ThumbsDown, Phone, Plus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, Role, UserProfile, Language } from '../types';
import { MODEL_TEXT_IMAGE, getSystemInstruction } from '../constants';
import { fileToGenerativePart } from '../utils/audio';

interface ChatInterfaceProps {
  apiKey: string;
  userProfile?: UserProfile | null;
  language: Language;
}

// Augment window for SpeechRecognition support
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const CRITICAL_KEYWORDS_EN = [
  /chest\s+(pain|pressure|tightness)/i,
  /heart\s+attack/i,
  /difficulty\s+breathing/i,
  /shortness\s+of\s+breath/i,
  /can'?t\s+breathe/i,
  /struggling\s+to\s+breathe/i,
  /severe\s+bleeding/i,
  /stroke/i,
  /facial\s+droop/i,
  /numbness\s+in\s+arm/i,
  /slurred\s+speech/i,
  /loss\s+of\s+consciousness/i,
  /passed\s+out/i,
  /fainted/i,
  /coughing\s+(up\s+)?blood/i,
  /blue\s+lips/i,
  /severe\s+head\s+injury/i,
  /suicide/i,
  /kill\s+myself/i,
  /overdose/i,
  /call\s+911/i
];

const CRITICAL_KEYWORDS_SI = [
  /පපුවේ\s+(වේදනාව|රිදීම|කැක්කුම)/i, // Chest pain
  /හෘදයාබාධ/i, // Heart attack
  /හුස්ම\s+ගැනීමේ\s+අපහසුව/i, // Difficulty breathing
  /හුස්ම\s+හිරවීම/i, // Shortness of breath
  /සිහිසුන්/i, // Unconscious
  /ලේ\s+ගැලීම/i, // Bleeding
  /අංශභාගය/i, // Stroke
  /වස\s+පානය/i, // Poison/Overdose
  /සියදිවි/i, // Suicide
  /ගිලන්\s+රථය/i // Ambulance
];

const checkForCriticalSymptoms = (text: string): boolean => {
  return [...CRITICAL_KEYWORDS_EN, ...CRITICAL_KEYWORDS_SI].some(regex => regex.test(text));
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ apiKey, userProfile, language }) => {
  // Load initial state from local storage
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('medibot_chat_history');
      if (saved) {
        try {
          // Parse and restore Date objects
          return JSON.parse(saved, (key, value) =>
            key === 'timestamp' ? new Date(value) : value
          );
        } catch (e) {
          console.error("Failed to parse chat history", e);
        }
      }
    }
    return [];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatSessionRef = useRef<Chat | null>(null);
  const recognitionRef = useRef<any>(null);
  const originalInputRef = useRef<string>(''); // To store input before dictation starts
  const isTogglingRef = useRef(false); // Lock to prevent rapid clicks
  const isStoppingRef = useRef(false); // Lock to ignore errors during intentional stop
  const isMountedRef = useRef(true);

  // Check if current history contains a critical emergency alert
  const isEmergency = messages.some(m => m.role === Role.SYSTEM && m.text.includes("EMERGENCY ALERT"));

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Save to local storage whenever messages change
  useEffect(() => {
    localStorage.setItem('medibot_chat_history', JSON.stringify(messages));
  }, [messages]);

  // Initialize or Re-initialize Chat Session when apiKey, userProfile, or language changes
  useEffect(() => {
    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });

      // Reconstruct history from saved messages for the model context
      const history: Content[] = messages
        .filter(m => (m.role === Role.USER || m.role === Role.MODEL) && !m.isStreaming)
        .map(m => {
          const parts: Part[] = [];
          if (m.image) {
            parts.push({
              inlineData: {
                data: m.image,
                mimeType: 'image/jpeg'
              }
            });
          }
          if (m.text) {
            parts.push({ text: m.text });
          }
          return {
            role: m.role === Role.USER ? 'user' : 'model',
            parts: parts
          };
        });

      // Update chat session with new system instruction containing profile and language
      chatSessionRef.current = ai.chats.create({
        model: MODEL_TEXT_IMAGE,
        config: {
          systemInstruction: getSystemInstruction(userProfile || undefined, language),
        },
        history: history
      });

      // Update welcome message if it exists (id 'init') to match new language
      setMessages(prev => {
        const hasInit = prev.some(m => m.id === 'init');
        const welcomeText = language === 'si'
          ? "ආයුබෝවන්, මම MediBot. මට ඔබගේ රෝග ලක්ෂණ හෝ සෞඛ්‍ය තොරතුරු ගැන කතා කළ හැකිය. \n\n*මම වෛද්‍යවරයෙක් නොවේ. හදිසි අවස්ථාවකදී වහාම රෝහලක් වෙත යන්න.*"
          : "Hello, I'm MediBot. I can help you understand symptoms or general health information. \n\n*Please note: I am an AI, not a doctor. In emergencies, call your local emergency number immediately.*";

        if (prev.length === 0) {
          return [{
            id: 'init',
            role: Role.MODEL,
            text: welcomeText,
            timestamp: new Date()
          }];
        } else if (hasInit) {
          // If first message is our init message, update its text
          return prev.map(m => m.id === 'init' ? { ...m, text: welcomeText } : m);
        }
        return prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, userProfile, language]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) { }
      }
    };
  }, []);

  const handleNewChat = () => {
    const confirmMsg = language === 'si'
      ? "ඔබට නව සංවාදයක් ආරම්භ කිරීමට අවශ්‍යද? වත්මන් සංවාදය ඉතිහාසයේ සුරකිනු ඇත."
      : "Start a new chat? Current conversation will be saved to history.";

    if (window.confirm(confirmMsg)) {
      // Archive current chat
      const savedArchive = localStorage.getItem('medibot_chat_archive');
      let archive: ChatMessage[] = [];
      if (savedArchive) {
        try {
          archive = JSON.parse(savedArchive, (key, value) =>
            key === 'timestamp' ? new Date(value) : value
          );
        } catch (e) { }
      }

      // Filter out 'init' messages to avoid cluttering the archive with "Hello I'm MediBot"
      const currentToArchive = messages.filter(m => m.id !== 'init');
      const newArchive = [...archive, ...currentToArchive];
      localStorage.setItem('medibot_chat_archive', JSON.stringify(newArchive));

      // Reset active chat
      const welcomeText = language === 'si'
        ? "ආයුබෝවන්, මම MediBot. මට ඔබගේ රෝග ලක්ෂණ හෝ සෞඛ්‍ය තොරතුරු ගැන කතා කළ හැකිය. \n\n*මම වෛද්‍යවරයෙක් නොවේ. හදිසි අවස්ථාවකදී වහාම රෝහලක් වෙත යන්න.*"
        : "Hello, I'm MediBot. I can help you understand symptoms or general health information. \n\n*Please note: I am an AI, not a doctor. In emergencies, call your local emergency number immediately.*";

      const newInit: ChatMessage = {
        id: 'init',
        role: Role.MODEL,
        text: welcomeText,
        timestamp: new Date()
      };

      setMessages([newInit]);
      localStorage.setItem('medibot_chat_history', JSON.stringify([newInit]));

      // Reset Chat Session
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        chatSessionRef.current = ai.chats.create({
          model: MODEL_TEXT_IMAGE,
          config: { systemInstruction: getSystemInstruction(userProfile || undefined, language) }
        });
      }
    }
  };

  const clearHistory = () => {
    const confirmMsg = language === 'si'
      ? "මෙම සංවාදය මකා දැමීමට ඔබට විශ්වාසද?"
      : "Are you sure you want to clear this conversation?";

    if (window.confirm(confirmMsg)) {
      setMessages([]);
      localStorage.removeItem('medibot_chat_history');

      // Reset chat session
      if (chatSessionRef.current && apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        chatSessionRef.current = ai.chats.create({
          model: MODEL_TEXT_IMAGE,
          config: { systemInstruction: getSystemInstruction(userProfile || undefined, language) }
        });
      }

      // Restore welcome message
      const welcomeText = language === 'si'
        ? "ඉතිහාසය මකා දමන ලදී. මම ඔබට කෙසේ උදව් කළ හැකිද?"
        : "History cleared. How can I help you today?";

      setMessages([{
        id: Date.now().toString(),
        role: Role.MODEL,
        text: welcomeText,
        timestamp: new Date()
      }]);
    }
  };

  const handleFeedback = (messageId: string, type: 'up' | 'down') => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        // Toggle if clicking the same rating again
        if (msg.feedback === type) {
          const { feedback, ...rest } = msg;
          return rest;
        }
        return { ...msg, feedback: type };
      }
      return msg;
    }));
  };

  const toggleVoiceInput = () => {
    if (isTogglingRef.current) return;
    setSpeechError(null);
    isTogglingRef.current = true;

    // --- STOP Logic ---
    if (isListening) {
      isStoppingRef.current = true; // Mark as intentional stop
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {
          try { recognitionRef.current.abort(); } catch (z) { }
        }
      }
      // Set a cooldown before allowing restart to prevent "service-not-allowed"
      setTimeout(() => { isTogglingRef.current = false; }, 800);
      return;
    }

    // --- START Logic ---

    // 1. Cleanup any ghost instances strictly
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) { }
      recognitionRef.current = null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const msg = language === 'si'
        ? "ඔබේ බ්‍රව්සරය හඬ ආදානය සදහා සහය නොදක්වයි."
        : "Your browser does not support voice input. Please try Chrome.";
      alert(msg);
      isTogglingRef.current = false;
      return;
    }

    // 2. Cooldown delay to allow browser service to reset
    setTimeout(() => {
      if (!isMountedRef.current) {
        isTogglingRef.current = false;
        return;
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.lang = language === 'si' ? 'si-LK' : 'en-US';
        recognition.continuous = false; // Keep false for robustness
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          if (isMountedRef.current) {
            setIsListening(true);
            isStoppingRef.current = false; // Reset stop flag
            originalInputRef.current = input;
            // Unlock toggle immediately after start allows user to stop quickly
            isTogglingRef.current = false;
          }
        };

        recognition.onend = () => {
          if (isMountedRef.current) {
            setIsListening(false);
            recognitionRef.current = null;
            isTogglingRef.current = false;
          }
        };

        recognition.onerror = (event: any) => {
          // Ignore intentional stops or aborts to avoid user confusion
          if (event.error === 'aborted' || isStoppingRef.current) {
            console.log("Speech recognition aborted/stopped intentionally.");
            if (isMountedRef.current) {
              setIsListening(false);
              isTogglingRef.current = false;
            }
            return;
          }

          console.error("Speech recognition error", event.error);

          if (isMountedRef.current) {
            // Clean up state
            setIsListening(false);
            isTogglingRef.current = false;

            if (event.error === 'no-speech') return; // Ignore no-speech

            let errorMsg = "Error: " + event.error;
            if (event.error === 'service-not-allowed') {
              errorMsg = language === 'si'
                ? "හඬ සේවාව කාර්යබහුලයි. කරුණාකර තත්පර කිහිපයක් රැඳී සිට නැවත උත්සාහ කරන්න."
                : "Voice service busy. Please wait a few seconds.";
            } else if (event.error === 'not-allowed') {
              errorMsg = language === 'si'
                ? "මයික්‍රොෆෝනයට ප්‍රවේශය ප්‍රතික්ෂේප විය."
                : "Microphone access denied.";
            } else if (event.error === 'network') {
              errorMsg = language === 'si' ? "ජාල දෝෂයකි." : "Network error.";
            }

            setSpeechError(errorMsg);
          }
        };

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          const prefix = originalInputRef.current ? originalInputRef.current + ' ' : '';
          if (isMountedRef.current) {
            setInput(prefix + currentTranscript);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();

      } catch (e) {
        console.error("Failed to start speech recognition", e);
        if (isMountedRef.current) {
          setIsListening(false);
          isTogglingRef.current = false;
          setSpeechError("Could not start voice input.");
        }
      }
    }, 600); // 600ms Safety delay
  };

  const handleSend = async () => {
    // If listening, stop first and clean up
    if (isListening) {
      isStoppingRef.current = true; // Mark as intentional stop
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { }
      }
      setIsListening(false);
      // Wait for speech service to wind down
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if ((!input.trim() && !selectedImage) || isLoading || !chatSessionRef.current) return;

    const userMessageId = Date.now().toString();
    const newUserMessage: ChatMessage = {
      id: userMessageId,
      role: Role.USER,
      text: input,
      timestamp: new Date(),
    };

    if (selectedImage) {
      const base64 = await fileToGenerativePart(selectedImage);
      newUserMessage.image = base64;
    }

    // Critical Symptom Detection Logic
    if (input.trim() && checkForCriticalSymptoms(input)) {
      // Add user message first
      setMessages(prev => [...prev, newUserMessage]);

      // Add Emergency Alert immediately without calling AI
      const alertText = language === 'si'
        ? "### 🚨 හදිසි අවස්ථාවක් හඳුනා ගන්නා ලදී\n\nඔබ ජීවිතයට තර්ජනයක් විය හැකි රෝග ලක්ෂණ විස්තර කර ඇත.\n\n**කරුණාකර වහාම ක්‍රියා කරන්න:**\n1. **හදිසි ඇමතුම් සේවා (1990 හෝ 911) අමතන්න.**\n2. **ළඟම ඇති රෝහලට යන්න.**\n3. **මෙම අවස්ථාවේදී AI මත රඳා නොසිටින්න.**"
        : "### 🚨 EMERGENCY ALERT DETECTED\n\nYou have described symptoms that may indicate a life-threatening medical emergency.\n\n**PLEASE ACTION IMMEDIATELY:**\n1. **Call Emergency Services (e.g., 911) right now.**\n2. **Go to the nearest emergency room.**\n3. **Do not rely on this AI or any software for this situation.**\n\nI have stopped processing this request to prioritize your safety.";

      const emergencyMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: Role.SYSTEM,
        text: alertText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, emergencyMessage]);
      setInput('');
      originalInputRef.current = '';
      setSelectedImage(null);
      return; // STOP EXECUTION
    }

    setMessages(prev => [...prev, newUserMessage]);
    setInput('');
    originalInputRef.current = '';
    const currentImage = selectedImage;
    setSelectedImage(null); // Clear image immediately after sending
    setIsLoading(true);

    try {
      const botMessageId = (Date.now() + 1).toString();
      // Add placeholder bot message with isStreaming for the typing indicator
      setMessages(prev => [...prev, {
        id: botMessageId,
        role: Role.MODEL,
        text: '',
        timestamp: new Date(),
        isStreaming: true
      }]);

      let fullResponseText = '';

      let streamResult;

      if (currentImage) {
        const imageBase64 = await fileToGenerativePart(currentImage);
        const parts: any[] = [];
        parts.push({
          inlineData: {
            data: imageBase64,
            mimeType: currentImage.type
          }
        });
        if (input.trim()) {
          parts.push({ text: input });
        }

        streamResult = await chatSessionRef.current.sendMessageStream({
          message: { parts } as any
        });

      } else {
        streamResult = await chatSessionRef.current.sendMessageStream({ message: input });
      }

      for await (const chunk of streamResult) {
        const c = chunk as GenerateContentResponse;
        const text = c.text;
        if (text) {
          fullResponseText += text;
          setMessages(prev => prev.map(msg =>
            msg.id === botMessageId
              ? { ...msg, text: fullResponseText }
              : msg
          ));
        }
      }

      setMessages(prev => prev.map(msg =>
        msg.id === botMessageId
          ? { ...msg, isStreaming: false }
          : msg
      ));

    } catch (error) {
      console.error("Error sending message:", error);
      const errorText = language === 'si'
        ? "සමාවන්න, මට දෝෂයක් ඇති විය. කරුණාකර නැවත උත්සාහ කරන්න."
        : "I apologize, but I encountered an error processing your request. Please try again.";

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: Role.SYSTEM,
        text: errorText,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative">
      {/* Top Bar for Chat Controls */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
        {/* New Chat Button */}
        <button
          onClick={handleNewChat}
          title={language === 'si' ? "නව සංවාදයක් (New Chat)" : "New Chat"}
          className="p-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
        >
          <Plus size={20} />
        </button>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1"></div>

        {/* Clear Current Chat Button */}
        <button
          onClick={clearHistory}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          title={language === 'si' ? "වත්මන් සංවාදය මකන්න" : "Clear Current Chat"}
        >
          <Trash2 size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide pt-12">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${msg.role === Role.USER ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[85%] md:max-w-[70%] ${msg.role === Role.USER ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
              {/* Avatar */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === Role.USER ? 'bg-indigo-600' :
                msg.role === Role.SYSTEM ? 'bg-red-500' : 'bg-teal-600'
                }`}>
                {msg.role === Role.USER ? <User size={16} className="text-white" /> :
                  msg.role === Role.SYSTEM ? <AlertTriangle size={16} className="text-white" /> :
                    <Bot size={16} className="text-white" />}
              </div>

              {/* Message Body */}
              <div className={`flex flex-col space-y-2 ${msg.role === Role.USER ? 'items-end' : 'items-start'}`}>
                <div className={`p-4 rounded-2xl shadow-sm ${msg.role === Role.USER
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : msg.role === Role.SYSTEM
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200 border border-red-200 dark:border-red-800'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none'
                  }`}>
                  {msg.image && (
                    <div className="mb-3">
                      <img
                        src={`data:image/jpeg;base64,${msg.image}`}
                        alt="Uploaded context"
                        className="max-h-48 rounded-lg object-cover"
                      />
                    </div>
                  )}
                  {/* Content or Typing Indicator */}
                  {msg.text ? (
                    <div className={`prose prose-sm max-w-none ${msg.role === Role.USER ? 'prose-invert' : 'prose-slate dark:prose-invert'}`}>
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  ) : msg.isStreaming ? (
                    <div className="flex space-x-1.5 h-5 items-center px-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  ) : null}
                </div>

                {/* Feedback Controls for Model Messages */}
                {msg.role === Role.MODEL && !msg.isStreaming && (
                  <div className="flex items-center gap-2 mt-1 px-1">
                    <button
                      onClick={() => handleFeedback(msg.id, 'up')}
                      className={`p-1.5 rounded-full transition-colors ${msg.feedback === 'up'
                        ? 'text-green-600 bg-green-50 dark:bg-green-900/20'
                        : 'text-slate-400 hover:text-green-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      title="Helpful"
                    >
                      <ThumbsUp size={14} />
                    </button>
                    <button
                      onClick={() => handleFeedback(msg.id, 'down')}
                      className={`p-1.5 rounded-full transition-colors ${msg.feedback === 'down'
                        ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      title="Not helpful"
                    >
                      <ThumbsDown size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Persistent Emergency Banner */}
      {isEmergency && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 border-t border-red-200 dark:border-red-800 flex justify-center animate-in slide-in-from-bottom-5 fade-in duration-300">
          <a
            href="tel:911"
            className="flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-red-200 dark:shadow-none transition-transform hover:scale-105 text-center"
          >
            <Phone size={20} className="animate-pulse" />
            {language === 'si' ? "1990 අමතන්න (Call 1990)" : "Call 911 Immediately"}
          </a>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        {selectedImage && (
          <div className="flex items-center gap-2 mb-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg w-fit border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{selectedImage.name}</span>
            <button
              onClick={() => setSelectedImage(null)}
              className="text-slate-400 hover:text-red-500"
            >
              ×
            </button>
          </div>
        )}

        {speechError && (
          <div className="mb-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-lg flex items-center gap-2 max-w-fit animate-pulse">
            <AlertTriangle size={12} />
            {speechError}
          </div>
        )}

        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`p-3 rounded-full transition-colors ${selectedImage ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            title="Upload image"
          >
            <ImageIcon size={20} />
          </button>

          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={language === 'si' ? "මෙහි ටයිප් කරන්න..." : "Type a message..."}
              className="w-full pl-4 pr-20 py-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border-0 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all resize-none max-h-32 min-h-[48px] placeholder:text-slate-400"
              rows={1}
              style={{ minHeight: '48px' }}
            />

            <div className="absolute right-2 top-1.5 flex items-center gap-1">
              <button
                onClick={toggleVoiceInput}
                className={`p-2 rounded-xl transition-all ${isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                title={isListening ? "Stop recording" : "Start recording"}
              >
                {isListening ? <Square size={18} fill="currentColor" /> : <Mic size={18} />}
              </button>

              <button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !selectedImage)}
                className="p-2 bg-indigo-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;