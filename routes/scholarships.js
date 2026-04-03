const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../middleware/auth');
const authorizeAdmin = require('../middleware/authorizeAdmin');
const Scholarship = require('../models/Scholarship');
const User = require('../models/User');
const { normalizeScholarshipPayload } = require('../utils/contentNormalization');

const normalize = (value) => String(value || '').toLowerCase().trim();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePagination = (page, limit) => ({
  page: Math.max(parseInt(page, 10) || 1, 1),
  limit: Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100),
});

const getOwnerId = (scholarship) => String(scholarship.createdBy || scholarship.postedBy || '');
const isAdmin = (user) => String(user?.role || '').toLowerCase() === 'admin';

async function buildAuthorRoleFilter(roleValue) {
  const role = normalize(roleValue);
  if (!role) return { skip: false };

  const roleRegex = { $regex: `^${escapeRegex(role)}$`, $options: 'i' };
  const matchingUsers = await User.find({
    $or: [
      { role: roleRegex },
      { userType: roleRegex },
    ],
  }).select('_id');

  const userIds = matchingUsers.map((u) => u._id);
  if (userIds.length === 0) {
    return { skip: true, userIds: [] };
  }

  return { skip: false, userIds };
}

function applyPublicScholarshipFilters(andConditions, filters) {
  if (filters.search) {
    const rx = { $regex: escapeRegex(filters.search), $options: 'i' };
    andConditions.push({
      $or: [
        { title: rx },
        { organization: rx },
        { description: rx },
        { eligibility: rx },
        { amount: rx },
        { benefits: rx },
      ],
    });
  }

  if (filters.type) {
    if (filters.type === 'full') {
      andConditions.push({
        $or: [
          { amount: { $regex: 'full|fully funded', $options: 'i' } },
          { fundingType: { $regex: 'full|fully funded', $options: 'i' } },
          { description: { $regex: 'full|fully funded', $options: 'i' } },
        ],
      });
    } else if (filters.type === 'partial') {
      andConditions.push({
        $or: [
          { amount: { $regex: 'partial', $options: 'i' } },
          { fundingType: { $regex: 'partial', $options: 'i' } },
          { description: { $regex: 'partial', $options: 'i' } },
        ],
      });
    } else if (filters.type === 'tuition only') {
      andConditions.push({
        $or: [
          { amount: { $regex: 'tuition', $options: 'i' } },
          { fundingType: { $regex: 'tuition', $options: 'i' } },
          { description: { $regex: 'tuition', $options: 'i' } },
        ],
      });
    } else if (filters.type === 'stipend') {
      andConditions.push({
        $or: [
          { amount: { $regex: 'stipend', $options: 'i' } },
          { fundingType: { $regex: 'stipend', $options: 'i' } },
          { description: { $regex: 'stipend', $options: 'i' } },
        ],
      });
    } else {
      const rx = { $regex: escapeRegex(filters.type), $options: 'i' };
      andConditions.push({
        $or: [
          { amount: rx },
          { fundingType: rx },
          { description: rx },
        ],
      });
    }
  }

  if (filters.location) {
    const rx = { $regex: escapeRegex(filters.location), $options: 'i' };
    andConditions.push({
      $or: [
        { location: rx },
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
        { level: { $regex: levelPattern, $options: 'i' } },
        { title: { $regex: levelPattern, $options: 'i' } },
        { description: { $regex: levelPattern, $options: 'i' } },
        { eligibility: { $regex: levelPattern, $options: 'i' } },
      ],
    });
  }
}

function toScholarshipResponse(scholarship) {
  if (!scholarship.createdBy && scholarship.postedBy?._id) {
    return { ...scholarship.toObject(), createdBy: scholarship.postedBy._id };
  }
  return scholarship;
}

