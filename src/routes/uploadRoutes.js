const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const uploadController = require('../controllers/uploadController');
const auth = require('../middlewares/auth');
const roleAuth = require('../middlewares/roleAuth');

router.post('/presign', auth, roleAuth(['admin']), uploadController.presignUpload);

router.post('/', auth, roleAuth(['admin']), (req, res, next) => {
  upload.single('imagen')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Error al subir imagen' });
    }
    next();
  });
}, uploadController.uploadImage);

module.exports = router;
