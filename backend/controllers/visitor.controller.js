const {
  startSession, recordPageView, endSession,
  visitorExists, getAllVisitors, getVisitorDetail,
  getVisitorStats, getPublicVisitorStats
} = require('../models/visitors');

// ── Résolution IP → géolocalisation ──────────────────────────────────────────
async function resolveGeo(ip) {
  const localIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
  if (!ip || localIPs.includes(ip)) {
    return { country: 'unknown', city: 'unknown', region: 'unknown', timezone: 'unknown' };
  }
  try {
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: global.fetch }));
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,regionName,timezone`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('geo fetch failed');
    const data = await res.json();
    return {
      country:  data.country  || 'unknown',
      city:     data.city     || 'unknown',
      region:   data.regionName || 'unknown',
      timezone: data.timezone || 'unknown'
    };
  } catch {
    return { country: 'unknown', city: 'unknown', region: 'unknown', timezone: 'unknown' };
  }
}

// POST /api/visitors/start
const startVisitorSession = async (req, res, next) => {
  try {
    const { visitorId, sessionId, language, device, os, browser, timezone } = req.body;
    if (!visitorId || !sessionId) return res.status(400).json({ error: 'visitorId et sessionId requis' });

    const ip = (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) || req.socket?.remoteAddress || 'unknown';
    const geo = await resolveGeo(ip);
    const isReturning = await visitorExists(visitorId);

    await startSession({
      visitorId, sessionId,
      ipAddress: ip,
      country:   geo.country,
      city:      geo.city,
      region:    geo.region,
      timezone:  timezone || geo.timezone,
      language:  language  || 'unknown',
      device:    device    || 'unknown',
      os:        os        || 'unknown',
      browser:   browser   || 'unknown',
      isReturning
    });

    return res.status(201).json({ visitorId, sessionId, isReturning });
  } catch (err) {
    console.error('START SESSION ERROR:', err.message);
    next(err);
  }
};

// POST /api/visitors/page-view
const trackPageView = async (req, res, next) => {
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

    const { sessionId, pageUrl, referrer } = body;
    if (!sessionId || !pageUrl) return res.status(400).json({ error: 'sessionId et pageUrl requis' });

    const recorded = await recordPageView(sessionId, pageUrl, referrer || '');
    if (!recorded) return res.status(404).json({ error: 'Session introuvable, démarrez une session d\'abord' });
    return res.status(201).json({ message: 'Page vue enregistrée' });
  } catch (err) {
    console.error('PAGE VIEW ERROR:', err.message);
    next(err);
  }
};

// POST /api/visitors/end-session
const endVisitorSession = async (req, res, next) => {
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

    const { sessionId, duration } = body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId requis' });

    await endSession(sessionId, duration || 0);
    return res.status(200).json({ message: 'Session terminée' });
  } catch (err) {
    console.error('END SESSION ERROR:', err.message);
    next(err);
  }
};

// GET /api/visitors  (admin)
const getVisitors = async (req, res, next) => {
  try {
    const { search, country, city, device, browser, dateFrom, dateTo } = req.query;
    const visitors = await getAllVisitors({ search, country, city, device, browser, dateFrom, dateTo });
    return res.status(200).json({ visitors });
  } catch (err) {
    console.error('GET VISITORS ERROR:', err.message);
    next(err);
  }
};

// GET /api/visitors/:visitorId  (admin)
const getVisitorDetailCtrl = async (req, res, next) => {
  try {
    const data = await getVisitorDetail(req.params.visitorId);
    return res.status(200).json(data);
  } catch (err) {
    console.error('GET VISITOR DETAIL ERROR:', err.message);
    next(err);
  }
};

// GET /api/visitors/stats  (admin)
const getStats = async (req, res, next) => {
  try {
    const stats = await getVisitorStats();
    return res.status(200).json(stats);
  } catch (err) {
    console.error('GET STATS ERROR:', err.message);
    next(err);
  }
};

// GET /api/visitors/public-stats
const getPublicStats = async (req, res, next) => {
  try {
    const stats = await getPublicVisitorStats();
    return res.status(200).json(stats);
  } catch (err) {
    console.error('GET PUBLIC STATS ERROR:', err.message);
    next(err);
  }
};

module.exports = { startVisitorSession, trackPageView, endVisitorSession, getVisitors, getVisitorDetailCtrl, getStats, getPublicStats };