// Get approved scholarships (public)
router.get('/', async (req, res) => {
  try {
    const {
      limit = 20,
      page = 1,
      search,
      type,
      location,
      experience,
      role,
    } = req.query;

    const filters = {
      search: normalize(search),
      type: normalize(type),
      location: normalize(location),
      experience: normalize(experience),
      role: normalize(role),
    };

    const query = { status: 'approved' };
    const andConditions = [];

    applyPublicScholarshipFilters(andConditions, filters);

    if (filters.role) {
      const roleFilter = await buildAuthorRoleFilter(filters.role);
      if (roleFilter.skip) {
        const pagination = parsePagination(page, limit);
        return res.json({ success: true, scholarships: [], pagination: { ...pagination, total: 0 } });
      }
      andConditions.push({ postedBy: { $in: roleFilter.userIds } });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    const pagination = parsePagination(page, limit);

    const scholarships = await Scholarship.find(query)
      .populate('postedBy', 'fullName studentId profileImage role userType')
      .sort({ createdAt: -1 })
      .limit(pagination.limit)
      .skip((pagination.page - 1) * pagination.limit);

    const total = await Scholarship.countDocuments(query);

    res.json({
      success: true,
      scholarships: scholarships.map(toScholarshipResponse),
      pagination: { ...pagination, total },
    });
  } catch (error) {
    console.error('Get scholarships error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all scholarships (admin only)
router.get('/all', auth, authorizeAdmin, async (req, res) => {
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

    const baseQuery = {};
    const andConditions = [];

    applyPublicScholarshipFilters(andConditions, filters);

    if (filters.role === 'admin' || filters.role === 'user') {
      baseQuery.role = filters.role;
    } else if (filters.role) {
      const roleFilter = await buildAuthorRoleFilter(filters.role);
      if (roleFilter.skip) {
        const pagination = parsePagination(page, limit);
        return res.json({
          success: true,
          scholarships: [],
          pagination: { ...pagination, total: 0 },
          statusCounts: { pending: 0, approved: 0, rejected: 0 },
        });
      }
      andConditions.push({ postedBy: { $in: roleFilter.userIds } });
    }

    if (andConditions.length > 0) {
      baseQuery.$and = andConditions;
    }

    const query = { ...baseQuery };
    if (['pending', 'approved', 'rejected'].includes(filters.status)) {
      query.status = filters.status;
    }

    const pagination = parsePagination(page, limit);

    const [scholarships, total, statusCountRows] = await Promise.all([
      Scholarship.find(query)
        .populate('postedBy', 'fullName studentId profileImage role userType')
        .sort({ createdAt: -1 })
        .limit(pagination.limit)
        .skip((pagination.page - 1) * pagination.limit),
      Scholarship.countDocuments(query),
      Scholarship.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const statusCounts = { pending: 0, approved: 0, rejected: 0 };
    statusCountRows.forEach((row) => {
      if (statusCounts[row._id] !== undefined) {
        statusCounts[row._id] = row.count;
      }
    });

    res.json({
      success: true,
      scholarships: scholarships.map(toScholarshipResponse),
      pagination: { ...pagination, total },
      statusCounts,
    });
  } catch (error) {
    console.error('Get all scholarships error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get own scholarships (authenticated)
router.get('/mine', auth, async (req, res) => {
  try {
    const {
      limit = 20,
      page = 1,
      search,
      type,
      location,
      experience,
      status,
    } = req.query;

    const filters = {
      search: normalize(search),
      type: normalize(type),
      location: normalize(location),
      experience: normalize(experience),
      status: normalize(status),
    };

    const query = {
      $or: [
        { createdBy: req.user._id },
        { postedBy: req.user._id },
      ],
    };
    const andConditions = [];

    applyPublicScholarshipFilters(andConditions, filters);

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    if (['pending', 'approved', 'rejected'].includes(filters.status)) {
      query.status = filters.status;
    }

    const pagination = parsePagination(page, limit);

    const scholarships = await Scholarship.find(query)
      .populate('postedBy', 'fullName studentId profileImage role userType')
      .sort({ createdAt: -1 })
      .limit(pagination.limit)
      .skip((pagination.page - 1) * pagination.limit);

    const total = await Scholarship.countDocuments(query);

    res.json({
      success: true,
      scholarships: scholarships.map(toScholarshipResponse),
      pagination: { ...pagination, total },
    });
  } catch (error) {
    console.error('Get own scholarships error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get scholarship by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id)
      .populate('postedBy', 'fullName studentId profileImage role userType');

    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    const canViewNonApproved = req.user && (
      isAdmin(req.user) ||
      String(req.user._id) === getOwnerId(scholarship)
    );

    if (scholarship.status !== 'approved' && !canViewNonApproved) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    res.json({ success: true, scholarship: toScholarshipResponse(scholarship) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create scholarship (authenticated)
router.post('/', auth, async (req, res) => {
  try {
    const normalized = normalizeScholarshipPayload(req.body);

    if (!normalized.title || !normalized.organization) {
      return res.status(400).json({ success: false, message: 'Title and organization are required' });
    }

    const creatorIsAdmin = isAdmin(req.user);

    const scholarship = new Scholarship({
      ...normalized,
      amount: normalized.amount || '',
      eligibility: normalized.eligibility || '',
      description: normalized.description || normalized.title,
      deadline: normalized.deadline || null,
      link: normalized.link || '',
      scholarshipImage: normalized.scholarshipImage || null,
      postedBy: req.user._id,
      createdBy: req.user._id,
      role: creatorIsAdmin ? 'admin' : 'user',
      status: creatorIsAdmin ? 'approved' : 'pending',
    });

    await scholarship.save();
    const populated = await Scholarship.findById(scholarship._id).populate('postedBy', 'fullName studentId profileImage role userType');

    res.status(201).json({
      success: true,
      scholarship: toScholarshipResponse(populated),
      message: creatorIsAdmin ? 'Scholarship posted successfully' : 'Scholarship submitted for admin approval',
    });
  } catch (error) {
    console.error('Create scholarship error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update scholarship (authenticated, owner or admin)
router.put('/:id', auth, async (req, res) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id);

    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    const userIsAdmin = isAdmin(req.user);
    const userIsOwner = String(req.user._id) === getOwnerId(scholarship);

    if (!userIsAdmin && !userIsOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this scholarship' });
    }

    const normalized = normalizeScholarshipPayload(req.body);
    const updates = {};

    const updatableFields = [
      'title',
      'organization',
      'amount',
      'eligibility',
      'description',
      'deadline',
      'link',
      'scholarshipImage',
      'level',
      'location',
      'fundingType',
      'duration',
      'benefits',
    ];

    updatableFields.forEach((field) => {
      if (normalized[field] !== undefined) {
        updates[field] = normalized[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    if (!scholarship.createdBy) {
      updates.createdBy = scholarship.postedBy;
    }

    if (!userIsAdmin) {
      updates.status = 'pending';
      updates.role = 'user';
    }

    const updatedScholarship = await Scholarship.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('postedBy', 'fullName studentId profileImage role userType');

    res.json({
      success: true,
      scholarship: toScholarshipResponse(updatedScholarship),
      message: userIsAdmin ? 'Scholarship updated successfully' : 'Scholarship updated and sent for re-approval',
    });
  } catch (error) {
    console.error('Update scholarship error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete scholarship (authenticated, owner or admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id);

    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    const userIsAdmin = isAdmin(req.user);
    const userIsOwner = String(req.user._id) === getOwnerId(scholarship);

    if (!userIsAdmin && !userIsOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this scholarship' });
    }

    await Scholarship.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Scholarship deleted successfully' });
  } catch (error) {
    console.error('Delete scholarship error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Approve scholarship (admin only)
router.put('/:id/approve', auth, authorizeAdmin, async (req, res) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id);
    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    scholarship.status = 'approved';
    await scholarship.save();

    const populated = await Scholarship.findById(scholarship._id).populate('postedBy', 'fullName studentId profileImage role userType');
    res.json({ success: true, scholarship: toScholarshipResponse(populated), message: 'Scholarship approved successfully' });
  } catch (error) {
    console.error('Approve scholarship error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Reject scholarship (admin only)
router.put('/:id/reject', auth, authorizeAdmin, async (req, res) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id);
    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    scholarship.status = 'rejected';
    await scholarship.save();

    const populated = await Scholarship.findById(scholarship._id).populate('postedBy', 'fullName studentId profileImage role userType');
    res.json({ success: true, scholarship: toScholarshipResponse(populated), message: 'Scholarship rejected successfully' });
  } catch (error) {
    console.error('Reject scholarship error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
