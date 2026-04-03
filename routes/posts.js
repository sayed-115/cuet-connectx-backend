const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const postController = require('../controllers/postController');

router.get('/', optionalAuth, postController.getPosts);
router.get('/:id', optionalAuth, postController.getPostById);
router.post('/', auth, postController.createPost);
router.put('/:id', auth, postController.updatePost);
router.delete('/:id', auth, postController.deletePost);
router.patch('/:id/approve', auth, requireRole('admin'), postController.approvePost);
router.patch('/:id/reject', auth, requireRole('admin'), postController.rejectPost);

module.exports = router;
