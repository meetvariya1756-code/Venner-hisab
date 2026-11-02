import { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  X,
  Maximize2,
  Minimize2,
  Sparkles,
  ChevronRight,
  Mic,
  MicOff,
  Trash2,
  Building
} from 'lucide-react';
import { api } from '../../api/client';
import type { AiChatResponse, AiQuickAction, AiClarificationOption } from '../../types';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  payload?: AiChatResponse;
  isTyping?: boolean;
}

interface AiAssistantChatProps {
  onNavigateToKhatabook?: (accountId?: number) => void;
  onNavigateToSummary?: (accountId?: number) => void;
}

export function AiAssistantChat({ onNavigateToKhatabook, onNavigateToSummary }: AiAssistantChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: '🙏 **નમસ્તે! Welcome to Venner Hisab AI Assistant.**\n\nહું તમને **English, Gujarati (ગુજરાતી), Hinglish અથવા Gujlish** માં હિસાબ અને ખાતાવહી સમજવામાં મદદ કરી શકું છું.\n\n*દા.ત. તમે પૂછી શકો છો:* \n• "Mane FABREECART Account ni details janvi chhe"\n• "FABREECART ma ketla baki chhe?"\n• "Badha accounts no total hisab aapo"',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const speechRecognitionRef = useRef<any>(null);

  // ── Load dynamic suggestions ──────────────────────────────
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const data = await api.getChatSuggestions();
        if (data && data.suggestions) {
          setSuggestions(data.suggestions);
        }
      } catch (err) {
        // Fallback default suggestions
        setSuggestions([
          'Mane FABREECART Account ni details janvi chhe',
          'FABREECART ma ketla baki chhe?',
          'Badha accounts no total hisab aapo',
          'FABREECART nu PDF statement joiye'
        ]);
      }
    };
    loadSuggestions();
  }, []);

  // ── Auto scroll to bottom ──────────────────────────────
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // ── Focus input when opened ───────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // ── Initialize Speech Recognition ─────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'gu-IN'; // Gujarati default (also recognizes Gujlish/English)

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInputMessage(transcript);
          }
          setIsListening(false);
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        speechRecognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!speechRecognitionRef.current) {
      alert('Voice recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      speechRecognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        speechRecognitionRef.current.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

  // ── Send Message ──────────────────────────────────────────
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const res = await api.sendChatMessage(query);

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        payload: res
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: `⚠️ ક્ષમા કરશો, વિનંતી પૂર્ણ કરવામાં ક્ષતિ આવી છે (${err.message || 'Network error'}). ફરી પ્રયાસ કરો.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Handle Action Trigger ─────────────────────────────────
  const handleActionClick = async (action: AiQuickAction) => {
    if (action.action === 'download_pdf' && action.accountId) {
      try {
        await api.downloadKhatabookPDF({
          accountId: action.accountId,
          periodType: 'month',
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1
        });
      } catch (e: any) {
        alert(e.message || 'Failed to download PDF');
      }
    } else if (action.action === 'download_all_pdf') {
      try {
        await api.downloadKhatabookPDF({
          accountId: null,
          periodType: 'month',
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1
        });
      } catch (e: any) {
        alert(e.message || 'Failed to download PDF');
      }
    } else if (action.action === 'whatsapp_reminder' && action.accountName) {
      handleSendMessage(`${action.accountName} nu WhatsApp payment reminder aapo`);
    } else if (action.action === 'show_entries' && action.accountName) {
      handleSendMessage(`${action.accountName} ni chhella 5 entries jovi chhe`);
    } else if (action.action === 'show_balance' && action.accountName) {
      handleSendMessage(`${action.accountName} ma ketla baki chhe?`);
    } else if (action.action === 'open_khatabook') {
      if (onNavigateToKhatabook) {
        onNavigateToKhatabook(action.accountId);
        setIsOpen(false);
      } else {
        window.location.hash = '#khatabook';
      }
    } else if (action.action === 'open_summary') {
      if (onNavigateToSummary) {
        onNavigateToSummary(action.accountId);
        setIsOpen(false);
      }
    } else {
      handleSendMessage(action.label);
    }
  };

  const handleClarificationClick = (option: AiClarificationOption) => {
    handleSendMessage(`Mane ${option.name} Account ni details janvi chhe`);
  };

  const handleClearChat = () => {
    if (window.confirm('Clear conversation history?')) {
      setMessages([
        {
          id: 'welcome',
          sender: 'bot',
          text: '🙏 **Conversation cleared.**\n\nતમે કોઈપણ ખાતાની વિગત, બેલેન્સ કે સ્ટેટમેન્ટ વિશે ગમે તે ભાષામાં પૂછી શકો છો!',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  return (
    <>
      {/* ── Floating Chat Button ── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 text-white rounded-full shadow-2xl hover:shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer group border border-white/20"
          title="Open Multilingual AI Assistant"
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <Bot className="w-5 h-5 text-white animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-900 rounded-full"></span>
          </div>
          <div className="text-left pr-1">
            <div className="text-xs font-bold flex items-center gap-1.5 leading-tight">
              <span>AI Hisab Assistant</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            </div>
            <div className="text-[10px] text-white/80 font-medium leading-tight mt-0.5">
              English • ગુજરાતી • Gujlish
            </div>
          </div>
        </button>
      )}

      {/* ── Chat Modal Window ── */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 flex flex-col bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden ${isExpanded
            ? 'inset-4 md:inset-10 max-w-4xl max-h-[85vh] mx-auto my-auto'
            : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[420px] h-[580px] max-h-[calc(100vh-2rem)]'
            }`}
        >
          {/* ── Chat Header ── */}
          <div className="px-4 py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 text-white flex items-center justify-between shadow-xs select-none">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border border-slate-900 rounded-full"></span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm leading-tight">AI Accounting Assistant</h3>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/20 text-white/90 uppercase tracking-wider">
                    NLP Engine
                  </span>
                </div>
                <p className="text-[11px] text-indigo-100 font-medium">
                  Auto detects Gujlish, Gujarati, Hinglish & Slang
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-white/80">
              <button
                onClick={handleClearChat}
                className="p-1.5 hover:bg-white/20 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Clear Chat History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 hover:bg-white/20 hover:text-white rounded-lg transition-colors cursor-pointer hidden sm:block"
                title={isExpanded ? "Collapse View" : "Expand View"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Close Assistant"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── Suggestions Bar ── */}
          {suggestions.length > 0 && (
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Ask:
              </span>
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(sug)}
                  className="px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 rounded-full text-[11px] text-slate-600 font-medium whitespace-nowrap transition-all cursor-pointer shadow-2xs"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* ── Messages Container ── */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gradient-to-b from-slate-50/50 to-white text-sm">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-end gap-2 max-w-[90%]">
                  {msg.sender === 'bot' && (
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mb-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`p-3.5 rounded-2xl ${msg.sender === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-xs shadow-xs'
                      : 'bg-white border border-slate-200/80 text-slate-800 rounded-bl-xs shadow-xs'
                      }`}
                  >
                    {/* Message Text */}
                    <div className="whitespace-pre-wrap leading-relaxed text-[13px] font-normal">
                      {msg.text.split('\n').map((line, lIdx) => {
                        // Simple bold formatting replacement for **text**
                        const parts = line.split(/(\*\*.*?\*\*)/g);
                        return (
                          <div key={lIdx} className={line === '' ? 'h-2' : ''}>
                            {parts.map((part, pIdx) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={pIdx} className="font-bold">{part.slice(2, -2)}</strong>;
                              }
                              return part;
                            })}
                          </div>
                        );
                      })}
                    </div>

                    {/* Rich Matched Account Card */}
                    {msg.payload?.matched_account && (
                      <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                          <div>
                            <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                              <Building className="w-4 h-4 text-indigo-600" />
                              {msg.payload.matched_account.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {msg.payload.matched_account.bank_name} • {msg.payload.matched_account.account_number}
                            </div>
                          </div>

                          {/* Balance Badge */}
                          <div className={`px-2.5 py-1 rounded-lg text-xs font-bold text-right ${msg.payload.matched_account.financials.status === 'YOU_WILL_GET'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : msg.payload.matched_account.financials.status === 'YOU_WILL_GIVE'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-slate-200 text-slate-700'
                            }`}>
                            <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">
                              {msg.payload.matched_account.financials.status === 'YOU_WILL_GET' ? 'You will Get' : (msg.payload.matched_account.financials.status === 'YOU_WILL_GIVE' ? 'You will Give' : 'Settled')}
                            </div>
                            <div>₹{Math.abs(msg.payload.matched_account.financials.net_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                          </div>
                        </div>

                        {/* Recent Entries preview */}
                        {msg.payload.matched_account.financials.recent_entries.length > 0 && (
                          <div className="pt-1">
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              Last Transactions:
                            </div>
                            <div className="space-y-1">
                              {msg.payload.matched_account.financials.recent_entries.slice(0, 3).map((e) => (
                                <div key={e.id} className="flex items-center justify-between text-xs py-1 px-2 bg-white rounded-md border border-slate-100">
                                  <span className="text-slate-500 text-[11px]">{e.date}</span>
                                  <span className="text-slate-700 font-medium truncate max-w-[120px]">{e.description || 'Entry'}</span>
                                  <span className={`font-bold ${e.type === 'GOT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {e.type === 'GOT' ? '+' : '-'}₹{e.amount.toLocaleString('en-IN')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Clarification Options Chips */}
                    {msg.payload?.clarification_options && msg.payload.clarification_options.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-100">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Select Account:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.payload.clarification_options.map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => handleClarificationClick(opt)}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors border border-indigo-200 cursor-pointer flex items-center gap-1"
                            >
                              <span>{opt.name}</span>
                              <ChevronRight className="w-3 h-3 opacity-60" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick Action Buttons */}
                    {msg.payload?.quick_actions && msg.payload.quick_actions.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                        {msg.payload.quick_actions.map((act, aIdx) => (
                          <button
                            key={aIdx}
                            onClick={() => handleActionClick(act)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs hover:text-slate-900"
                          >
                            <span>{act.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {/* Loading / Typing indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-500">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl rounded-bl-xs shadow-2xs flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input Box ── */}
          <div className="p-3 bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              {/* Voice Mic Button */}
              <button
                type="button"
                onClick={toggleListening}
                className={`p-2.5 rounded-xl transition-colors cursor-pointer ${isListening
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                title={isListening ? "Listening... Click to stop" : "Speak in Gujarati / Hindi / English"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={isListening ? "Listening to your voice..." : "Type in English, Gujarati, Hinglish or Gujlish..."}
                disabled={isLoading}
                className="flex-1 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-slate-900 rounded-xl border border-transparent focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-hidden text-xs sm:text-sm font-medium transition-all"
              />

              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl transition-all cursor-pointer shadow-xs shrink-0"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
