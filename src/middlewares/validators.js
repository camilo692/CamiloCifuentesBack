const { body, validationResult } = require('express-validator');

const productValidationRules = [
  body('nombre').trim().notEmpty().withMessage('El nombre del producto es requerido'),
  body('descripcion').optional().trim(),
  body('precio').isFloat({ min: 0 }).withMessage('El precio debe ser un número'),
  body('genero')
    .isIn(['hombre', 'mujer', 'unisex'])
    .withMessage('El género debe ser hombre, mujer o unisex'),
  body('categoria').trim().notEmpty().withMessage('La categoría es requerida'),
  body('etiqueta').optional().trim(),
  body('stock').isInt({ min: 0 }).withMessage('El stock debe ser un número entero no negativo'),
  body('imagen').optional().trim()
];

const categoryValidationRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('description').optional().trim(),
  body('image').optional().trim()
];

const userValidationRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = errors.array().map(err => ({ [err.path]: err.msg }));
  return res.status(422).json({
    message: 'Validation failed',
    errors: extractedErrors
  });
};

module.exports = {
  productValidationRules,
  categoryValidationRules,
  userValidationRules,
  validate
};
