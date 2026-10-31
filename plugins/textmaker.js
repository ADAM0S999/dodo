'use strict';

/**
 * ADAM Bot — plugins/textmaker.js
 * Text effect generators (Gists 2 & 3: .adglow & .eglow)
 */

const { bot, textMaker } = require('../lib/');

// ── 1. Advanced Glow (.adglow) ────────────────────────────────────────────────
bot(
  {
    pattern  : 'adglow',
    desc     : 'تأثير نص التوهج المتقدم (Advanced Glow effects)',
    category : 'textmaker',
    usage    : '.adglow <text>',
  },
  async (sock, msg, { jid, args, raw, reply }) => {
    const text = args.join(' ').trim();
    if (!text) {
      return reply('⚠️ _يرجى كتابة النص المراد تحويله_\n💠 *مثال*: `.adglow ADAM`');
    }

    await reply('⏳ _جاري إنشاء تأثير التوهج المتقدم (Advanced Glow)..._');

    const effectUrl = 'https://en.ephoto360.com/advanced-glow-effects-74.html';
    const result = await textMaker(effectUrl, text);

    if (result.status && result.url) {
      return sock.sendMessage(
        jid,
        {
          image: { url: result.url },
          caption: `✨ *تأثير:* Advanced Glow\n📝 *النص:* ${text}\n> ⚡ ADAM Bot`,
        },
        { quoted: raw }
      );
    }

    return reply(`❌ فشل في إنشاء الصورة: ${result.error || 'يرجى المحاولة لاحقاً'}`);
  }
);

// ── 2. Glowing Text (.eglow) ──────────────────────────────────────────────────
bot(
  {
    pattern  : 'eglow',
    desc     : 'تأثير النص المضيء المتوهج (Glowing Text effects)',
    category : 'textmaker',
    usage    : '.eglow <text>',
  },
  async (sock, msg, { jid, args, raw, reply }) => {
    const text = args.join(' ').trim();
    if (!text) {
      return reply('⚠️ _يرجى كتابة النص المراد تحويله_\n💠 *مثال*: `.eglow ADAM`');
    }

    await reply('⏳ _جاري إنشاء تأثير النص المضيء (Glowing Text)..._');

    const effectUrl = 'https://en.ephoto360.com/create-glowing-text-effects-online-706.html';
    const result = await textMaker(effectUrl, text);

    if (result.status && result.url) {
      return sock.sendMessage(
        jid,
        {
          image: { url: result.url },
          caption: `✨ *تأثير:* Glowing Text\n📝 *النص:* ${text}\n> ⚡ ADAM Bot`,
        },
        { quoted: raw }
      );
    }

    return reply(`❌ فشل في إنشاء الصورة: ${result.error || 'يرجى المحاولة لاحقاً'}`);
  }
);
