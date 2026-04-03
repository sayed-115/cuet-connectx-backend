const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const postController = require('../controllers/postController');

router.get('/', postController.getPosts);
router.get('/:id', postController.getPostById);
router.post('/', auth, postController.createPost);
router.put('/:id', auth, postController.updatePost);
router.delete('/:id', auth, postController.deletePost);

module.exports = router;
