const uploadController = {
  uploadImage: (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No se recibió ninguna imagen' });
    }

    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
    const url = `${baseUrl}/uploads/${req.file.filename}`;

    res.status(201).json({
      message: 'Imagen subida exitosamente',
      url,
      filename: req.file.filename
    });
  }
};

module.exports = uploadController;
