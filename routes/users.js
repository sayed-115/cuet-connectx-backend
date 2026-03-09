const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, optionalAuth } = require('../middleware/auth');
const { profileUpload } = require('../middleware/upload');
const cloudinaryUtils = require('../utils/cloudinary');

// Get current user profile (authenticated)
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('following', 'fullName studentId profileImage departmentShort batch')
      .populate('followers', 'fullName studentId profileImage departmentShort batch');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all users (public profiles)
router.get('/', async (req, res) => {
  try {
    const { batch, department, search, limit = 50, page = 1 } = req.query;
    const query = { isActive: true };
    
    if (batch) query.batch = parseInt(batch);
    if (department) query.departmentShort = department;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { fullName: { $regex: escaped, $options: 'i' } },
        { studentId: { $regex: escaped, $options: 'i' } }
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

// Update own profile (authenticated, JSON body)
router.put('/profile', auth, async (req, res) => {
  try {
    const allowedFields = [
      'about', 'address', 'contactEmail', 'phone',
      'currentProfession', 'previousProfession',
      'socialLinks', 'skills', 'researchInterests', 'education'
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Sanitize string fields
    for (const key of ['about', 'address', 'contactEmail', 'phone', 'currentProfession', 'previousProfession']) {
      if (typeof updates[key] === 'string') {
        updates[key] = updates[key].trim().slice(0, 500);
      }
    }

    // Validate socialLinks
    if (updates.socialLinks && typeof updates.socialLinks === 'object') {
      const allowed = ['linkedin', 'github', 'facebook', 'portfolio'];
      const sanitized = {};
      for (const k of allowed) {
        sanitized[k] = typeof updates.socialLinks[k] === 'string' ? updates.socialLinks[k].trim().slice(0, 300) : '';
      }
      updates.socialLinks = sanitized;
    }

    // Validate skills array
    if (updates.skills) {
      if (!Array.isArray(updates.skills)) {
        return res.status(400).json({ success: false, message: 'Skills must be an array' });
      }
      updates.skills = updates.skills.filter(s => typeof s === 'string').map(s => s.trim().slice(0, 50)).slice(0, 30);
    }

    // Validate researchInterests array
    if (updates.researchInterests) {
      if (!Array.isArray(updates.researchInterests)) {
        return res.status(400).json({ success: false, message: 'Research interests must be an array' });
      }
      updates.researchInterests = updates.researchInterests.filter(s => typeof s === 'string').map(s => s.trim().slice(0, 100)).slice(0, 20);
    }

    // Validate education array
    if (updates.education) {
      if (!Array.isArray(updates.education)) {
        return res.status(400).json({ success: false, message: 'Education must be an array' });
      }
      updates.education = updates.education.slice(0, 10).map(edu => ({
        degree: String(edu.degree || '').trim().slice(0, 200),
        institution: String(edu.institution || '').trim().slice(0, 200),
        year: String(edu.year || '').trim().slice(0, 50),
        major: String(edu.major || '').trim().slice(0, 100),
        focus: String(edu.focus || '').trim().slice(0, 100),
        gpa: String(edu.gpa || '').trim().slice(0, 10),
      }));
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'Profile updated', user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Change password (authenticated)
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword; // Hashed by pre-save hook
    user.passwordChangedAt = new Date();
    await user.save();

    res.json({ success: true, message: 'Password changed successfully. Please log in again.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Upload profile/cover image (authenticated, self-only) — Cloudinary
router.put('/profile/image', auth, profileUpload.fields([{ name: 'profileImage', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]), async (req, res) => {
  try {
    const updates = {};
    const currentUser = await User.findById(req.user._id);

    if (req.files && req.files.profileImage) {
      // Delete old image from Cloudinary if exists
      if (currentUser.profileImage) await cloudinaryUtils.deleteImage(currentUser.profileImage);
      updates.profileImage = req.files.profileImage[0].path; // Cloudinary secure URL
    }

    if (req.files && req.files.coverImage) {
      if (currentUser.coverImage) await cloudinaryUtils.deleteImage(currentUser.coverImage);
      updates.coverImage = req.files.coverImage[0].path; // Cloudinary secure URL
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No image provided' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update user profile with images (authenticated, self-only) — Cloudinary
router.put('/:id', auth, profileUpload.fields([{ name: 'profileImage', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]), async (req, res) => {
  try {
    if (req.userId !== req.params.id && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this profile' });
    }

    const allowedFields = [
      'fullName', 'about', 'address', 'currentProfession', 'previousProfession',
      'socialLinks', 'skills', 'researchInterests', 'education'
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const currentUser = await User.findById(req.params.id);

    // Use Cloudinary URLs from multer-storage-cloudinary
    if (req.files && req.files.profileImage) {
      if (currentUser.profileImage) await cloudinaryUtils.deleteImage(currentUser.profileImage);
      updates.profileImage = req.files.profileImage[0].path;
    }

    if (req.files && req.files.coverImage) {
      if (currentUser.coverImage) await cloudinaryUtils.deleteImage(currentUser.coverImage);
      updates.coverImage = req.files.coverImage[0].path;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
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
    const alreadyFollowing = req.user.following.some(id => id.toString() === targetUserId);
    if (alreadyFollowing) {
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

    // Fetch updated data
    const updatedUser = await User.findById(currentUserId)
      .select('-password')
      .populate('following', 'fullName studentId profileImage departmentShort batch');
    const updatedTargetUser = await User.findById(targetUserId)
      .select('-password')
      .populate('followers', 'fullName studentId profileImage departmentShort batch');

    res.json({ 
      success: true, 
      message: 'Successfully followed user', 
      user: updatedUser, 
      targetUser: updatedTargetUser 
    });
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

    // Fetch updated data
    const updatedUser = await User.findById(currentUserId)
      .select('-password')
      .populate('following', 'fullName studentId profileImage departmentShort batch');
    const updatedTargetUser = await User.findById(targetUserId)
      .select('-password')
      .populate('followers', 'fullName studentId profileImage departmentShort batch');

    res.json({ 
      success: true, 
      message: 'Successfully unfollowed user', 
      user: updatedUser, 
      targetUser: updatedTargetUser 
    });
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
