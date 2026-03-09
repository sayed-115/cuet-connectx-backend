const express = require('express');
const { protect } = require('../middleware/auth');
const authorizeAdmin = require('../middleware/authorizeAdmin');
const adminController = require('../controllers/adminController');
const { jobUpload, scholarshipUpload, postUpload } = require('../middleware/upload');

const router = express.Router();

router.use(protect, authorizeAdmin);

// Dashboard & Stats
router.get('/dashboard', adminController.getDashboardOverview);
router.get('/stats', adminController.getStats);

// User Management
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id/role', adminController.updateUserRole);
router.put('/users/:id/status', adminController.updateUserStatus);
router.put('/users/:id/approve', adminController.approveAlumni);
router.delete('/users/:id', adminController.deleteUser);

// Image upload endpoints (Cloudinary)
router.post('/upload/job-image', jobUpload.single('image'), adminController.uploadJobImage);
router.post('/upload/scholarship-image', scholarshipUpload.single('image'), adminController.uploadScholarshipImage);
router.post('/upload/post-image', postUpload.single('image'), adminController.uploadPostImage);

// Jobs Management
router.get('/jobs', adminController.getJobs);
router.post('/jobs', adminController.createJob);
router.put('/jobs/:id', adminController.updateJob);
router.delete('/jobs/:id', adminController.deleteJob);

// Scholarships Management
router.get('/scholarships', adminController.getScholarships);
router.post('/scholarships', adminController.createScholarship);
router.put('/scholarships/:id', adminController.updateScholarship);
router.delete('/scholarships/:id', adminController.deleteScholarship);

// Community Moderation
router.get('/community', adminController.getPosts);
router.delete('/community/:id', adminController.deletePost);

module.exports = router;
