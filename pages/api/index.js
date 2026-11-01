export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    bot: '🤖 ADAM WhatsApp Bot',
    version: '2.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    endpoints: {
      pair: '/api/pair (POST)',
      info: '/api/info (GET)'
    }
  });
}
