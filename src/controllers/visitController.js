const Visit = require('../models/Visit');

const BOT_UA = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp/i;

function bogotaStart(kind) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year').value;
  const month = parts.find((part) => part.type === 'month').value;
  const day = kind === 'month' ? '01' : parts.find((part) => part.type === 'day').value;
  return new Date(`${year}-${month}-${day}T00:00:00-05:00`);
}

function sanitizeVisitorId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80);
}

function sanitizePath(value) {
  const path = String(value || '/').trim() || '/';
  if (!path.startsWith('/')) return '/';
  if (path.startsWith('/admin')) return '';
  return path.slice(0, 200);
}

const visitController = {
  track: async (req, res) => {
    try {
      const ua = String(req.get('user-agent') || '');
      if (BOT_UA.test(ua)) {
        return res.status(204).send();
      }

      const visitorId = sanitizeVisitorId(req.body?.visitorId);
      const path = sanitizePath(req.body?.path);
      if (!visitorId || !path) {
        return res.status(204).send();
      }

      await Visit.create({ visitorId, path });
      return res.status(204).send();
    } catch {
      return res.status(204).send();
    }
  },
};

async function getVisitStats() {
  const startToday = bogotaStart('day');
  const startMonth = bogotaStart('month');

  const [visitasHoy, personasHoy, personasMes, personasTotal] = await Promise.all([
    Visit.countDocuments({ createdAt: { $gte: startToday } }),
    Visit.distinct('visitorId', { createdAt: { $gte: startToday } }),
    Visit.distinct('visitorId', { createdAt: { $gte: startMonth } }),
    Visit.distinct('visitorId'),
  ]);

  return {
    visitasHoy,
    personasHoy: personasHoy.length,
    personasMes: personasMes.length,
    personasTotal: personasTotal.length,
  };
}

module.exports = {
  visitController,
  getVisitStats,
};
