export const maxDuration = 60; // Allow up to 60 seconds on Vercel

// Generate session ID helper
function generateSessionId(customName = null) {
  const prefix = 'lm7bos';
  if (customName && typeof customName === 'string' && customName.trim().length > 0) {
    const cleanName = customName.trim().replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    if (cleanName.length > 0) {
      return `${prefix}_${cleanName}`;
    }
  }
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let randomPart = '';
  for (let i = 0; i < 10; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}_adjacency${randomPart}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let { number, sessionName, sessionId } = req.body;
  if (!number) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  number = String(number).replace(/[^0-9]/g, '');

  const finalSessionId = sessionId || generateSessionId(sessionName);

  try {
    // Dynamic import to support ESM in Next.js serverless
    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default || baileys.makeWASocket;
    const { useMultiFileAuthState, Browsers, delay } = baileys;
    const pino = (await import('pino')).default;

    const os = await import('os');
    const path = await import('path');

    const tempDir = path.join(os.tmpdir(), `adam_auth_${number}_${Date.now()}`);
    const { state, saveCreds } = await useMultiFileAuthState(tempDir);

    const logger = pino({ level: 'silent' });

    const sock = makeWASocket({
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
    });

    sock.ev.on('creds.update', saveCreds);

    // Wait 3 seconds for WebSocket to establish
    await delay(3000);

    const code = await sock.requestPairingCode(number);
    const formatted = code?.match(/.{1,4}/g)?.join('-') || code;

    // Return the real code and sessionId
    return res.status(200).json({
      ok: true,
      number,
      sessionId: finalSessionId,
      code: formatted,
      message: 'Enter code in WhatsApp -> Linked Devices -> Link with phone number'
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      sessionId: finalSessionId,
      error: err.message || String(err),
      stack: err.stack ? err.stack.split('\n').slice(0, 3) : undefined
    });
  }
}
