'use strict';

/**
 * ADAM Bot — lib/client.js
 * Creates and manages the Baileys WhatsApp client.
 * Loads all plugins, handles message routing, group event handling, etc.
 */

const path    = require('path');
const fs      = require('fs');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const NodeCache = require('node-cache');

const config        = require('../config');
const { findCommands, commands } = require('./events');
const { getPdm }    = require('./db/pdm');
const { getGarm }   = require('./db/garm');

// ── Load all plugins ──────────────────────────────────────────────────────────
const pluginsDir = path.join(__dirname, '../plugins');
const loadPlugins = () => {
  const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      require(path.join(pluginsDir, file));
    } catch (err) {
      console.error(`[ADAM] Failed to load plugin ${file}:`, err.message);
    }
  }
  console.log(`[ADAM] ✅ Loaded ${files.length} plugin(s) — ${commands.length} command(s) registered.`);
};

// ── Rate Limiter (simple in-memory) ──────────────────────────────────────────
const cooldowns = new Map();
const COOLDOWN_MS = 2000; // 2 seconds per user per command

const isRateLimited = (jid, cmdName) => {
  const key = `${jid}:${cmdName}`;
  const now  = Date.now();
  const last = cooldowns.get(key) || 0;
  if (now - last < COOLDOWN_MS) return true;
  cooldowns.set(key, now);
  return false;
};

// ── Auth store ────────────────────────────────────────────────────────────────
const AUTH_DIR = path.join(__dirname, '../auth_info_baileys');

/**
 * Initialize session directory and restore credentials from SESSION_ID if provided.
 * Supports Base64 SESSION_ID (e.g. ADAM~<b64> or adam_session_<b64>) or direct URL.
 */
