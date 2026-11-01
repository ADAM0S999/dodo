export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    name: '🤖 ADAM WhatsApp Bot',
    version: '2.0.0',
    description: 'High-performance WhatsApp automation bot built on Baileys with multi-session, QR & Pairing code capabilities.',
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
}
