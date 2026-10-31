'use strict';

/**
 * ADAM Bot — plugins/menu.js
 * Shows the bot menu, help text, and command list (based on Gist 1).
 */

const {
  bot,
  addSpace,
  textToStylist,
  getUptime,
  getRam,
  getDate,
  getPlatform,
  commands,
} = require('../lib/');
const config = require('../config');

// ── 1. HELP COMMAND ───────────────────────────────────────────────────────────
bot(
  {
    pattern  : 'help',
    desc     : 'عرض قائمة الأوامر المرقمة (Numbered command list)',
    category : 'general',
    usage    : '.help',
  },
  async (sock, msg, { jid, raw, reply, sender }) => {
    const pushName = raw.pushName || sender.split('@')[0];
    const [date, time] = getDate();

    const sorted = [...commands].sort((a, b) => {
      const nameA = typeof a.pattern === 'string' ? a.pattern : a.pattern?.source || '';
      const nameB = typeof b.pattern === 'string' ? b.pattern : b.pattern?.source || '';
      return nameA.localeCompare(nameB);
    });

    let CMD_HELP = `╭────────────────╮
  DODO👑💚🦅
╰────────────────╯
╭────────────────
│ Prefix : ${config.PREFIX}
│ User : ${pushName}
│ Time : ${time}
│ Day : ${date.toLocaleString('en', { weekday: 'long' })}
│ Date : ${date.toLocaleDateString()}
│ Version : ${config.VERSION}
│ Commands : ${sorted.length}
│ Ram : ${getRam()}
│ Uptime : ${getUptime()}
│ Platform : ${getPlatform()}
╰────────────────
╭────────────────
`;

    sorted.forEach((command, i) => {
      if (!command.hidden) {
        const cmdName = typeof command.pattern === 'string' ? command.pattern : command.pattern.source;
        CMD_HELP += `│ ${i + 1} ${addSpace(i + 1, sorted.length)}${textToStylist(cmdName.toUpperCase(), 'mono')}\n`;
      }
    });

    CMD_HELP += `╰────────────────`;
    return reply('```' + CMD_HELP + '```');
  }
);

// ── 2. LIST COMMAND ───────────────────────────────────────────────────────────
bot(
  {
    pattern  : 'list',
    desc     : 'قائمة الأوامر مع الوصف (List commands with descriptions)',
    category : 'general',
    usage    : '.list',
  },
  async (sock, msg, { reply }) => {
    const sorted = [...commands].sort((a, b) => {
      const nameA = typeof a.pattern === 'string' ? a.pattern : a.pattern?.source || '';
      const nameB = typeof b.pattern === 'string' ? b.pattern : b.pattern?.source || '';
      return nameA.localeCompare(nameB);
    });

    let msgText = '';
    sorted.forEach((command, index) => {
      if (!command.hidden) {
        const cmdName = typeof command.pattern === 'string' ? command.pattern : command.pattern.source;
        msgText += `${index + 1} ${config.PREFIX}${cmdName}\n${command.desc || 'No description'}\n\n`;
      }
    });

    return reply('```' + msgText.trim() + '```');
  }
);

// ── 3. MENU COMMAND ───────────────────────────────────────────────────────────
bot(
  {
    pattern  : 'menu',
    desc     : 'قائمة البوت الرئيسية المصنفة (Categorized Menu)',
    category : 'general',
    usage    : '.menu [category]',
  },
  async (sock, msg, { args, raw, reply, sender }) => {
    const match = (args[0] || '').toLowerCase().trim();
    const pushName = raw.pushName || sender.split('@')[0];
    const [date, time] = getDate();

    const categorized = {};
    for (const cmd of commands) {
      if (cmd.hidden) continue;
      const cat = (cmd.category || 'misc').toLowerCase();
      if (!categorized[cat]) categorized[cat] = [];
      const cmdName = typeof cmd.pattern === 'string' ? cmd.pattern : cmd.pattern.source;
      categorized[cat].push(cmdName);
    }

    let header = `\`\`\`╭═══ DODO👑💚🦅 ═══⊷
┃❃╭──────────────
┃❃│ Prefix : ${config.PREFIX}
┃❃│ User : ${pushName}
┃❃│ Time : ${time}
┃❃│ Day : ${date.toLocaleString('en', { weekday: 'long' })}
┃❃│ Date : ${date.toLocaleDateString()}
┃❃│ Version : ${config.VERSION}
┃❃│ Commands : ${commands.length}
┃❃│ Ram : ${getRam()}
┃❃│ Uptime : ${getUptime()}
┃❃│ Platform : ${getPlatform()}
┃❃╰───────────────
╰═════════════════⊷\`\`\`\n`;

    // Filter by specific category if provided
    if (match && categorized[match]) {
      header += ` ╭─❏ ${textToStylist(match.toLowerCase(), 'smallcaps')} ❏\n`;
      for (const cmdName of categorized[match]) {
        header += ` │ ${config.PREFIX}${textToStylist(cmdName.toLowerCase(), 'mono')}\n`;
      }
      header += ` ╰─────────────────`;
      return reply(header);
    }

    // Display all categories
    for (const cat in categorized) {
      header += ` ╭─❏ ${textToStylist(cat.toUpperCase(), 'smallcaps')} ❏\n`;
      for (const cmdName of categorized[cat]) {
        header += ` │ ${config.PREFIX}${textToStylist(cmdName.toLowerCase(), 'mono')}\n`;
      }
      header += ` ╰─────────────────\n`;
    }

    return reply(header.trim());
  }
);