const initSession = async (logger) => {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const credsPath = path.join(AUTH_DIR, 'creds.json');
  if (fs.existsSync(credsPath)) {
    return; // Already initialized
  }

  const rawSession = (config.SESSION_ID || process.env.SESSION_ID || '').trim();
  if (!rawSession || rawSession === 'adam_sessionid') return;

  try {
    if (rawSession.startsWith('http://') || rawSession.startsWith('https://')) {
      const axios = require('axios');
      const res = await axios.get(rawSession, { timeout: 10000 });
      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      fs.writeFileSync(credsPath, JSON.stringify(data, null, 2));
      logger.info('✅ Successfully restored credentials from SESSION_ID URL.');
    } else {
      let clean = rawSession;
      if (clean.includes('~')) clean = clean.split('~')[1];
      else if (clean.startsWith('lm7bos_')) clean = clean.replace('lm7bos_', '');
      else if (clean.startsWith('adam_session_')) clean = clean.replace('adam_session_', '');
      else if (clean.startsWith('session_')) clean = clean.replace('session_', '');

      const decoded = Buffer.from(clean, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      fs.writeFileSync(credsPath, JSON.stringify(parsed, null, 2));
      logger.info('✅ Successfully restored credentials from Base64 SESSION_ID.');
    }
  } catch (err) {
    logger.warn(`Could not restore SESSION_ID: ${err.message}. A new session will be created.`);
  }
};

/**
 * Create and return a connected WhatsApp client.
 * @param {{ logger: import('pino').Logger }} opts
 */
const createClient = async ({ logger }) => {
  loadPlugins();
  await initSession(logger);

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  const msgRetryCache = new NodeCache();

  const sock = makeWASocket({
    version,
    logger          : logger.child({ module: 'baileys' }).child({ level: config.BAILEYS_LOG_LVL }),
    browser         : ['Ubuntu', 'Chrome', '20.0.04'],
    auth            : {
      creds : state.creds,
      keys  : makeCacheableSignalKeyStore(state.keys, logger),
    },
    msgRetryCounterCache : msgRetryCache,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect            : config.ALWAYS_ONLINE,
    getMessage: async () => undefined,
  });

  // ── Pairing Code Request (Phone Number Linking) ───────────────────────────
  const pairNumber = (config.PAIR_NUMBER || process.env.PAIR_NUMBER || '').replace(/[^0-9]/g, '');
  if (!sock.authState.creds.registered && pairNumber) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(pairNumber);
        const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    ⚡ ADAM BOT PAIRING CODE ⚡                   ║
╠══════════════════════════════════════════════════════════════════╣
║  Phone Number : +${pairNumber.padEnd(46)}║
║  PAIRING CODE : \x1b[1;32m${formatted}\x1b[0m                                             ║
╠══════════════════════════════════════════════════════════════════╣
║  1. Open WhatsApp on your phone                                  ║
║  2. Tap ⋮ (Menu) or Settings > Linked Devices                    ║
║  3. Tap "Link a Device" > "Link with phone number instead"       ║
║  4. Enter the 8-digit code above: \x1b[1;32m${formatted}\x1b[0m                      ║
╚══════════════════════════════════════════════════════════════════╝
`);
      } catch (err) {
        logger.error(`Failed to request pairing code for +${pairNumber}: ${err.message || err}`);
      }
    }, 3500);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  sock.ev.on('creds.update', saveCreds);

  // ── Connection ────────────────────────────────────────────────────────────
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    // Only display terminal QR code if not pairing with phone number
    if (qr && !pairNumber) {
      require('qrcode-terminal').generate(qr, { small: true });
      logger.info('📱 Scan the QR code above with WhatsApp to connect ADAM bot.');
    }
    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      logger.warn(`Connection closed (code ${code}). Reconnect: ${shouldReconnect}`);
      if (shouldReconnect) createClient({ logger });
    } else if (connection === 'open') {
      logger.info('⚡ WhatsApp connection established!');

      // Output SESSION_ID for easy environment variable copying
      try {
        const credsPath = path.join(AUTH_DIR, 'creds.json');
        if (fs.existsSync(credsPath)) {
          const credsData = fs.readFileSync(credsPath, 'utf8');
          const sessionId = `lm7bos_${Buffer.from(credsData).toString('base64')}`;
          console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                   🎉 BOT CONNECTED TO WHATSAPP!                  ║
╠══════════════════════════════════════════════════════════════════╣
║  Your SESSION_ID (Save this in Render/Koyeb environment):        ║
║                                                                  ║
║  SESSION_ID=${sessionId.slice(0, 36)}...                         ║
╚══════════════════════════════════════════════════════════════════╝
`);
        }
      } catch (_) {}

      if (!config.DISABLE_START_MESSAGE) {
        logger.info('ADAM bot is live and ready.');
      }
    }
  });

  // ── Messages ──────────────────────────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const raw of messages) {
      try {
        await handleMessage(sock, raw, logger);
      } catch (err) {
        logger.error({ err }, 'Error handling message');
      }
    }
  });

  // ── Group Participants Update (PDM & GARM) ────────────────────────────────
  sock.ev.on('group-participants.update', async ({ id, author, participants, action }) => {
    try {
      if (!Array.isArray(participants) || !participants.length) return;

      // 1. PDM: Promote & Demote Notifications
      if (action === 'promote' || action === 'demote') {
        const pdmEnabled = await getPdm(id);
        if (pdmEnabled) {
          const mentions = [];
          if (author) mentions.push(author);
          participants.forEach(p => mentions.push(p));

          const usersText = participants.map(p => `@${p.split('@')[0]}`).join(', ');
          const authorText = author ? `@${author.split('@')[0]}` : 'إدارة المجموعة';

          let text = '';
          if (action === 'promote') {
            text = `📢 *إشعار إشراف (PDM)*\n\n✨ *تم ترقية العضو:* ${usersText}\n👑 *بواسطة المشرف:* ${authorText}\n📅 *الوقت:* ${new Date().toLocaleTimeString()}`;
          } else {
            text = `📢 *إشعار إشراف (PDM)*\n\n🔻 *تم تنزيل العضو:* ${usersText} من الإشراف\n👑 *بواسطة المشرف:* ${authorText}\n📅 *الوقت:* ${new Date().toLocaleTimeString()}`;
          }

          await sock.sendMessage(id, { text, mentions });
        }
      }

      // 2. GARM: Accept / Reject & Direct Add / Remove Notifications
      if (action === 'add' || action === 'remove') {
        const garmEnabled = await getGarm(id);
        if (garmEnabled) {
          const mentions = [];
          if (author) mentions.push(author);
          participants.forEach(p => mentions.push(p));

          const usersText = participants.map(p => `@${p.split('@')[0]}`).join(', ');
          const authorText = author ? `@${author.split('@')[0]}` : null;

          if (authorText && !participants.includes(author)) {
            let text = '';
            if (action === 'add') {
              text = `🟢 *إشعار قبول / إضافة عضو (GARM)*\n\n✅ *العضو المقبول:* ${usersText}\n👑 *بواسطة المشرف:* ${authorText}\n📅 *الوقت:* ${new Date().toLocaleTimeString()}`;
            } else if (action === 'remove') {
              text = `🔴 *إشعار رفض / طرد عضو (GARM)*\n\n❌ *العضو المرفوض/المطرود:* ${usersText}\n👑 *بواسطة المشرف:* ${authorText}\n📅 *الوقت:* ${new Date().toLocaleTimeString()}`;
            }
            if (text) {
              await sock.sendMessage(id, { text, mentions });
            }
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error handling group-participants.update');
    }
  });

  // ── Group Join Request Update (GARM: Accept / Reject Approval Requests) ───
  sock.ev.on('group-join-request.update', async ({ id, author, participant, action, method }) => {
    try {
      const garmEnabled = await getGarm(id);
      if (!garmEnabled) return;

      const mentions = [];
      if (author) mentions.push(author);
      if (participant) mentions.push(participant);

      const userText = participant ? `@${participant.split('@')[0]}` : 'عضو';
      const authorText = author ? `@${author.split('@')[0]}` : 'مشرف';

      if (action === 'approved') {
        const text = `🟢 *إشعار قبول طلب الانضمام (GARM)*\n\n✅ *العضو:* ${userText}\n👑 *تم القبول بواسطة المشرف:* ${authorText}\n📅 *الوقت:* ${new Date().toLocaleTimeString()}`;
        await sock.sendMessage(id, { text, mentions });
      } else if (action === 'rejected') {
        const text = `🔴 *إشعار رفض طلب الانضمام (GARM)*\n\n❌ *العضو:* ${userText}\n👑 *تم الرفض بواسطة المشرف:* ${authorText}\n📅 *الوقت:* ${new Date().toLocaleTimeString()}`;
        await sock.sendMessage(id, { text, mentions });
      }
    } catch (err) {
      logger.error({ err }, 'Error handling group-join-request.update');
    }
  });

  // ── Call rejection ────────────────────────────────────────────────────────
  if (config.REJECT_CALL) {
    sock.ev.on('call', async (calls) => {
      for (const call of calls) {
        if (call.status === 'offer') {
          await sock.rejectCall(call.id, call.from);
          logger.info(`📵 Rejected call from ${call.from}`);
        }
      }
    });
  }

  return sock;
};

// ── Message Handler ───────────────────────────────────────────────────────────
async function handleMessage(sock, raw, logger) {
  if (!raw.message) return;
  if (raw.key.remoteJid === 'status@broadcast') return;

  const jid     = raw.key.remoteJid;
  const isGroup = jid.endsWith('@g.us');
  const fromMe  = raw.key.fromMe;
  const sender  = fromMe ? sock.user.id : (raw.key.participant || jid);

  if (config.DISABLE_BOT && !config.SUDO.some(s => sender.startsWith(s))) return;

  // Extract text from various message types
  const text = (
    raw.message.conversation ||
    raw.message.extendedTextMessage?.text ||
    raw.message.imageMessage?.caption ||
    raw.message.videoMessage?.caption ||
    raw.message.documentMessage?.caption ||
    ''
  ).trim();

  if (config.LOG_MSG && text) {
    logger.info({ from: sender, jid, text: text.slice(0, 80) }, 'MSG');
  }

  if (!text.startsWith(config.PREFIX) && !config.MENTION) return;

  const matches = findCommands(text, config.PREFIX);
  if (!matches.length) return;

  for (const { cmd, match } of matches) {
    // Owner-only commands
    if (cmd.fromMe && !config.SUDO.some(s => sender.startsWith(s))) continue;
    // Group-only commands
    if (cmd.isGroup && !isGroup) {
      await sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: raw });
      continue;
    }

    // Rate limiting
    const cmdName = typeof cmd.pattern === 'string' ? cmd.pattern : cmd.pattern.source;
    if (isRateLimited(sender, cmdName)) {
      await sock.sendMessage(jid, { text: '⏳ You are sending commands too fast. Please slow down.' }, { quoted: raw });
      continue;
    }

    // Build context object passed to every handler
    const args = text.slice(config.PREFIX.length + cmdName.length).trim().split(/\s+/).filter(Boolean);
    const ctx  = {
      args,
      text    : args.join(' '),
      sender,
      jid,
      isGroup,
      fromMe,
      prefix  : config.PREFIX,
      match,
      raw,
      logger,
      config,
      reply   : (content) => sock.sendMessage(jid, typeof content === 'string' ? { text: content } : content, { quoted: raw }),
    };

    try {
      await cmd.handler(sock, raw, ctx);
    } catch (err) {
      logger.error({ err, cmd: cmdName }, 'Command handler error');
      await sock.sendMessage(jid, { text: `❌ An error occurred while running that command.\n\`${err.message}\`` }, { quoted: raw });
    }
  }
}

module.exports = { createClient };
