const { body, validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  next();
};

exports.validateProfileBasic = [
  body('about').optional().isString().isLength({ max: 500 }).withMessage('About must be at most 500 characters'),
  body('contactInfo.email').optional().isEmail().withMessage('Invalid email'),
  body('contactInfo.phone').optional().isString(),
  body('contactInfo.address').optional().isString(),
  handleValidation,
];

exports.validateProfileProfessional = [
  body('professionalInfo.currentPosition').optional().isString(),
  body('professionalInfo.company').optional().isString(),
  body('professionalInfo.location').optional().isString(),
  handleValidation,
];

exports.validateEducation = [
  body('degree').notEmpty().withMessage('Degree is required'),
  body('institution').notEmpty().withMessage('Institution is required'),
  body('year').notEmpty().withMessage('Year is required'),
  body('major').optional().isString(),
  body('focus').optional().isString(),
  handleValidation,
];

exports.validateSkills = [
  body('skills').isArray().withMessage('Skills must be an array'),
  body('skills.*').isString().withMessage('Each skill must be a string'),
  handleValidation,
];
