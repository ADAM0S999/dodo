'use strict';

/**
 * ADAM Bot — plugins/pdm.js
 * Promote / Demote Messages (PDM) Command
 * Enables or disables automatic notifications when a group member is promoted or demoted.
 */

const { bot, isAdmin, setPdm, getPdm } = require('../lib/');

bot(
  {
    pattern  : 'pdm',
    desc     : 'إشعارات ترقية وتنزيل المشرفين (Promote / Demote Alerts)',
    category : 'group',
    usage    : '.pdm on | off',
    isGroup  : true,
    adminOnly: true,
  },
  async (sock, msg, { jid, sender, args, reply }) => {
    // Assert user is an admin or sudo
    const meta = await sock.groupMetadata(jid).catch(() => null);
    if (meta && !isAdmin(meta.participants, sender)) {
      return reply('❌ هذا الأمر مخصص لمشرفي المجموعة فقط.\n_This command is only for group admins._');
    }

    const mode = (args[0] || '').toLowerCase();

    if (!mode) {
      const current = await getPdm(jid);
      return reply(
        `📢 *إعدادات إشعارات الإشراف (PDM)*\n\n` +
        `• الحالة الحالية: *${current ? 'مُفعّلة (ON) ✅' : 'مُعطّلة (OFF) ❌'}*\n\n` +
        `📌 *طريقة الاستخدام:*\n` +
        `• \`.pdm on\` ⬅️ لتفعيل إشعارات الترقية والتنزيل\n` +
        `• \`.pdm off\` ⬅️ لتعطيل الإشعارات`
      );
    }

    if (mode === 'on' || mode === 'enable' || mode === '1') {
      await setPdm(jid, 'on');
      return reply('✅ تم تفعيل إشعارات الترقية والتنزيل (*PDM*) بنجاح في هذه المجموعة.\n_Promote & Demote alerts are now ENABLED._');
    }

    if (mode === 'off' || mode === 'disable' || mode === '0') {
      await setPdm(jid, 'off');
      return reply('❌ تم إيقاف إشعارات الترقية والتنزيل (*PDM*) في هذه المجموعة.\n_Promote & Demote alerts are now DISABLED._');
    }

    return reply(
      `⚠️ خيار غير صالح. يرجى استخدام:\n• \`.pdm on\`\n• \`.pdm off\``
    );
  }
);
