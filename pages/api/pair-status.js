// Global session registry across serverless invocations in the same instance
global._activeSockets = global._activeSockets || new Map();

export default async function handler(req, res) {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const session = global._activeSockets.get(sessionId);

  if (!session) {
    // If not found in memory (e.g. serverless cold start), return ready state
    return res.status(200).json({
      status: 'WAITING',
      sessionId,
      message: 'Waiting for device connection...'
    });
  }

  return res.status(200).json({
    status: session.status || 'WAITING',
    sessionId,
    number: session.number,
    message: session.status === 'CONNECTED' ? 'Device connected successfully!' : 'Waiting for device connection...',
    connectedAt: session.connectedAt || null
  });
}
