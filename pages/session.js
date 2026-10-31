import { useState } from 'react';
import Head from 'next/head';

export default function SessionPage() {
  const [mode, setMode] = useState('normal'); // 'normal' | 'custom'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customName, setCustomName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: phoneNumber,
          sessionName: mode === 'custom' ? customName : null
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSessionId(data.sessionId);
        setPairingCode(data.code);
      } else {
        setError(data.error || 'فشل في إنشاء الجلسة');
      }
    } catch (e) {
      setError('خطأ في الاتصال');
    }
    setLoading(false);
  };

  const handleReset = () => {
    setPhoneNumber('');
    setCustomName('');
    setSessionId('');
    setPairingCode('');
    setMode('normal');
  };

  const handleDownload = () => {
    if (!sessionId) return;
    const config = `
# ── ADAM WhatsApp Bot Config ──
SESSION_ID="${sessionId}"
PREFIX="."
BOT_LANG="en"
STICKER_PACKNAME="⚡,ADAM"
SUDO=""
VPS="true"
AUTO_UPDATE="true"
WARN_LIMIT="3"
ALWAYS_ONLINE="false"
AUTO_STATUS_VIEW="false"
REJECT_CALL="false"
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-1.5-flash"
GROQ_MODEL="llama3-70b-8192"
API_MODE="false"
DATABASE_URL=""
`.trim();

    const blob = new Blob([config], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'config.env';
    a.click();
  };

  const handleCopy = () => {
    if (!sessionId) return;
    navigator.clipboard.writeText(sessionId);
    alert('تم النسخ: ' + sessionId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex flex-col items-center p-6">
      <Head><title>ADAM Session Manager</title></Head>

      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-bold mb-2 text-center">❤️‍🔥 ADAM Session Creator</h1>
        <p className="text-gray-400 text-center mb-6">Create a new WhatsApp session with optional custom name</p>

        {/* Mode Selector */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setMode('normal')}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition
              ${mode === 'normal' ? 'bg-red-600' : 'bg-gray-800 hover:bg-gray-700'}`}
          >
            Random Session
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition
              ${mode === 'custom' ? 'bg-red-600' : 'bg-gray-800 hover:bg-gray-700'}`}
          >
            Custom Name
          </button>
        </div>

        {/* Phone Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
          <input
            type="tel"
            placeholder="212612345678"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* Custom Name Input */}
        {mode === 'custom' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Custom Session Name</label>
            <input
              type="text"
              placeholder="adam"
              value={customName}
              onChange={(e) => setCustomName(e.target.value.trim())}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={handleGenerate}
            disabled={loading || !phoneNumber}
            className="flex-1 px-6 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg font-bold transition"
          >
            {loading ? 'Creating...' : 'Create Session'}
          </button>
          <button
            onClick={handleReset}
            disabled={loading}
            className="flex-1 px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition"
          >
            ❌ Reset
          </button>
        </div>

        {/* Error */}
        {error && <p className="text-red-400 text-center mb-4">{error}</p>}

        {/* Result */}
        {sessionId && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-400 mb-2">Your SESSION_ID:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black px-3 py-1 rounded font-mono text-red-300 break-all">
                {sessionId}
              </code>
              <button
                onClick={handleCopy}
                className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Save */}
        {sessionId && (
          <div className="flex gap-4">
            <button
              onClick={handleDownload}
              className="flex-1 px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold transition"
            >
              💾 Save config.env
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(sessionId)}
              className="flex-1 px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition"
            >
              📋 Copy ID
            </button>
          </div>
        )}
      </div>
    </div>
  );
}