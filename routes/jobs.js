const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

const normalize = (value) => String(value || '').toLowerCase().trim();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ALLOWED_POST_STATUSES = ['pending', 'approved', 'rejected'];

const safePageValue = (page) => Math.max(parseInt(page, 10) || 1, 1);
const safeLimitValue = (limit) => Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

const applyJobFilters = async (filters, query) => {
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

  if (filters.role) {
    const roleRegex = { $regex: `^${escapeRegex(filters.role)}$`, $options: 'i' };
    const matchingUsers = await User.find({
      $or: [
        { role: roleRegex },
        { userType: roleRegex },
      ],
    }).select('_id');

    const userIds = matchingUsers.map((u) => u._id);
    if (userIds.length === 0) {
      return { noUserMatch: true };
    }

    query.postedBy = { $in: userIds };
  }

  return { noUserMatch: false };
};

// Get all jobs (public)
router.get('/', async (req, res) => {
  try {
    const {
      type,
      location,
      search,
      experience,
      role,
      limit = 20,
      page = 1,
    } = req.query;

    const filters = {
      search: normalize(search),
      type: normalize(type),
      location: normalize(location),
      experience: normalize(experience),
      role: normalize(role),
    };

    const query = {
      isActive: true,
      status: 'approved',
    };

    const filterOutcome = await applyJobFilters(filters, query);
    if (filterOutcome.noUserMatch) {
      console.log('[Jobs][filters]', filters);
      console.log('[Jobs][query]', query);
      console.log('[Jobs][response]', { count: 0, total: 0 });
      return res.json({
        success: true,
        jobs: [],
        pagination: { page: safePageValue(page), limit: safeLimitValue(limit), total: 0 },
      });
    }

    console.log('[Jobs][filters]', filters);
    console.log('[Jobs][query]', query);

    const safePage = safePageValue(page);
    const safeLimit = safeLimitValue(limit);

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .skip((safePage - 1) * safeLimit)
      .populate('postedBy', 'fullName studentId profileImage role userType');

    const total = await Job.countDocuments(query);

    console.log('[Jobs][response]', { count: jobs.length, total });

    res.json({
      success: true,
      jobs,
      pagination: { page: safePage, limit: safeLimit, total }
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all jobs for admin (includes pending/approved/rejected)
router.get('/all', auth, isAdmin, async (req, res) => {
  try {
    const {
      type,
      location,
      search,
      experience,
      role,
      status,
      limit = 20,
      page = 1,
    } = req.query;

    const filters = {
      search: normalize(search),
      type: normalize(type),
      location: normalize(location),
      experience: normalize(experience),
      role: normalize(role),
      status: normalize(status),
    };

    const query = { isActive: true };

    if (filters.status) {
      if (!ALLOWED_POST_STATUSES.includes(filters.status)) {
        return res.status(400).json({ success: false, message: 'Invalid status filter' });
      }
      query.status = filters.status;
    }

    const filterOutcome = await applyJobFilters(filters, query);
    if (filterOutcome.noUserMatch) {
      return res.json({
        success: true,
        jobs: [],
        pagination: { page: safePageValue(page), limit: safeLimitValue(limit), total: 0 },
      });
    }

    const safePage = safePageValue(page);
    const safeLimit = safeLimitValue(limit);

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .skip((safePage - 1) * safeLimit)
      .populate('postedBy', 'fullName studentId profileImage role userType')
      .populate('createdBy', 'fullName studentId profileImage role userType');

    const total = await Job.countDocuments(query);

    res.json({
      success: true,
      jobs,
      pagination: { page: safePage, limit: safeLimit, total }
    });
  } catch (error) {
    console.error('Get all jobs (admin) error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get job by ID
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('postedBy', 'fullName studentId profileImage departmentShort batch');
    
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }
    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create job (authenticated)
router.post('/', auth, async (req, res) => {
  try {
    const { title, company, location, type, description, requirements, salary, deadline, applyLink } = req.body;

    const postingRole = req.user.role === 'admin' ? 'admin' : 'user';
    const postingStatus = req.user.role === 'admin' ? 'approved' : 'pending';
    
    // Validate required fields
    if (!title || !company || !description) {
      return res.status(400).json({ success: false, message: 'Title, company, and description are required' });
    }

    // Sanitize inputs
    const job = new Job({
      title: title.trim().slice(0, 200),
      company: company.trim().slice(0, 100),
      location: location?.trim().slice(0, 100) || '',
      type: ['Full-time', 'Part-time', 'Internship', 'Contract', 'Remote'].includes(type) ? type : 'Full-time',
      description: description.trim().slice(0, 5000),
      requirements: Array.isArray(requirements) ? requirements.slice(0, 20) : [],
      salary: salary || {},
      applicationDeadline: deadline ? new Date(deadline) : null,
      applyLink: applyLink?.trim().slice(0, 500) || '',
      postedBy: req.user._id,
      createdBy: req.user._id,
      role: postingRole,
      status: postingStatus,
    });

    await job.save();
    res.status(201).json({ success: true, job, message: 'Job posted successfully' });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update job (authenticated, owner only)
router.put('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const ownerId = job.createdBy || job.postedBy;
    const isOwner = ownerId && ownerId.toString() === req.user._id.toString();
    const isAdminUser = req.user.role === 'admin';

    if (!isAdminUser && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this job' });
    }

    const allowedFields = ['title', 'company', 'location', 'type', 'description', 'requirements', 'salary', 'deadline', 'applyLink', 'isActive'];
    const updates = {};
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Sanitize string fields
    for (const key of ['title', 'company', 'location', 'description', 'applyLink']) {
      if (typeof updates[key] === 'string') updates[key] = updates[key].trim().slice(0, key === 'description' ? 5000 : 200);
    }
    if (updates.type && !['Full-time', 'Part-time', 'Internship', 'Contract', 'Remote'].includes(updates.type)) {
      delete updates.type;
    }
    if (updates.requirements && Array.isArray(updates.requirements)) {
      updates.requirements = updates.requirements.slice(0, 20);
    }

    if (updates.deadline !== undefined) {
      updates.applicationDeadline = updates.deadline ? new Date(updates.deadline) : null;
      delete updates.deadline;
    }

    const updatedJob = await Job.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    res.json({ success: true, job: updatedJob, message: 'Job updated successfully' });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Approve job (admin only)
router.put('/:id/approve', auth, isAdmin, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    job.status = 'approved';
    await job.save();

    res.json({ success: true, job, message: 'Job approved successfully' });
  } catch (error) {
    console.error('Approve job error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Reject job (admin only)
router.put('/:id/reject', auth, isAdmin, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    job.status = 'rejected';
    await job.save();

    res.json({ success: true, job, message: 'Job rejected successfully' });
  } catch (error) {
    console.error('Reject job error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete job (authenticated, owner only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const ownerId = job.createdBy || job.postedBy;
    const isOwner = ownerId && ownerId.toString() === req.user._id.toString();
    const isAdminUser = req.user.role === 'admin';

    if (!isAdminUser && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this job' });
    }

    await Job.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
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

    // Check if already applied (prevent duplicates)
    if (job.applicants?.includes(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Already applied to this job' });
    }

    await Job.findByIdAndUpdate(req.params.id, {
      $addToSet: { applicants: req.user._id }
    });

    res.json({ success: true, message: 'Successfully applied to job' });
  } catch (error) {
    console.error('Apply job error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
