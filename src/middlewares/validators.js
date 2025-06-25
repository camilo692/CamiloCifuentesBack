const { body, validationResult } = require('express-validator');

// Product validation rules
const productValidationRules = [
  body('nombre').trim().notEmpty().withMessage('El nombre del producto es requerido'),
  body('descripcion').trim().notEmpty().withMessage('La descripción del producto es requerida'),
  body('precio').trim().notEmpty().withMessage('El precio del producto es requerido'),
  body('genero')
    .isIn(['masculino', 'femenino', 'unisex'])
    .withMessage('El género debe ser masculino, femenino o unisex'),
  body('categoria').trim().notEmpty().withMessage('La categoría es requerida'),
  body('etiqueta').optional().trim(),
  body('stock').isInt({ min: 0 }).withMessage('El stock debe ser un número entero no negativo'),
  body('imagen').optional().isURL().withMessage('La imagen debe ser una URL válida')
];

// Category validation rules
const categoryValidationRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('image').optional().isURL().withMessage('Image must be a valid URL')
];

// User validation rules
const userValidationRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

// Validation middleware
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