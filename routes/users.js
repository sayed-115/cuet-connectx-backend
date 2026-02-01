const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, optionalAuth } = require('../middleware/auth');

// Get all users (public profiles)
router.get('/', async (req, res) => {
  try {
    const { batch, department, search, limit = 50, page = 1 } = req.query;
    const query = { isActive: true };
    
    if (batch) query.batch = parseInt(batch);
    if (department) query.departmentShort = department;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    res.json({ 
      success: true, 
      users,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('following', 'fullName studentId profileImage departmentShort batch')
      .populate('followers', 'fullName studentId profileImage departmentShort batch');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update user profile (authenticated, self-only)
router.put('/:id', auth, async (req, res) => {
  try {
    // Verify user can only update their own profile
    if (req.userId !== req.params.id && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this profile' });
    }

    // Whitelist allowed fields - EXCLUDE batch, department, studentId (derived from studentId on backend)
    const allowedFields = [
      'fullName', 'about', 'address', 'currentProfession', 'previousProfession',
      'profileImage', 'coverImage', 'socialLinks', 'skills', 'researchInterests', 'education'
    ];
    
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Sanitize string fields
    if (updates.fullName) updates.fullName = updates.fullName.trim().slice(0, 100);
    if (updates.about) updates.about = updates.about.trim().slice(0, 500);
    if (updates.address) updates.address = updates.address.trim().slice(0, 200);
    if (updates.currentProfession) updates.currentProfession = updates.currentProfession.trim().slice(0, 100);

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Follow a user
router.post('/:id/follow', auth, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user._id.toString();

    // Prevent self-follow
    if (targetUserId === currentUserId) {
      return res.status(400).json({ success: false, message: 'Cannot follow yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if already following (prevent duplicates)
    if (req.user.following.includes(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Already following this user' });
    }

    // Add to following list of current user
    await User.findByIdAndUpdate(currentUserId, {
      $addToSet: { following: targetUserId }
    });

    // Add to followers list of target user
    await User.findByIdAndUpdate(targetUserId, {
      $addToSet: { followers: currentUserId }
    });

    res.json({ success: true, message: 'Successfully followed user' });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Unfollow a user
router.delete('/:id/follow', auth, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user._id.toString();

    // Remove from following list of current user
    await User.findByIdAndUpdate(currentUserId, {
      $pull: { following: targetUserId }
    });

    // Remove from followers list of target user
    await User.findByIdAndUpdate(targetUserId, {
      $pull: { followers: currentUserId }
    });

    res.json({ success: true, message: 'Successfully unfollowed user' });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get followers of a user
router.get('/:id/followers', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('followers', 'fullName studentId profileImage departmentShort batch userType');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, followers: user.followers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get following of a user
router.get('/:id/following', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('following', 'fullName studentId profileImage departmentShort batch userType');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, following: user.following });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
