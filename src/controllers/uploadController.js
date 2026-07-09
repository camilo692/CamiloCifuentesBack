const r2Service = require('../services/r2Service');

const uploadController = {
  presignUpload: async (req, res) => {
    try {
      const { filename, contentType, folder } = req.body;

      if (!filename || !contentType) {
        return res.status(400).json({ message: 'filename y contentType son requeridos' });
      }

      if (!r2Service.ALLOWED_TYPES.includes(contentType)) {
        return res.status(400).json({ message: 'Tipo de archivo no permitido. Usa JPEG, PNG, WebP o GIF' });
      }

      const result = await r2Service.getPresignedUploadUrl({ filename, contentType, folder });

      res.json({
        message: 'URL de subida generada',
        ...result
      });
    } catch (error) {
      res.status(500).json({ message: error.message || 'Error al generar URL de subida' });
    }
  },

  uploadImage: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No se recibió ninguna imagen' });
      }

      const key = r2Service.buildKey(req.file.originalname);
      const url = await r2Service.uploadBuffer({
        buffer: req.file.buffer,
        key,
        contentType: req.file.mimetype
      });

      res.status(201).json({
        message: 'Imagen subida exitosamente',
        url,
        key,
        filename: key.split('/').pop()
      });
    } catch (error) {
      res.status(500).json({ message: error.message || 'Error al subir imagen' });
    }
  }
};

module.exports = uploadController;
