const express = require('express');
const router = express.Router();

const Scholarship = require('../models/Scholarship');
const User = require('../models/User');
const { auth, optionalAuth } = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const {
  normalizeScholarshipPayload,
  parseDateField,
  isValidHttpUrl,
} = require('../utils/contentNormalization');

const normalize = (value) => String(value || '').toLowerCase().trim();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];

const resolveOwnerId = (scholarship) =>
  String(
    scholarship?.createdBy?._id ||
      scholarship?.createdBy ||
      scholarship?.postedBy?._id ||
      scholarship?.postedBy ||
      ''
  );

const updateScholarshipStatus = (status, message) => async (req, res) => {
  try {
    const { id } = req.params;
    const scholarship = await Scholarship.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, runValidators: true }
    );

    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    await scholarship.populate('postedBy', 'fullName studentId role userType profileImage batch');

    return res.json({ success: true, message, scholarship });
  } catch (error) {
    console.error(`Scholarship ${status} error:`, error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get all scholarships (public gets approved only, admin gets all)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      limit = 20,
      page = 1,
      search,
      type,
      location,
      experience,
      role,
      status,
    } = req.query;

    const filters = {
      search: normalize(search),
      type: normalize(type),
      location: normalize(location),
      experience: normalize(experience),
      role: normalize(role),
      status: normalize(status),
    };

    const isAdminRequester = req.user?.role === 'admin';
    const andConditions = [];

    if (!isAdminRequester) {
      andConditions.push({ $or: [{ status: 'approved' }, { status: { $exists: false } }] });
    } else if (filters.status && APPROVAL_STATUSES.includes(filters.status)) {
      andConditions.push({ status: filters.status });
    }

    if (filters.search) {
      const rx = { $regex: escapeRegex(filters.search), $options: 'i' };
      andConditions.push({
        $or: [
          { title: rx },
          { organization: rx },
          { description: rx },
          { eligibility: rx },
          { amount: rx },
        ],
      });
    }

    if (filters.type) {
      if (filters.type === 'full') {
        andConditions.push({
          $or: [
            { amount: { $regex: 'full|fully funded', $options: 'i' } },
            { description: { $regex: 'full|fully funded', $options: 'i' } },
          ],
        });
      } else if (filters.type === 'partial') {
        andConditions.push({
          $or: [
            { amount: { $regex: 'partial', $options: 'i' } },
            { description: { $regex: 'partial', $options: 'i' } },
          ],
        });
      } else if (filters.type === 'tuition only') {
        andConditions.push({
          $or: [
            { amount: { $regex: 'tuition', $options: 'i' } },
            { description: { $regex: 'tuition', $options: 'i' } },
          ],
        });
      } else if (filters.type === 'stipend') {
        andConditions.push({
          $or: [
            { amount: { $regex: 'stipend', $options: 'i' } },
            { description: { $regex: 'stipend', $options: 'i' } },
          ],
        });
      } else {
        const rx = { $regex: escapeRegex(filters.type), $options: 'i' };
        andConditions.push({
          $or: [{ amount: rx }, { description: rx }],
        });
      }
    }

    if (filters.location) {
      const rx = { $regex: escapeRegex(filters.location), $options: 'i' };
      andConditions.push({
        $or: [
          { description: rx },
          { eligibility: rx },
          { organization: rx },
          { title: rx },
        ],
      });
    }

    if (filters.experience) {
      let levelPattern = '';

      if (filters.experience === 'undergraduate') {
        levelPattern = 'undergraduate|bachelor|bsc|bs|honours|honors';
      } else if (filters.experience === "master's" || filters.experience === 'masters') {
        levelPattern = 'master|msc|ms';
      } else if (filters.experience === 'phd') {
        levelPattern = 'phd|doctorate|doctoral';
      } else if (filters.experience === 'postdoc') {
        levelPattern = 'postdoc|post-doc';
      } else {
        levelPattern = escapeRegex(filters.experience);
      }

      andConditions.push({
        $or: [
          { title: { $regex: levelPattern, $options: 'i' } },
          { description: { $regex: levelPattern, $options: 'i' } },
          { eligibility: { $regex: levelPattern, $options: 'i' } },
        ],
      });
    }

    if (filters.role) {
      const roleRegex = { $regex: `^${escapeRegex(filters.role)}$`, $options: 'i' };
      const matchingUsers = await User.find({
        $or: [{ role: roleRegex }, { userType: roleRegex }],
      }).select('_id');

      const userIds = matchingUsers.map((u) => u._id);
      if (userIds.length === 0) {
        return res.json({
          success: true,
          scholarships: [],
          pagination: {
            page: Math.max(parseInt(page, 10) || 1, 1),
            limit: Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100),
            total: 0,
          },
        });
      }

      andConditions.push({
        $or: [{ postedBy: { $in: userIds } }, { createdBy: { $in: userIds } }],
      });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const [scholarships, total] = await Promise.all([
      Scholarship.find(query)
        .populate('postedBy', 'fullName studentId role userType profileImage batch')
        .populate('createdBy', 'fullName studentId role userType profileImage batch')
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .skip((safePage - 1) * safeLimit),
      Scholarship.countDocuments(query),
    ]);

    return res.json({
      success: true,
      scholarships,
      pagination: { page: safePage, limit: safeLimit, total },
    });
  } catch (error) {
    console.error('Get scholarships error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get scholarship by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id)
      .populate('postedBy', 'fullName studentId profileImage role userType batch')
      .populate('createdBy', 'fullName studentId profileImage role userType batch');

    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    const requesterId = req.user?._id?.toString();
    const ownerId = resolveOwnerId(scholarship);
    const canViewUnapproved = req.user?.role === 'admin' || (requesterId && requesterId === ownerId);
    const moderationStatus = scholarship.status || 'approved';

    if (moderationStatus !== 'approved' && !canViewUnapproved) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    return res.json({ success: true, scholarship });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create scholarship
router.post('/', auth, async (req, res) => {
  try {
    const normalized = normalizeScholarshipPayload(req.body);

    if (!normalized.title || !normalized.organization) {
      return res.status(400).json({
        success: false,
        message: 'Title and organization are required',
      });
    }

    if (normalized.link && !isValidHttpUrl(normalized.link)) {
      return res.status(400).json({
        success: false,
        message: 'Scholarship link must be a valid http/https URL',
      });
    }

    const parsedDeadline = parseDateField(normalized.deadline);
    if (!parsedDeadline.ok) {
      return res.status(400).json({ success: false, message: 'Invalid scholarship deadline' });
    }

    const creatorRole = req.user.role === 'admin' ? 'admin' : 'user';
    const moderationStatus = creatorRole === 'admin' ? 'approved' : 'pending';

    const scholarship = new Scholarship({
      title: normalized.title,
      organization: normalized.organization,
      amount: normalized.amount || '',
      eligibility: normalized.eligibility || '',
      description: normalized.description || '',
      deadline: parsedDeadline.value,
      link: normalized.link || '',
      scholarshipImage: normalized.scholarshipImage || null,
      postedBy: req.user._id,
      createdBy: req.user._id,
      role: creatorRole,
      status: moderationStatus,
    });

    await scholarship.save();
    await scholarship.populate('postedBy', 'fullName studentId role userType profileImage batch');
    await scholarship.populate('createdBy', 'fullName studentId role userType profileImage batch');

    return res.status(201).json({
      success: true,
      scholarship,
      message:
        moderationStatus === 'approved'
          ? 'Scholarship posted successfully'
          : 'Scholarship submitted for admin approval',
    });
  } catch (error) {
    console.error('Create scholarship error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update scholarship (admin or owner)
router.put('/:id', auth, async (req, res) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id);

    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    const ownerId = resolveOwnerId(scholarship);
    const requesterId = req.user._id.toString();
    const isAdminRequester = req.user.role === 'admin';
    const isOwner = ownerId === requesterId;

    if (!isAdminRequester && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this scholarship',
      });
    }

    const normalized = normalizeScholarshipPayload(req.body, { partial: true });
    const updates = {};

    if (normalized.title !== undefined) {
      if (!normalized.title) return res.status(400).json({ success: false, message: 'Title cannot be empty' });
      updates.title = normalized.title;
    }

    if (normalized.organization !== undefined) {
      if (!normalized.organization) {
        return res.status(400).json({ success: false, message: 'Organization cannot be empty' });
      }
      updates.organization = normalized.organization;
    }

    if (normalized.amount !== undefined) updates.amount = normalized.amount;
    if (normalized.eligibility !== undefined) updates.eligibility = normalized.eligibility;
    if (normalized.description !== undefined) updates.description = normalized.description;

    if (normalized.link !== undefined) {
      if (normalized.link && !isValidHttpUrl(normalized.link)) {
        return res.status(400).json({
          success: false,
          message: 'Scholarship link must be a valid http/https URL',
        });
      }
      updates.link = normalized.link;
    }

    if (normalized.scholarshipImage !== undefined) {
      updates.scholarshipImage = normalized.scholarshipImage || null;
    }

    if (normalized.deadline !== undefined) {
      const parsedDeadline = parseDateField(normalized.deadline);
      if (!parsedDeadline.ok) {
        return res.status(400).json({ success: false, message: 'Invalid scholarship deadline' });
      }
      updates.deadline = parsedDeadline.value;
    }

    if (!isAdminRequester) {
      updates.status = 'pending';
      updates.role = 'user';
    }

    const updatedScholarship = await Scholarship.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    })
      .populate('postedBy', 'fullName studentId role userType profileImage batch')
      .populate('createdBy', 'fullName studentId role userType profileImage batch');

    return res.json({
      success: true,
      scholarship: updatedScholarship,
      message: !isAdminRequester
        ? 'Scholarship updated and resubmitted for approval'
        : 'Scholarship updated successfully',
    });
  } catch (error) {
    console.error('Update scholarship error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete scholarship (admin any, user own)
router.delete('/:id', auth, async (req, res) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id);

    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    const ownerId = resolveOwnerId(scholarship);
    const requesterId = req.user._id.toString();
    const isAdminRequester = req.user.role === 'admin';

    if (!isAdminRequester && ownerId !== requesterId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this scholarship',
      });
    }

    await Scholarship.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Scholarship deleted successfully' });
  } catch (error) {
    console.error('Delete scholarship error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Moderation actions (admin only)
router.put('/:id/approve', auth, isAdmin, updateScholarshipStatus('approved', 'Scholarship approved successfully'));
router.put('/:id/reject', auth, isAdmin, updateScholarshipStatus('rejected', 'Scholarship rejected successfully'));

module.exports = router;
