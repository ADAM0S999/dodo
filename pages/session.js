import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newSessionName, setNewSessionName] = useState('');
  const [activeSessionId, setActiveSessionId] = useState('');

  // Load sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions/list');
      const data = await res.json();
      if (data.ok) {
        setSessions(data.sessions || []);
        setActiveSessionId(data.activeSessionId || '');
      }
    } catch (e) {
      setError('Failed to load sessions');
    }
    setLoading(false);
  };

  const createSession = async () => {
    if (!newSessionName.trim()) {
      setError('Please enter a session name');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: '', // Will use PAIR_NUMBER env var
          sessionName: newSessionName.trim()
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewSessionName('');
        await fetchSessions();
        setActiveSessionId(data.sessionId);
      } else {
        setError(data.error || 'Failed to create session');
      }
    } catch (e) {
      setError('Connection error');
    }
    setLoading(false);
  };

  const handleResetSession = async () => {
    if (!activeSessionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/session/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId })
      });
      const data = await res.json();
      if (data.ok) {
        await fetchSessions();
        setActiveSessionId('');
      } else {
        setError(data.error || 'Failed to reset session');
      }
    } catch (e) {
      setError('Connection error');
    }
    setLoading(false);
  };

  const handleDownloadConfig = () => {
    if (!activeSessionId) return;
    // Generate config with current session ID
    const config = `# ── ADAM WhatsApp Bot Config ──
SESSION_ID="${activeSessionId}"
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

  const handleCopySessionId = () => {
    if (!activeSessionId) return;
    navigator.clipboard.writeText(activeSessionId);
    alert('Copied: ' + activeSessionId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex flex-col items-center p-6">
      <Head><title>ADAM Session Manager</title></Head>

      <div className="max-w-4xl w-full">
        <h1 className="text-3xl font-bold mb-4 text-center">🔴⚡ ADAM Session Manager</h1>
        <p className="text-gray-400 text-center mb-8">Manage your ADAM WhatsApp sessions</p>

        {/* Error/Loading */}
        {loading && <p className="text-yellow-400 text-center mb-4">Loading sessions...</p>}
        {error && <p className="text-red-500 text-center mb-4">Error: {error}</p>}

        {/* Active Session Display */}
        {activeSessionId && (
          <div className="bg-gray-800 border border-red-600 rounded-2xl p-6 mb-8 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Active Session</p>
                <code className="font-mono text-red-400 break-all">{activeSessionId}</code>
              </div>
              <button
                onClick={handleCopySessionId}
                className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm text-white"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Use this SESSION_ID in your config.env or Pairing Code generator
            </p>
          </div>
        )}

        {/* Create New Session Section */}
        <div className="bg-gray-800 border border-red-600 rounded-2xl p-6 mb-8 max-w-md w-full">
          <h2 className="text-xl font-bold mb-4 text-center">➕ Create New Session</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Session Name (optional)
            </label>
            <input
              type="text"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value.trim())}
              placeholder="adam"
              className="w-full px-4 py-2 bg-gray-800 border border-red-500 rounded-lg focus:ring-2 focus:ring-red-500 text-white"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={createSession}
              disabled={!newSessionName.trim() || loading}
              className="flex-1 px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Session'}
            </button>
            <button
              onClick={handleResetSession}
              disabled={!activeSessionId}
              className="flex-1 px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition"
            >
              ❌ Reset
            </button>
          </div>
        </div>

        {/* Session List */}
        <div className="bg-gray-800 border border-red-600 rounded-2xl p-6 overflow-x-auto max-w-3xl w-full">
          <h2 className="text-xl font-bold mb-4 text-center">📋 Session List</h2>

          {sessions.length === 0 && (
            <p className="text-gray-400 text-center py-8">No sessions found. Create a new session above.</p>
          )}

          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="bg-red-950/20 border border-red-500/20 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-red-400 break-all">{session.sessionId}</span>
                  <span className="text-gray-400 text-sm">
                    {session.createdAt ? new Date(session.createdAt).toLocaleDateString() : 'Unknown'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownloadConfig()}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm text-white"
                    title="Download config.env"
                  >
                    💾
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(session.sessionId)}
                    className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm text-white"
                    title="Copy Session ID"
                  >
                    📋
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}