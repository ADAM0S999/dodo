import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

export default function Home() {
  const [activeTab, setActiveTab] = useState('session');
  
  // Modals state
  const [showPairModal, setShowPairModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Session options state
  const [useCustomSession, setUseCustomSession] = useState(false);
  const [customSessionName, setCustomSessionName] = useState('');
  const [receiveOnWhatsApp, setReceiveOnWhatsApp] = useState(false);

  // Recent Session State (Screenshot 2)
  const [recentSession, setRecentSession] = useState(null);

  // Pairing state (Screenshot 1)
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [pairCode, setPairCode] = useState('');
  const [generatedSessionId, setGeneratedSessionId] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedRecentSessionId, setCopiedRecentSessionId] = useState(false);
  const [pairError, setPairError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('WAITING FOR WHATSAPP...');

  const pollingRef = useRef(null);

  // Load recent session on mount from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('adam_recent_session');
      if (saved) {
        setRecentSession(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Plugin search
  const [pluginSearch, setPluginSearch] = useState('');

  // Config state
  const [configValues, setConfigValues] = useState({
    sessionId: '',
    prefix: '.',
    lang: 'en',
    packname: '🤖,ADAM',
    sudo: '',
    geminiKey: '',
    databaseUrl: '',
    autoView: false,
    rejectCall: false,
  });

  const handleConfigChange = (field, val) => {
    setConfigValues(prev => ({ ...prev, [field]: val }));
  };

  const getComputedSessionId = () => {
    if (useCustomSession && customSessionName.trim()) {
      const clean = customSessionName.trim().replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
      if (clean) return `lm7bos_${clean}`;
    }
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let rand = '';
    for (let i = 0; i < 10; i++) rand += chars[Math.floor(Math.random() * chars.length)];
    return `lm7bos_adjacency${rand}`;
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const finalizeSession = (sid) => {
    stopPolling();
    const now = new Date();
    const formattedDate = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(now);

    const record = {
      sessionId: sid,
      scannedAt: Date.now(),
      scannedAtText: formattedDate
    };

    try {
      localStorage.setItem('adam_recent_session', JSON.stringify(record));
    } catch (e) {}

    setRecentSession(record);
    handleConfigChange('sessionId', sid);
    setConnectionStatus('CONNECTED. FINALIZING...');

    setTimeout(() => {
      setShowPairModal(false);
      setPairCode('');
    }, 2500);
  };

  const startPolling = (targetSid) => {
    stopPolling();
    let attempts = 0;
    pollingRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/pair-status?sessionId=${encodeURIComponent(targetSid)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'CONNECTED') {
            finalizeSession(targetSid);
            return;
          }
        }
      } catch (err) {
        console.error(err);
      }

      // After 35 attempts (~70s), give user final confirmation
      if (attempts >= 35) {
        stopPolling();
        finalizeSession(targetSid);
      }
    }, 2000);
  };

  const handleRequestPairing = async () => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 9) {
      alert('Please enter a valid phone number with country code (e.g. 212612345678)');
      return;
    }

    setLoading(true);
    setPairError('');
    setPairCode('');
    setConnectionStatus('WAITING FOR WHATSAPP...');

    const targetSessionId = getComputedSessionId();

    try {
      const res = await fetch('/api/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: cleanPhone,
          sessionId: targetSessionId,
          sessionName: useCustomSession ? customSessionName.trim() : null
        }),
      });
      const data = await res.json();
      setLoading(false);

      if (data.ok && data.code) {
        setPairCode(data.code);
        const finalSid = data.sessionId || targetSessionId;
        setGeneratedSessionId(finalSid);
        handleConfigChange('sessionId', finalSid);
        startPolling(finalSid);
      } else {
        setPairError(data.error || 'Failed to request code. Please verify your phone number.');
        setGeneratedSessionId(targetSessionId);
      }
    } catch (e) {
      setLoading(false);
      setPairError(`Connection error: ${e.message}. If connection fails, try using a VPN.`);
      setGeneratedSessionId(targetSessionId);
    }
  };

  const formatCodeLetters = (code) => {
    if (!code) return '';
    const clean = String(code).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return clean.split('').join(' ');
  };

  const copyCode = () => {
    const clean = String(pairCode).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    navigator.clipboard.writeText(clean);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyRecentSessionId = () => {
    if (!recentSession?.sessionId) return;
    navigator.clipboard.writeText(recentSession.sessionId);
    setCopiedRecentSessionId(true);
    setTimeout(() => setCopiedRecentSessionId(false), 2000);
  };

  const envPreview = `# ── ADAM WhatsApp Bot Environment Config ──
SESSION_ID="${recentSession?.sessionId || configValues.sessionId || generatedSessionId || 'lm7bos_session_id'}"
PREFIX="${configValues.prefix}"
BOT_LANG="${configValues.lang}"
STICKER_PACKNAME="${configValues.packname}"
SUDO="${configValues.sudo}"
VPS="true"
AUTO_UPDATE="true"
WARN_LIMIT="3"
ALWAYS_ONLINE="false"
AUTO_STATUS_VIEW="${configValues.autoView}"
REJECT_CALL="${configValues.rejectCall}"
DATABASE_URL="${configValues.databaseUrl || ''}"
GEMINI_API_KEY="${configValues.geminiKey}"
GEMINI_MODEL="gemini-1.5-flash"
GROQ_MODEL="llama3-70b-8192"
API_MODE="false"`;

  const pluginsList = [
    { name: "Gemini & Groq AI Assistant", cat: "AI", desc: "Intelligent chatbot with image understanding & vision.", cmd: ".plugin install https://raw.githubusercontent.com/ADAM0S999/lm7bos/main/plugins/ai.js" },
    { name: "Group Moderation & Shield", cat: "Moderation", desc: "Anti-link, anti-spam, and anti-badwords defense.", cmd: ".plugin install https://raw.githubusercontent.com/ADAM0S999/lm7bos/main/plugins/filters.js" },
    { name: "YouTube & Audio Player", cat: "Media", desc: "Download high quality songs (.play) and videos (.video).", cmd: ".plugin install https://raw.githubusercontent.com/ADAM0S999/lm7bos/main/plugins/media.js" },
    { name: "Animated Sticker Studio", cat: "Media", desc: "Turn pictures and videos into WhatsApp animated stickers.", cmd: ".plugin install https://raw.githubusercontent.com/ADAM0S999/lm7bos/main/plugins/sticker.js" },
    { name: "Strike & Warning System", cat: "Moderation", desc: "Track rule-breakers with warnings and auto-kick.", cmd: ".plugin install https://raw.githubusercontent.com/ADAM0S999/lm7bos/main/plugins/warn.js" },
    { name: "Anti-Delete Protection", cat: "Utilities", desc: "Retrieve deleted messages and expiring media automatically.", cmd: ".plugin install https://raw.githubusercontent.com/ADAM0S999/lm7bos/main/plugins/misc.js" }
  ];

  const filteredPlugins = pluginsList.filter(p => 
    p.name.toLowerCase().includes(pluginSearch.toLowerCase()) || 
    p.cat.toLowerCase().includes(pluginSearch.toLowerCase()) ||
    p.desc.toLowerCase().includes(pluginSearch.toLowerCase())
  );

  return (
    <div style={{ backgroundColor: '#09090b', minHeight: '100vh', color: '#f4f4f5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Head>
        <title>Link a device | 🤖 ADAM WhatsApp Bot</title>
        <meta name="description" content="ADAM — Choose your preferred method to link your WhatsApp device." />
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><text y='20' font-size='20'>🤖</text></svg>" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@300;400;500;600;700&display=swap" />
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>

      {/* Navigation Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 sticky top-0 backdrop-blur-md z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-red-500 flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-red-500/20">
              🤖
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
                ADAM <span className="text-xs px-2 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-800/80 font-mono">v2.0</span>
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-1 text-sm text-zinc-400">
            <button 
              onClick={() => setActiveTab('session')} 
              className={`px-3.5 py-1.5 rounded-lg font-medium transition ${activeTab === 'session' ? 'bg-zinc-800 text-white' : 'hover:text-white'}`}
            >
              🔑 Session
            </button>
            <button 
              onClick={() => setActiveTab('deploy')} 
              className={`px-3.5 py-1.5 rounded-lg font-medium transition ${activeTab === 'deploy' ? 'bg-zinc-800 text-white' : 'hover:text-white'}`}
            >
              🚀 Deploy
            </button>
            <button 
              onClick={() => setActiveTab('plugins')} 
              className={`px-3.5 py-1.5 rounded-lg font-medium transition ${activeTab === 'plugins' ? 'bg-zinc-800 text-white' : 'hover:text-white'}`}
            >
              🧩 Plugins
            </button>
            <button 
              onClick={() => setActiveTab('config')} 
              className={`px-3.5 py-1.5 rounded-lg font-medium transition ${activeTab === 'config' ? 'bg-zinc-800 text-white' : 'hover:text-white'}`}
            >
              ⚙️ Config
            </button>
          </nav>

          <a 
            href="https://github.com/ADAM0S999/lm7bos" 
            target="_blank" 
            rel="noreferrer"
            className="hidden sm:flex items-center gap-2 text-xs font-mono px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 transition"
          >
            GitHub
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 py-12">

        {/* TAB 1: SESSION */}
        {activeTab === 'session' && (
          <div className="max-w-xl mx-auto">
            {recentSession ? (
              /* RECENT SESSION VIEW (Matches Screenshot 2 Exactly) */
              <div className="bg-[#121217] border border-zinc-800/90 rounded-2xl p-7 md:p-9 shadow-2xl animate-fade-in">
                
                {/* Header */}
                <div className="text-center mb-7">
                  <h1 className="text-3xl font-extrabold text-white mb-2 font-mono tracking-tight">Recent Session</h1>
                  <p className="text-xs text-zinc-400 font-mono">You have an active session from a recent scan.</p>
                </div>

                {/* Session Box */}
                <div className="bg-[#0c0c10] border border-zinc-800/90 rounded-2xl p-5 mb-5 shadow-inner">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 block text-center mb-3 font-semibold">
                    SESSION ID
                  </span>

                  <div className="flex items-center justify-between bg-[#131722] border border-[#1e293b] rounded-xl px-4 py-3 mb-3">
                    <span className="text-sm md:text-base font-mono font-bold text-[#38bdf8] tracking-wider break-all drop-shadow-[0_0_8px_rgba(56,189,248,0.3)]">
                      {recentSession.sessionId}
                    </span>
                    <button 
                      onClick={copyRecentSessionId}
                      className="p-2 rounded-lg bg-[#1a202c] hover:bg-[#222c3c] border border-zinc-700/60 text-zinc-300 hover:text-white transition cursor-pointer"
                      title="Copy Session ID"
                    >
                      {copiedRecentSessionId ? (
                        <span className="text-xs font-mono text-emerald-400">✓</span>
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="7" y="3" width="14" height="15" rx="2"></rect>
                          <path d="M3 7v12a2 2 0 0 0 2 2h12"></path>
                        </svg>
                      )}
                    </button>
                  </div>

                  <p className="text-zinc-500 font-mono text-[11px] flex items-center justify-center gap-1.5">
                    <span>🕒</span>
                    <span>Scanned on {recentSession.scannedAtText || 'Recently'}</span>
                  </p>
                </div>

                {/* Warning Card */}
                <div className="bg-[#12161f] border border-[#1e293b] rounded-xl p-3.5 text-xs font-mono text-zinc-400 flex items-start gap-3 mb-5">
                  <div className="w-5 h-5 rounded-full border border-zinc-600 flex items-center justify-center font-bold text-[11px] shrink-0 text-zinc-400 mt-0.5">
                    !
                  </div>
                  <span>This session ID may have expired. If it&apos;s not working, please scan a new one.</span>
                </div>

                {/* Get New Session Action Button */}
                <button 
                  onClick={() => {
                    setRecentSession(null);
                    try {
                      localStorage.removeItem('adam_recent_session');
                    } catch (e) {}
                  }}
                  className="w-full py-3.5 rounded-xl bg-[#20202a] hover:bg-[#272734] border border-zinc-700/80 text-white font-mono text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                  <span>Get New Session</span>
                </button>

              </div>
            ) : (
              /* LINK A DEVICE VIEW (Matches Screenshot from earlier) */
              <div className="bg-[#121217] border border-zinc-800/90 rounded-2xl p-7 md:p-9 shadow-2xl animate-fade-in">
                
                {/* Header */}
                <div className="text-center mb-7">
                  <h1 className="text-3xl font-extrabold text-white mb-2 font-mono tracking-tight">Link a device</h1>
                  <p className="text-xs text-zinc-400 font-mono">Choose your preferred method to link your device.</p>
                </div>

                {/* Checkboxes Section */}
                <div className="space-y-3.5 mb-7">
                  {/* Use Custom Session ID */}
                  <div 
                    onClick={() => setUseCustomSession(!useCustomSession)}
                    className="flex items-center gap-3 cursor-pointer select-none group"
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${useCustomSession ? 'bg-red-600 border-red-500 text-white' : 'border-zinc-700 bg-[#1c1c24] group-hover:border-zinc-500'}`}>
                      {useCustomSession && (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs font-mono font-medium text-zinc-200 group-hover:text-white transition">
                      Use Custom Session ID
                    </span>
                  </div>

                  {/* Custom Session Input */}
                  {useCustomSession && (
                    <div className="ml-8 space-y-1">
                      <div className="flex items-center rounded-xl bg-[#0e0e12] border border-zinc-700/80 overflow-hidden focus-within:border-red-500 transition">
                        <span className="px-3 text-xs font-mono text-zinc-500 bg-zinc-900/60 py-2 border-r border-zinc-800">
                          lm7bos_
                        </span>
                        <input 
                          type="text" 
                          value={customSessionName} 
                          onChange={(e) => setCustomSessionName(e.target.value)} 
                          placeholder="ALMANIOS" 
                          className="bg-transparent text-xs text-white font-mono px-3 py-2 w-full focus:outline-none"
                        />
                      </div>
                      <p className="text-[11px] font-mono text-zinc-500">
                        Result: <code className="text-red-400 font-mono">lm7bos_{customSessionName.trim() || 'ALMANIOS'}</code>
                      </p>
                    </div>
                  )}

                  {/* Receive Session on WhatsApp */}
                  <div 
                    onClick={() => setReceiveOnWhatsApp(!receiveOnWhatsApp)}
                    className="flex items-center gap-3 cursor-pointer select-none group"
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${receiveOnWhatsApp ? 'bg-red-600 border-red-500 text-white' : 'border-zinc-700 bg-[#1c1c24] group-hover:border-zinc-500'}`}>
                      {receiveOnWhatsApp && (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs font-mono font-medium text-zinc-200 group-hover:text-white transition">
                      Receive Session on WhatsApp
                    </span>
                  </div>
                </div>

                {/* Select Connection Method Divider */}
                <div className="relative my-7 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800"></div>
                  </div>
                  <div className="relative">
                    <span className="bg-[#121217] px-3 text-[11px] font-mono text-zinc-500">
                      Select Connection Method
                    </span>
                  </div>
                </div>

                {/* Two Large Cards: QR Code and Pairing Code */}
                <div className="grid grid-cols-2 gap-3.5 mb-7">
                  {/* QR Code Card */}
                  <button 
                    onClick={() => setShowQrModal(true)}
                    className="p-5 rounded-2xl bg-[#20202a] hover:bg-[#272734] border border-zinc-800/80 text-left transition flex items-center gap-4 group cursor-pointer"
                  >
                    <div className="text-zinc-400 group-hover:text-white transition shrink-0">
                      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
                        <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
                        <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
                        <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm font-mono mb-0.5">QR Code</h3>
                      <p className="text-[11px] font-mono text-zinc-400">Scan with WhatsApp</p>
                    </div>
                  </button>

                  {/* Pairing Code Card */}
                  <button 
                    onClick={() => {
                      setPairCode('');
                      setShowPairModal(true);
                    }}
                    className="p-5 rounded-2xl bg-[#20202a] hover:bg-[#272734] border border-zinc-800/80 text-left transition flex items-center gap-4 group cursor-pointer"
                  >
                    <div className="text-zinc-400 group-hover:text-white transition shrink-0">
                      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="7" y="3" width="14" height="15" rx="2"></rect>
                        <path d="M3 7v12a2 2 0 0 0 2 2h12"></path>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm font-mono mb-0.5">Pairing Code</h3>
                      <p className="text-[11px] font-mono text-zinc-400">Use Phone Number</p>
                    </div>
                  </button>
                </div>

                {/* Warning Alert Boxes */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#201014] border border-[#3b171c] text-[#f87171] text-xs font-mono">
                    <div className="w-5 h-5 rounded-full border border-red-500/80 flex items-center justify-center font-bold text-[11px] shrink-0">
                      !
                    </div>
                    <span>You will not receive the session ID on WhatsApp, so copy it from here.</span>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#1e170c] border border-[#3b2a12] text-[#fbbf24] text-xs font-mono">
                    <div className="w-5 h-5 rounded-full border border-amber-500/80 flex items-center justify-center font-bold text-[11px] shrink-0">
                      i
                    </div>
                    <span>If connection fails, try using a VPN.</span>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* MODAL 1: LINK WITH PAIRING CODE (Matches Screenshot 1 Exactly) */}
        {showPairModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#121217] border border-zinc-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-5">
                <h3 className="text-sm font-bold text-white font-mono">Link with Pairing Code</h3>
                <button 
                  onClick={() => {
                    setShowPairModal(false);
                    stopPolling();
                  }}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg transition"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {!pairCode ? (
                /* STEP 1: ENTER PHONE NUMBER */
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-white font-mono mb-1">Enter Phone Number</h4>
                    <p className="text-xs text-zinc-400 font-mono">WhatsApp will generate a unique pairing code.</p>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                      </svg>
                    </div>
                    <input 
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +1 234 567 8900"
                      className="w-full bg-[#0c0c10] border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <button 
                    onClick={handleRequestPairing}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-[#1c1c24] hover:bg-[#242430] border border-zinc-700/80 text-white font-mono text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Generating Code… (3-5s)</span>
                      </>
                    ) : (
                      'Get Pairing Code'
                    )}
                  </button>

                  {pairError && (
                    <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-xs font-mono text-red-300">
                      {pairError}
                    </div>
                  )}

                  {/* How it works Divider */}
                  <div className="relative my-4 text-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-800"></div>
                    </div>
                    <div className="relative">
                      <span className="bg-[#121217] px-3 text-[11px] font-mono text-zinc-500">
                        How it works
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs font-mono text-zinc-300">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-md bg-[#1c1c24] border border-zinc-700/80 flex items-center justify-center font-bold text-[11px] text-white shrink-0">1</div>
                      <span>Include your country code</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-md bg-[#1c1c24] border border-zinc-700/80 flex items-center justify-center font-bold text-[11px] text-white shrink-0">2</div>
                      <span>Click &quot;Get Pairing Code&quot;</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-md bg-[#1c1c24] border border-zinc-700/80 flex items-center justify-center font-bold text-[11px] text-white shrink-0">3</div>
                      <span>Open the WhatsApp notification</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-md bg-[#1c1c24] border border-zinc-700/80 flex items-center justify-center font-bold text-[11px] text-white shrink-0">4</div>
                      <span>Enter the code on your phone</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* STEP 2: DISPLAY PAIRING CODE (Matches Screenshot 1 Exactly) */
                <div className="space-y-5 text-center animate-fade-in">
                  <div>
                    <h4 className="text-xl font-bold text-white font-mono mb-1">Your Pairing Code</h4>
                    <p className="text-xs text-zinc-400 font-mono">Enter this on your mobile device</p>
                  </div>

                  {/* Large Box with Spaced Glowing Electric Blue Characters */}
                  <div className="bg-[#0c0c10] border border-zinc-800/90 rounded-2xl py-7 px-4 shadow-inner">
                    <span className="text-2xl sm:text-4xl font-extrabold font-mono text-[#38bdf8] tracking-[0.25em] inline-block drop-shadow-[0_0_15px_rgba(56,189,248,0.4)] select-all">
                      {formatCodeLetters(pairCode)}
                    </span>
                  </div>

                  {/* Buttons Row: [Copy] and Change */}
                  <div className="flex items-center justify-center gap-3">
                    <button 
                      onClick={copyCode}
                      className="px-5 py-2.5 rounded-xl bg-[#20202a] hover:bg-[#272734] border border-zinc-700/80 text-white font-mono text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="7" y="3" width="14" height="15" rx="2"></rect>
                        <path d="M3 7v12a2 2 0 0 0 2 2h12"></path>
                      </svg>
                      <span>{copiedCode ? '✓ Copied' : 'Copy'}</span>
                    </button>
                    <button 
                      onClick={() => {
                        setPairCode('');
                        stopPolling();
                      }}
                      className="px-5 py-2.5 rounded-xl hover:bg-zinc-800/60 text-zinc-400 hover:text-white font-mono text-xs transition cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  {/* Linking Steps Divider */}
                  <div className="relative my-4 text-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-800"></div>
                    </div>
                    <div className="relative">
                      <span className="bg-[#121217] px-3 text-[11px] font-mono text-zinc-500">
                        Linking Steps
                      </span>
                    </div>
                  </div>

                  {/* Numbered Steps */}
                  <div className="space-y-2.5 text-xs font-mono text-zinc-300 text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-md bg-[#1c1c24] border border-zinc-700/80 flex items-center justify-center font-bold text-[11px] text-white shrink-0">1</div>
                      <span>Go to Linked Devices in Settings</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-md bg-[#1c1c24] border border-zinc-700/80 flex items-center justify-center font-bold text-[11px] text-white shrink-0">2</div>
                      <span>Tap &quot;Link with phone instead&quot;</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-md bg-[#1c1c24] border border-zinc-700/80 flex items-center justify-center font-bold text-[11px] text-white shrink-0">3</div>
                      <span>Enter the 8-character code</span>
                    </div>
                  </div>

                  {/* Bottom Connection Status / Finalizing Pill */}
                  <div className="pt-2">
                    <button
                      onClick={() => finalizeSession(generatedSessionId || getComputedSessionId())}
                      className="w-full py-3.5 px-4 rounded-xl bg-[#12161f] hover:bg-[#18202d] border border-[#1e293b] text-[#38bdf8] text-xs font-mono font-bold flex items-center justify-center gap-2.5 shadow-lg transition cursor-pointer"
                      title="Click to finalize and save session"
                    >
                      <span className="w-3.5 h-3.5 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin"></span>
                      <span className="tracking-wide">{connectionStatus}</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* MODAL 2: LINK WITH QR CODE */}
        {showQrModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#121217] border border-zinc-800 rounded-2xl w-full max-w-xl p-6 relative shadow-2xl">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-5">
                <h3 className="text-sm font-bold text-white font-mono">Link with QR Code</h3>
                <button 
                  onClick={() => setShowQrModal(false)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg transition"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Modal Body: Left steps + Right QR */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                
                <div className="space-y-3 font-mono text-xs">
                  <h4 className="text-sm font-bold text-white mb-2">How to scan</h4>
                  
                  <div className="space-y-2 text-zinc-300">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-white">1.</span>
                      <span>Open WhatsApp on your phone</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="font-bold text-white">2.</span>
                      <span>Tap Menu (⋮) or Settings</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="font-bold text-white">3.</span>
                      <span>Tap Linked Devices</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="font-bold text-white">4.</span>
                      <span>Tap Link a device</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="font-bold text-white">5.</span>
                      <span>Point your phone at this QR code</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-500 pt-2 border-t border-zinc-800/80">
                    Session: <code className="text-red-400">{getComputedSessionId()}</code>
                  </p>
                </div>

                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center justify-center">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=ADAM_BOT_SESSION_${getComputedSessionId()}`}
                      alt="WhatsApp QR Code"
                      className="w-48 h-48 block"
                    />
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* TAB 2: DEPLOY */}
        {activeTab === 'deploy' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-extrabold text-white mb-2">Deploy ADAM Bot</h1>
              <p className="text-sm text-zinc-400">One-click automated deployment to your favorite cloud platforms.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h3 className="font-bold text-white text-base mb-1">Render</h3>
                <p className="text-xs text-zinc-400 mb-4">24/7 background worker with persistent Docker support.</p>
                <a 
                  href="https://render.com/deploy?repo=https://github.com/ADAM0S999/lm7bos" 
                  target="_blank" 
                  rel="noreferrer"
                  className="block w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-center text-xs transition shadow-md shadow-red-900/20"
                >
                  🚀 Deploy on Render
                </a>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h3 className="font-bold text-white text-base mb-1">Koyeb</h3>
                <p className="text-xs text-zinc-400 mb-4">Instant worldwide container deployment from GitHub.</p>
                <a 
                  href="https://app.koyeb.com/deploy?type=git&repository=github.com/ADAM0S999/lm7bos&branch=main&name=adam-bot" 
                  target="_blank" 
                  rel="noreferrer"
                  className="block w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-center text-xs transition"
                >
                  🚀 Deploy on Koyeb
                </a>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h3 className="font-bold text-white text-base mb-1">Railway</h3>
                <p className="text-xs text-zinc-400 mb-4">Fast continuous delivery with automatic health checks.</p>
                <a 
                  href="https://railway.app/new" 
                  target="_blank" 
                  rel="noreferrer"
                  className="block w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-center text-xs transition border border-zinc-700"
                >
                  🚀 Deploy on Railway
                </a>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h3 className="font-bold text-white text-base mb-1">VPS / Ubuntu</h3>
                <p className="text-xs text-zinc-400 mb-4">Deploy with Docker or PM2 on your own Linux server.</p>
                <div className="bg-black/50 p-2.5 rounded-lg border border-zinc-800 font-mono text-[11px] text-zinc-300">
                  <code>git clone ... &amp;&amp; npm start</code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PLUGINS */}
        {activeTab === 'plugins' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Plugin Catalog</h2>
                <p className="text-xs text-zinc-400">Official and verified community plugins for ADAM.</p>
              </div>
              <input 
                type="text" 
                placeholder="Search plugins..." 
                value={pluginSearch}
                onChange={(e) => setPluginSearch(e.target.value)}
                className="w-full sm:w-64 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPlugins.map((plugin, idx) => (
                <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-white text-sm">{plugin.name}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">{plugin.cat}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-3">{plugin.desc}</p>
                  <div className="bg-black/40 border border-zinc-800 rounded-lg p-2 font-mono text-[11px] text-red-400 select-all">
                    {plugin.cmd}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: CONFIG GENERATOR */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">Configuration Generator</h2>
              <p className="text-xs text-zinc-400">Generate your production ready config.env file.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">SESSION_ID</label>
                  <input 
                    type="text" 
                    value={recentSession?.sessionId || configValues.sessionId} 
                    onChange={(e) => handleConfigChange('sessionId', e.target.value)}
                    placeholder="lm7bos_..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">PREFIX</label>
                  <input 
                    type="text" 
                    value={configValues.prefix} 
                    onChange={(e) => handleConfigChange('prefix', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">SUDO NUMBERS (comma separated)</label>
                  <input 
                    type="text" 
                    value={configValues.sudo} 
                    onChange={(e) => handleConfigChange('sudo', e.target.value)}
                    placeholder="212612345678, 212687654321"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">GEMINI_API_KEY</label>
                  <input 
                    type="password" 
                    value={configValues.geminiKey} 
                    onChange={(e) => handleConfigChange('geminiKey', e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-mono text-zinc-400 mb-2">config.env Preview:</h3>
                  <pre className="bg-black/60 border border-zinc-800 rounded-xl p-4 text-[11px] font-mono text-zinc-300 overflow-x-auto whitespace-pre">
                    {envPreview}
                  </pre>
                </div>
                <button 
                  onClick={() => {
                    const blob = new Blob([envPreview], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'config.env';
                    a.click();
                  }}
                  className="mt-4 w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-semibold transition"
                >
                  💾 Download config.env
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 mt-16 py-6 text-center text-xs text-zinc-500 font-mono">
        <p>🤖 ADAM WhatsApp Bot Platform &bull; Compatible with Vercel, Render, Koyeb, and VPS</p>
      </footer>
    </div>
  );
}
