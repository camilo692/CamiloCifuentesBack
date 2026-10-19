const { verifyWompiEvent, applyWompiTransaction } = require('../services/wompiService');

const wompiController = {
  handleEvent: async (req, res) => {
    try {
      const checksum = req.headers['x-event-checksum'];
      if (!verifyWompiEvent(req.body, checksum)) {
        return res.status(200).json({ ok: false, reason: 'firma inválida' });
      }

      if (req.body.event !== 'transaction.updated') {
        return res.status(200).json({ ok: true, ignored: true });
      }

      const result = await applyWompiTransaction(req.body.data?.transaction);
      return res.status(200).json({ ok: true, result });
    } catch (error) {
      console.error('Wompi webhook:', error.message);
      return res.status(500).json({ message: error.message });
    }
  },
};

module.exports = wompiController;
