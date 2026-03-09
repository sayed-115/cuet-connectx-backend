const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../middleware/auth');
const Post = require('../models/Post');
const { postUpload } = require('../middleware/upload');

// Upload post image to Cloudinary
router.post('/upload-image', auth, postUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }
    res.json({ success: true, imageUrl: req.file.path });
  } catch (error) {
    console.error('Post image upload error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all posts (public)
router.get('/', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    
    const posts = await Post.find()
      .populate('author', 'fullName studentId profileImage departmentShort batch')
      .populate('comments.user', 'fullName studentId profileImage')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Post.countDocuments();
    
    res.json({ 
      success: true, 
      posts,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get post by ID
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'fullName studentId profileImage departmentShort batch')
      .populate('comments.user', 'fullName studentId profileImage');
    
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create post (authenticated)
router.post('/', auth, async (req, res) => {
  try {
    const { content, image } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Post content is required' });
    }

    const post = new Post({
      author: req.user._id,
      content: content.trim().slice(0, 5000),
      image: image?.trim().slice(0, 500) || ''
    });

    await post.save();
    
    // Populate author for response
    await post.populate('author', 'fullName studentId profileImage departmentShort batch');
    
    res.status(201).json({ success: true, post, message: 'Post created successfully' });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update post (authenticated, author only)
router.put('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check ownership
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this post' });
    }

    const { content, image } = req.body;
    if (content) post.content = content.trim().slice(0, 5000);
    if (image !== undefined) post.image = image?.trim().slice(0, 500) || '';

    await post.save();
    await post.populate('author', 'fullName studentId profileImage');

    res.json({ success: true, post, message: 'Post updated successfully' });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Like/unlike post (authenticated)
router.post('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const userId = req.user._id;
    const likeIndex = post.likes.findIndex(id => id.toString() === userId.toString());
    
    if (likeIndex > -1) {
      // Unlike - remove from array
      post.likes.splice(likeIndex, 1);
    } else {
      // Like - add to array
      post.likes.push(userId);
    }

    await post.save();
    res.json({ 
      success: true, 
      liked: likeIndex === -1,
      likesCount: post.likes.length,
      message: likeIndex === -1 ? 'Post liked' : 'Post unliked'
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add comment (authenticated)
router.post('/:id/comment', auth, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    post.comments.push({ 
      user: req.user._id, 
      text: text.trim().slice(0, 1000) 
    });
    
    await post.save();
    await post.populate('comments.user', 'fullName studentId profileImage');
    
    res.json({ 
      success: true, 
      comment: post.comments[post.comments.length - 1],
      message: 'Comment added' 
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete comment (authenticated, comment author or post author)
router.delete('/:id/comment/:commentId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    // Allow deletion by comment author or post author
    const isCommentAuthor = comment.user.toString() === req.user._id.toString();
    const isPostAuthor = post.author.toString() === req.user._id.toString();
    
    if (!isCommentAuthor && !isPostAuthor) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this comment' });
    }

    comment.deleteOne();
    await post.save();
    
    res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete post (authenticated, author only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check ownership
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this post' });
    }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
