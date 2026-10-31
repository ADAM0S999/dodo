'use strict';

/**
 * ADAM Bot — plugins/garm.js
 * Group Accept / Reject Monitor (GARM) Command
 * Monitors and notifies the group when an admin accepts or rejects a member request,
 * or directly adds / removes members from the group.
 */

const { bot, isAdmin, setGarm, getGarm } = require('../lib/');

bot(
  {
    pattern  : 'garm',
    desc     : 'إشعارات قبول ورفض الأعضاء (Group Accept / Reject Monitor)',
    category : 'group',
    usage    : '.garm on | off',
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
      const current = await getGarm(jid);
      return reply(
        `🛡️ *إعدادات مراقبة قبول ورفض الأعضاء (GARM)*\n\n` +
        `• الحالة الحالية: *${current ? 'مُفعّلة (ON) ✅' : 'مُعطّلة (OFF) ❌'}*\n\n` +
        `وظيفة الميزة: معرفة المشرف الذي يقبل أو يرفض طلبات الانضمام، أو يضيف ويطرد الأعضاء.\n\n` +
        `📌 *طريقة الاستخدام:*\n` +
        `• \`.garm on\` ⬅️ لتفعيل إشعارات القبول والرفض\n` +
        `• \`.garm off\` ⬅️ لتعطيل الإشعارات`
      );
    }

    if (mode === 'on' || mode === 'enable' || mode === '1') {
      await setGarm(jid, 'on');
      return reply('✅ تم تفعيل مراقبة قبول ورفض الأعضاء (*GARM*) بنجاح.\nسيرسل البوت إشعاراً باسم المشرف الذي يقبل أو يرفض أي عضو!\n_GARM is now ENABLED._');
    }

    if (mode === 'off' || mode === 'disable' || mode === '0') {
      await setGarm(jid, 'off');
      return reply('❌ تم إيقاف مراقبة قبول ورفض الأعضاء (*GARM*) في هذه المجموعة.\n_GARM is now DISABLED._');
    }

    return reply(
      `⚠️ خيار غير صالح. يرجى استخدام:\n• \`.garm on\`\n• \`.garm off\``
    );
  }
);
