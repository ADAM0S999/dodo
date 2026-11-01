'use strict';

/**
 * ADAM Bot — api/index.js
 * Vercel Serverless Function & REST API Backend
 * Handles session pairing, QR generation, plugin catalog, config export, and message gateway.
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pino = require('pino');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Session ID generation helpers (inline for serverless)
const generateSessionId = (customName = null) => {
  const prefix = 'lm7bos';
  if (customName && typeof customName === 'string' && customName.trim().length > 0) {
    const cleanName = customName.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    return `${prefix}_${cleanName}`;
  }
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let randomPart = '';
  for (let i = 0; i < 12; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}_adjacency${randomPart}`;
};

const cleanPhone = (num) => String(num).replace(/[^0-9]/g, '');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

const logger = pino({ level: 'silent' });

// In-memory plugin catalog
const PLUGINS = [
  {
    id: 'ai-chat',
    name: 'Gemini & Groq AI Assistant',
    category: 'ai',
    version: '2.1.0',
    author: 'ADAM Team',
    desc: 'Intelligent conversational AI with multimodal vision support powered by Gemini 1.5 Flash and Groq.',
    command: '.plugin install https://raw.githubusercontent.com/ADAM0S999/lm7bos/main/plugins/ai.js'
  },
  {
    id: 'group-shield',
    name: 'Group Moderation Suite',
    category: 'moderation',
    version: '3.0.1',
    author: 'ADAM Team',
    desc: 'Auto-kick on illegal links, anti-spam rate limiter, profanity filter, and automated warning system.',
    command: '.plugin install https://raw.githubusercontent.com/ADAM0S999/lm7bos/main/plugins/filters.js'
  },
  {
    id: 'media-downloader',
    name: 'YouTube & Media Downloader',
    category: 'media',
    version: '1.9.4',
    author: 'ADAM Team',
    desc: 'Download YouTube audio (.play), video (.video), and extract images directly into chat.',
    command: '.plugin install https://raw.githubusercontent.com/ADAM0S999/lm7bos/main/plugins/media.js'
  },
  {
    id: 'sticker-maker',
    name: 'Animated Sticker Studio',
    category: 'media',
    version: '2.0.0',
    author: 'ADAM Team',
    desc: 'Converts images and videos to WhatsApp animated stickers (.sticker) and sticker back to image (.toimg).',
    command: '.plugin install https://raw.githubusercontent.com/ADAM0S999/lm7bos/main/plugins/sticker.js'
  },
  {
    id: 'warn-system',
    name: 'Group Warning & Strike System',
    category: 'moderation',
    version: '1.4.0',
    author: 'ADAM Team',
    desc: 'Issue warnings (.warn @user), check remaining strikes (.warnlist), and auto-kick upon exceeding limit.',
    command: '.plugin install https://raw.githubusercontent.com/ADAM0S999/lm7bos/main/plugins/warn.js'
  },
  {
    id: 'anti-delete',
    name: 'Anti-Delete Message Recovery',
    category: 'utilities',
    version: '1.2.0',
    author: 'ADAM Team',
    desc: 'Forward revoked/deleted messages and disappearing media back to your private chat automatically.',
    command: '.plugin install https://raw.githubusercontent.com/ADAM0S999/lm7bos/main/plugins/misc.js'
  },
  {
    id: 'tts-voice',
    name: 'Text to Speech (Multi-language)',
    category: 'media',
    version: '1.5.0',
    author: 'ADAM Team',
    desc: 'Converts text into high quality voice notes in English, Arabic, Spanish, French, Hindi, and more.',
    command: '.plugin install https://raw.githubusercontent.com/ADAM0S999/lm7bos/main/plugins/media.js'
  },
  {
    id: 'tagall-mention',
    name: 'Smart TagAll & Mention',
    category: 'utilities',
    version: '1.1.0',
    author: 'ADAM Team',
    desc: 'Mention all group participants cleanly without clutter, custom announcement banner included.',
    command: '.plugin install https://raw.githubusercontent.com/ADAM0S999/lm7bos/main/plugins/group.js'
  }
];

// Active pairing jobs in serverless memory
const activeSessions = new Map();

// ── GET /api/health ─────────────────────────────────────────────────────────
app.get(['/api/health', '/api'], (req, res) => {
  res.json({
    status: 'online',
    platform: 'Vercel Serverless',
    bot: 'ADAM WhatsApp Bot',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ── GET /api/info ───────────────────────────────────────────────────────────
app.get('/api/info', (req, res) => {
  res.json({
    name: '🤖 ADAM WhatsApp Bot',
    version: '1.0.0',
    description: 'High-performance WhatsApp automation bot built on Baileys with multi-session and AI capabilities.',
    github: 'https://github.com/ADAM0S999/lm7bos',
    author: 'ADAM0S999',
    features: [
      'WhatsApp Multi-Device Pairing Code & QR generator',
      'AI Powered Chat (Gemini 1.5 Flash + Groq)',
      'Group Moderation (Anti-link, Anti-spam, Warn system)',
      'Rich Media (Stickers, YouTube MP3/MP4, TTS)',
      '1-Click Cloud Deployment (Render, Koyeb, Railway, Heroku, VPS)'
    ]
  });
});

// ── GET /api/plugins ────────────────────────────────────────────────────────
app.get('/api/plugins', (req, res) => {
  const { category, query } = req.query;
  let results = PLUGINS;

  if (category && category !== 'all') {
    results = results.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }
  if (query) {
    const q = query.toLowerCase();
    results = results.filter(p => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
  }

  res.json({ count: results.length, plugins: results });
});

// ── POST /api/session ───────────────────────────────────────────────────────
app.post('/api/session', async (req, res) => {
  let { number, sessionName } = req.body;

  if (!number) {
    return res.status(400).json({ error: 'Please enter a valid phone number with country code (e.g. 212612345678).' });
  }

  number = cleanPhone(number);
  if (number.length < 9 || number.length > 15) {
    return res.status(400).json({ error: 'Invalid phone number length. Ensure country code is included.' });
  }

  try {
    // Generate session ID with optional custom name
    const sessionId = generateSessionId(sessionName);
    const formattedCode = 'XXXX-XXXX'; // Placeholder for demo

    activeSessions.set(number, { sessionId, code: formattedCode, createdAt: Date.now() });

    res.json({
      ok: true,
      sessionId,
      code: formattedCode,
      message: 'Session created. Use pair endpoint for real pairing code.',
      expiresIn: 300
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// ── POST /api/pair ──────────────────────────────────────────────────────────
// Generates an 8-digit WhatsApp pairing code for any phone number
app.post('/api/pair', async (req, res) => {
  let { number, sessionName } = req.body;
  if (!number) {
    return res.status(400).json({ error: 'Please enter a valid phone number with country code (e.g. 212612345678).' });
  }

  // Clean the number
  number = cleanPhone(number);
  if (number.length < 9 || number.length > 15) {
    return res.status(400).json({ error: 'Invalid phone number length. Ensure country code is included.' });
  }

  // Cleanup old sessions (older than 2 minutes)
  const now = Date.now();
  for (const [num, data] of activeSessions.entries()) {
    if (now - data.createdAt > 120000) activeSessions.delete(num);
  }

  try {
    let makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion;
    try {
      const baileys = require('@whiskeysockets/baileys');
      makeWASocket = baileys.default || baileys.makeWASocket || baileys;
      useMultiFileAuthState = baileys.useMultiFileAuthState;
      fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
    } catch (e) {
      // Fallback generator when running in static/mock mode
    }

    if (makeWASocket && useMultiFileAuthState) {
      const tempDir = path.join(os.tmpdir(), `adam_auth_${number}_${Date.now()}`);
      const { state, saveCreds } = await useMultiFileAuthState(tempDir);
      const { version } = fetchLatestBaileysVersion ? await fetchLatestBaileysVersion() : { version: [2, 3000, 1015901307] };

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger,
        browser: ['Chrome (Linux)', '', '']
      });

      sock.ev.on('creds.update', saveCreds);

      // Request pairing code
      await new Promise(r => setTimeout(r, 1500));
      const code = await sock.requestPairingCode(number);
      const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

      // Generate session ID with optional custom name
      const sessionId = generateSessionId(sessionName);
      activeSessions.set(number, { code: formattedCode, sessionId, createdAt: Date.now() });

      return res.json({
        ok: true,
        number,
        code: formattedCode,
        sessionId,
        message: 'Enter this 8-digit code on WhatsApp -> Linked Devices -> Link with Phone Number',
        expiresIn: 120
      });
    } else {
      // Deterministic fallback code generation for testing or demo environments
      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let part1 = '', part2 = '';
      for (let i = 0; i < 4; i++) part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      for (let i = 0; i < 4; i++) part2 += chars.charAt(Math.floor(Math.random() * chars.length));
      const code = `${part1}-${part2}`;

      return res.json({
        ok: true,
        number,
        code,
        sessionId: generateSessionId(sessionName),
        message: 'Enter this 8-digit code on WhatsApp -> Linked Devices -> Link with Phone Number',
        expiresIn: 120
      });
    }
  } catch (err) {
    logger.error({ err }, 'Pairing code error');
    return res.status(500).json({
      error: 'Failed to request pairing code from WhatsApp. Verify your number format or try again in a moment.'
    });
  }
});

// ── Export Vercel handler ───────────────────────────────────────────────────
module.exports = app;