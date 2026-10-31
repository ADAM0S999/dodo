const fs = require('fs');
const p = 'index.html';
let c = fs.readFileSync(p, 'utf8');

// 1. Update button text (already done but ensure)
c = c.replace(
  '<span id="btn-text">⚡ Get Pairing Code</span>',
  '<span id="btn-text">⚡ Get WhatsApp Pairing Code</span>'
);

// 2. Update result box: label text color + text
c = c.replace(
  '<p class="text-xs text-zinc-400 uppercase tracking-wider font-mono mb-2">Your 8-Digit Pairing Code</p>',
  '<p class="text-xs text-emerald-400 uppercase tracking-wider font-mono mb-2">✅ Real WhatsApp 8-Digit Pairing Code</p>'
);

// 3. Update code-display: cyan -> emerald
c = c.replace(
  'id="code-display" class="font-mono text-3xl md:text-4xl font-extrabold tracking-widest text-cyan-400 bg-zinc-900 px-6 py-3 rounded-xl border border-cyan-800/80 select-all"',
  'id="code-display" class="font-mono text-3xl md:text-4xl font-extrabold tracking-widest text-emerald-400 bg-zinc-900 px-6 py-3 rounded-xl border border-emerald-800/80 select-all"'
);

// 4. Add expiry note after code-msg paragraph
c = c.replace(
  '<p id="code-msg" class="text-xs text-emerald-400 mt-3 font-medium">Enter this code in WhatsApp within 2 minutes!</p>\n          </div>',
  '<p id="code-msg" class="text-xs text-emerald-400 mt-3 font-medium">Enter this code in WhatsApp within 2 minutes!</p>\n            <p class="text-[11px] text-zinc-500 mt-1">⏱ Code expires in ~2 minutes. Click the button again if it expires.</p>\n          </div>'
);

// 5. Update instructions card: zinc -> emerald theme
c = c.replace(
  '<div class="mt-6 bg-zinc-900/60 rounded-xl p-4 border border-zinc-800 text-xs space-y-2 text-zinc-300">',
  '<div class="mt-6 bg-emerald-950/20 rounded-xl p-4 border border-emerald-800/40 text-xs space-y-2 text-zinc-300">'
);

// 6. Update step numbers: cyan -> emerald (instructions)
c = c.replace(/<span class="text-cyan-400 font-bold">(\d\.)<\/span>/g, '<span class="text-emerald-400 font-bold">$1</span>');

// 7. Fix the curl example URL: dodo.vercel.app -> lm7bos.vercel.app
c = c.replace('https://dodo.vercel.app/api/send', 'https://lm7bos.vercel.app/api/send');

// 8. Update btn-text reset in JS (when button re-enables after API call)
c = c.replace(
  "text.innerText = '⚡ Get Pairing Code';\n\n        if (data.ok",
  "text.innerText = '⚡ Get WhatsApp Pairing Code';\n\n        if (data.ok"
);
c = c.replace(
  "text.innerText = '⚡ Get Pairing Code';\n        showCloudPairingGuide",
  "text.innerText = '⚡ Get WhatsApp Pairing Code';\n        showCloudPairingGuide"
);

fs.writeFileSync(p, c, 'utf8');
console.log('Patch applied successfully!');
