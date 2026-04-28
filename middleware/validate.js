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

exports.validateCreateJob = [
  body('title').trim().notEmpty().withMessage('Job title is required'),
  body('company').trim().notEmpty().withMessage('Company name is required'),
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string'),
  body('type')
    .optional()
    .isIn(['Full-time', 'Part-time', 'Contract', 'Internship', 'Remote'])
    .withMessage('Invalid job type'),
  body('workMode')
    .optional()
    .isIn(['Remote', 'On-site', 'Hybrid'])
    .withMessage('Invalid work mode'),
  body('applyLink')
    .optional({ values: 'falsy' })
    .isURL()
    .withMessage('Application link must be a valid URL'),
  body('applyEmail')
    .optional({ values: 'falsy' })
    .isEmail()
    .withMessage('Application email must be a valid email'),
  handleValidation,
];

exports.validateCreateScholarship = [
  body('title').trim().notEmpty().withMessage('Scholarship title is required'),
  body('organization').trim().notEmpty().withMessage('Organization is required'),
  body('amount')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Amount must be at most 50 characters'),
  body('eligibility')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Eligibility must be at most 1000 characters'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 5000 })
    .withMessage('Description must be at most 5000 characters'),
  body('link')
    .optional({ values: 'falsy' })
    .isURL()
    .withMessage('Link must be a valid URL'),
  handleValidation,
];
