const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const User = require('../models/User');
const { auth, optionalAuth } = require('../middleware/auth');
const authorizeAdmin = require('../middleware/authorizeAdmin');
const { normalizeJobPayload } = require('../utils/contentNormalization');

const normalize = (value) => String(value || '').toLowerCase().trim();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePagination = (page, limit) => ({
  page: Math.max(parseInt(page, 10) || 1, 1),
  limit: Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100),
});

const getOwnerId = (job) => String(job.createdBy || job.postedBy || '');
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

function applyPublicJobFilters(query, filters) {
  if (filters.type) {
    query.type = { $regex: `^${escapeRegex(filters.type)}$`, $options: 'i' };
  }

  if (filters.location) {
    query.location = { $regex: escapeRegex(filters.location), $options: 'i' };
  }

  if (filters.experience) {
    query.experience = { $regex: escapeRegex(filters.experience), $options: 'i' };
  }

  if (filters.search) {
    const searchRegex = { $regex: escapeRegex(filters.search), $options: 'i' };
    query.$or = [
      { title: searchRegex },
      { company: searchRegex },
      { location: searchRegex },
      { description: searchRegex },
      { skills: searchRegex },
    ];
  }
}

function toJobResponse(job) {
  if (!job.createdBy && job.postedBy?._id) {
    return { ...job.toObject(), createdBy: job.postedBy._id };
  }
  return job;
}

