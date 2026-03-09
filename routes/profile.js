const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const profileCtrl = require('../controllers/profileController');
const { profileUpload } = require('../middleware/upload');

router.get('/me', auth, profileCtrl.getMyProfile);
router.put('/basic', auth, validate.validateProfileBasic, profileCtrl.updateBasic);
router.put('/professional', auth, validate.validateProfileProfessional, profileCtrl.updateProfessional);
router.post('/education', auth, validate.validateEducation, profileCtrl.addEducation);
router.put('/education/:id', auth, validate.validateEducation, profileCtrl.updateEducation);
router.delete('/education/:id', auth, profileCtrl.deleteEducation);
router.put('/skills', auth, validate.validateSkills, profileCtrl.updateSkills);
router.put('/avatar', auth, profileUpload.single('avatar'), profileCtrl.updateAvatar);
router.put('/cover', auth, profileUpload.single('coverImage'), profileCtrl.updateCover);

module.exports = router;
