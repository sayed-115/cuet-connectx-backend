const express = require('express');
const { protect } = require('../middleware/auth');
const authorizeAdmin = require('../middleware/authorizeAdmin');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.use(protect, authorizeAdmin);

router.get('/dashboard', adminController.getDashboardOverview);
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id/role', adminController.updateUserRole);
router.put('/users/:id/status', adminController.updateUserStatus);
router.put('/users/:id/approve', adminController.approveAlumni);
router.delete('/users/:id', adminController.deleteUser);

module.exports = router;