// Get approved jobs (public)
router.get('/', async (req, res) => {
  try {
    const { type, location, search, experience, role, limit = 20, page = 1 } = req.query;

    const filters = {
      search: normalize(search),
      type: normalize(type),
      location: normalize(location),
      experience: normalize(experience),
      role: normalize(role),
    };

    const query = { isActive: true, status: 'approved' };
    applyPublicJobFilters(query, filters);

    if (filters.role) {
      const roleFilter = await buildAuthorRoleFilter(filters.role);
      if (roleFilter.skip) {
        const pagination = parsePagination(page, limit);
        return res.json({ success: true, jobs: [], pagination: { ...pagination, total: 0 } });
      }
      query.postedBy = { $in: roleFilter.userIds };
    }

    const pagination = parsePagination(page, limit);

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .limit(pagination.limit)
      .skip((pagination.page - 1) * pagination.limit)
      .populate('postedBy', 'fullName studentId profileImage role userType batch currentPosition company');

    const total = await Job.countDocuments(query);

    res.json({
      success: true,
      jobs: jobs.map(toJobResponse),
      pagination: { ...pagination, total },
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all jobs (admin only)
router.get('/all', auth, authorizeAdmin, async (req, res) => {
  try {
    const { type, location, search, experience, role, status, limit = 20, page = 1 } = req.query;

    const filters = {
      search: normalize(search),
      type: normalize(type),
      location: normalize(location),
      experience: normalize(experience),
      role: normalize(role),
      status: normalize(status),
    };

    const baseQuery = {};
    applyPublicJobFilters(baseQuery, filters);

    if (filters.role === 'admin' || filters.role === 'user') {
      baseQuery.role = filters.role;
    } else if (filters.role) {
      const roleFilter = await buildAuthorRoleFilter(filters.role);
      if (roleFilter.skip) {
        const pagination = parsePagination(page, limit);
        return res.json({
          success: true,
          jobs: [],
          pagination: { ...pagination, total: 0 },
          statusCounts: { pending: 0, approved: 0, rejected: 0 },
        });
      }
      baseQuery.postedBy = { $in: roleFilter.userIds };
    }

    const query = { ...baseQuery };
    if (['pending', 'approved', 'rejected'].includes(filters.status)) {
      query.status = filters.status;
    }

    const pagination = parsePagination(page, limit);

    const [jobs, total, statusCountRows] = await Promise.all([
      Job.find(query)
        .sort({ createdAt: -1 })
        .limit(pagination.limit)
        .skip((pagination.page - 1) * pagination.limit)
        .populate('postedBy', 'fullName studentId profileImage role userType'),
      Job.countDocuments(query),
      Job.aggregate([
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
      jobs: jobs.map(toJobResponse),
      pagination: { ...pagination, total },
      statusCounts,
    });
  } catch (error) {
    console.error('Get all jobs error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get own jobs (authenticated)
router.get('/mine', auth, async (req, res) => {
  try {
    const { type, location, search, experience, status, limit = 20, page = 1 } = req.query;

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

    applyPublicJobFilters(query, filters);

    if (['pending', 'approved', 'rejected'].includes(filters.status)) {
      query.status = filters.status;
    }

    const pagination = parsePagination(page, limit);

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .limit(pagination.limit)
      .skip((pagination.page - 1) * pagination.limit)
      .populate('postedBy', 'fullName studentId profileImage role userType batch currentPosition company');

    const total = await Job.countDocuments(query);

    res.json({
      success: true,
      jobs: jobs.map(toJobResponse),
      pagination: { ...pagination, total },
    });
  } catch (error) {
    console.error('Get own jobs error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get job by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('postedBy', 'fullName studentId profileImage departmentShort batch role userType currentPosition company');

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const canViewNonApproved = req.user && (
      isAdmin(req.user) ||
      String(req.user._id) === getOwnerId(job)
    );

    if (job.status !== 'approved' && !canViewNonApproved) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    res.json({ success: true, job: toJobResponse(job) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create job (authenticated)
router.post('/', auth, async (req, res) => {
  try {
    const normalized = normalizeJobPayload(req.body);

    if (!normalized.title || !normalized.company || !normalized.description) {
      return res.status(400).json({ success: false, message: 'Title, company, and description are required' });
    }

    const creatorIsAdmin = isAdmin(req.user);

    const job = new Job({
      ...normalized,
      location: normalized.location || '',
      type: normalized.type || 'Full-time',
      experience: normalized.experience || 'Entry Level',
      salary: normalized.salary || {},
      requirements: normalized.requirements || [],
      responsibilities: normalized.responsibilities || [],
      skills: normalized.skills || [],
      applicationDeadline: normalized.applicationDeadline || null,
      applyLink: normalized.applyLink || '',
      applyEmail: normalized.applyEmail || '',
      jobImage: normalized.jobImage || null,
      postedBy: req.user._id,
      createdBy: req.user._id,
      role: creatorIsAdmin ? 'admin' : 'user',
      status: creatorIsAdmin ? 'approved' : 'pending',
    });

    await job.save();
    const populated = await Job.findById(job._id).populate('postedBy', 'fullName studentId profileImage role userType');

    res.status(201).json({
      success: true,
      job: toJobResponse(populated),
      message: creatorIsAdmin ? 'Job posted successfully' : 'Job submitted for admin approval',
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update job (authenticated, owner or admin)
router.put('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const userIsAdmin = isAdmin(req.user);
    const userIsOwner = String(req.user._id) === getOwnerId(job);

    if (!userIsAdmin && !userIsOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this job' });
    }

    const normalized = normalizeJobPayload(req.body);
    const updates = {};

    const updatableFields = [
      'title',
      'company',
      'location',
      'type',
      'description',
      'requirements',
      'responsibilities',
      'skills',
      'salary',
      'experience',
      'applicationDeadline',
      'applyLink',
      'applyEmail',
      'jobImage',
    ];

    updatableFields.forEach((field) => {
      if (normalized[field] !== undefined) {
        updates[field] = normalized[field];
      }
    });

    if (req.body.isActive !== undefined && userIsAdmin) {
      updates.isActive = Boolean(req.body.isActive);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    if (!job.createdBy) {
      updates.createdBy = job.postedBy;
    }

    if (!userIsAdmin) {
      updates.status = 'pending';
      updates.role = 'user';
    }

    const updatedJob = await Job.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('postedBy', 'fullName studentId profileImage role userType');

    res.json({
      success: true,
      job: toJobResponse(updatedJob),
      message: userIsAdmin ? 'Job updated successfully' : 'Job updated and sent for re-approval',
    });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete job (authenticated, owner or admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const userIsAdmin = isAdmin(req.user);
    const userIsOwner = String(req.user._id) === getOwnerId(job);

    if (!userIsAdmin && !userIsOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this job' });
    }

    await Job.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Approve job (admin only)
router.put('/:id/approve', auth, authorizeAdmin, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    job.status = 'approved';
    await job.save();

    const populated = await Job.findById(job._id).populate('postedBy', 'fullName studentId profileImage role userType');
    res.json({ success: true, job: toJobResponse(populated), message: 'Job approved successfully' });
  } catch (error) {
    console.error('Approve job error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Reject job (admin only)
router.put('/:id/reject', auth, authorizeAdmin, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    job.status = 'rejected';
    await job.save();

    const populated = await Job.findById(job._id).populate('postedBy', 'fullName studentId profileImage role userType');
    res.json({ success: true, job: toJobResponse(populated), message: 'Job rejected successfully' });
  } catch (error) {
    console.error('Reject job error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Apply to job (authenticated)
router.post('/:id/apply', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const alreadyApplied = Array.isArray(job.applications)
      && job.applications.some((entry) => String(entry.user) === String(req.user._id));

    if (alreadyApplied) {
      return res.status(400).json({ success: false, message: 'Already applied to this job' });
    }

    await Job.findByIdAndUpdate(req.params.id, {
      $push: { applications: { user: req.user._id } },
    });

    res.json({ success: true, message: 'Successfully applied to job' });
  } catch (error) {
    console.error('Apply job error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
