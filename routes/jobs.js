const express = require('express');
const router = express.Router();

const Job = require('../models/Job');
const User = require('../models/User');
const { auth, optionalAuth } = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const {
  normalizeJobPayload,
  parseDateField,
  isValidHttpUrl,
} = require('../utils/contentNormalization');
const { validateCreateJob } = require('../middleware/validate');
const { mutationLimiter } = require('../middleware/rateLimiter');

const normalize = (value) => String(value || '').toLowerCase().trim();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];
const VALID_JOB_TYPES = ['Full-time', 'Part-time', 'Internship', 'Contract', 'Remote'];
const VALID_WORK_MODES = ['Remote', 'On-site', 'Hybrid'];

const resolveOwnerId = (job) =>
  String(job?.createdBy?._id || job?.createdBy || job?.postedBy?._id || job?.postedBy || '');

const toWorkMode = (rawWorkMode = '', location = '') => {
  if (VALID_WORK_MODES.includes(rawWorkMode)) return rawWorkMode;
  if (normalize(location).includes('remote')) return 'Remote';
  return 'On-site';
};

const toJobType = (rawType = '') => (VALID_JOB_TYPES.includes(rawType) ? rawType : 'Full-time');

const updateJobStatus = (status, message) => async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, runValidators: true }
    );

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    await job.populate('postedBy', 'fullName studentId profileImage role userType batch');

    return res.json({ success: true, message, job });
  } catch (error) {
    console.error(`Job ${status} error:`, error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get all jobs (public gets approved only, admin gets all)
router.get('/', optionalAuth, async (req, res) => {
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

    const isAdminRequester = req.user?.role === 'admin';
    const andConditions = [{ isActive: true }];

    if (!isAdminRequester) {
      andConditions.push({ $or: [{ status: 'approved' }, { status: { $exists: false } }] });
    } else if (filters.status && APPROVAL_STATUSES.includes(filters.status)) {
      andConditions.push({ status: filters.status });
    }

    if (filters.type) {
      andConditions.push({ type: { $regex: `^${escapeRegex(filters.type)}$`, $options: 'i' } });
    }

    if (filters.location) {
      andConditions.push({ location: { $regex: escapeRegex(filters.location), $options: 'i' } });
    }

    if (filters.experience) {
      andConditions.push({ experience: { $regex: escapeRegex(filters.experience), $options: 'i' } });
    }

    if (filters.search) {
      const searchRegex = { $regex: escapeRegex(filters.search), $options: 'i' };
      andConditions.push({
        $or: [
          { title: searchRegex },
          { company: searchRegex },
          { location: searchRegex },
          { description: searchRegex },
          { shortDescription: searchRegex },
          { skills: searchRegex },
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
          jobs: [],
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

    const query = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const [jobs, total] = await Promise.all([
      Job.find(query)
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .skip((safePage - 1) * safeLimit)
        .populate('postedBy', 'fullName studentId profileImage role userType batch')
        .populate('createdBy', 'fullName studentId profileImage role userType batch'),
      Job.countDocuments(query),
    ]);

    return res.json({
      success: true,
      jobs,
      pagination: { page: safePage, limit: safeLimit, total },
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get job by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('postedBy', 'fullName studentId profileImage departmentShort batch role userType')
      .populate('createdBy', 'fullName studentId profileImage departmentShort batch role userType');

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const requesterId = req.user?._id?.toString();
    const ownerId = resolveOwnerId(job);
    const canViewUnapproved = req.user?.role === 'admin' || (requesterId && requesterId === ownerId);
    const moderationStatus = job.status || 'approved';

    if (moderationStatus !== 'approved' && !canViewUnapproved) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (!job.isActive && !canViewUnapproved) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    return res.json({ success: true, job });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create job
router.post('/', auth, mutationLimiter, validateCreateJob, async (req, res) => {
  try {
    const normalized = normalizeJobPayload(req.body);

    const title = normalized.title;
    const company = normalized.company;
    const description =
      normalized.description ||
      normalized.shortDescription ||
      (normalized.requirements || []).join('. ') ||
      (normalized.responsibilities || []).join('. ');

    if (!title || !company || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title, company, and description are required',
      });
    }

    if (normalized.applyLink && !isValidHttpUrl(normalized.applyLink)) {
      return res.status(400).json({
        success: false,
        message: 'Application link must be a valid http/https URL',
      });
    }

    const parsedDeadline = parseDateField(normalized.applicationDeadline);
    if (!parsedDeadline.ok) {
      return res.status(400).json({ success: false, message: 'Invalid application deadline' });
    }

    const creatorRole = req.user.role === 'admin' ? 'admin' : 'user';
    const moderationStatus = creatorRole === 'admin' ? 'approved' : 'pending';

    const job = new Job({
      title,
      company,
      location: normalized.location || '',
      type: toJobType(normalized.type),
      workMode: toWorkMode(normalized.workMode, normalized.location),
      description,
      shortDescription:
        normalized.shortDescription ||
        description.slice(0, 220),
      requirements: normalized.requirements || [],
      responsibilities: normalized.responsibilities || [],
      skills: normalized.skills || [],
      experience: normalized.experience || 'Entry Level',
      salary: normalized.salary || {},
      applicationDeadline: parsedDeadline.value,
      applyLink: normalized.applyLink || '',
      applyEmail: normalized.applyEmail || '',
      jobImage: normalized.jobImage || null,
      postedBy: req.user._id,
      createdBy: req.user._id,
      role: creatorRole,
      status: moderationStatus,
    });

    await job.save();
    await job.populate('postedBy', 'fullName studentId profileImage role userType batch');
    await job.populate('createdBy', 'fullName studentId profileImage role userType batch');

    return res.status(201).json({
      success: true,
      job,
      message:
        moderationStatus === 'approved'
          ? 'Job posted successfully'
          : 'Job submitted for admin approval',
    });
  } catch (error) {
    console.error('Create job error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update job (admin or owner)
router.put('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const ownerId = resolveOwnerId(job);
    const requesterId = req.user._id.toString();
    const isAdminRequester = req.user.role === 'admin';
    const isOwner = ownerId === requesterId;

    if (!isAdminRequester && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this job' });
    }

    const normalized = normalizeJobPayload(req.body, { partial: true });
    const updates = {};

    if (normalized.title !== undefined) {
      if (!normalized.title) return res.status(400).json({ success: false, message: 'Title cannot be empty' });
      updates.title = normalized.title;
    }

    if (normalized.company !== undefined) {
      if (!normalized.company) return res.status(400).json({ success: false, message: 'Company cannot be empty' });
      updates.company = normalized.company;
    }

    if (normalized.location !== undefined) updates.location = normalized.location;
    if (normalized.type !== undefined) updates.type = toJobType(normalized.type);

    if (normalized.workMode !== undefined || normalized.location !== undefined) {
      const workModeSource = normalized.workMode !== undefined ? normalized.workMode : job.workMode;
      const locationSource = normalized.location !== undefined ? normalized.location : job.location;
      updates.workMode = toWorkMode(workModeSource, locationSource);
    }

    if (normalized.description !== undefined) {
      if (!normalized.description) {
        return res.status(400).json({ success: false, message: 'Description cannot be empty' });
      }
      updates.description = normalized.description;
    }

    if (normalized.shortDescription !== undefined) updates.shortDescription = normalized.shortDescription;
    if (normalized.requirements !== undefined) updates.requirements = normalized.requirements;
    if (normalized.responsibilities !== undefined) updates.responsibilities = normalized.responsibilities;
    if (normalized.skills !== undefined) updates.skills = normalized.skills;
    if (normalized.experience !== undefined) updates.experience = normalized.experience || 'Entry Level';
    if (normalized.salary !== undefined) updates.salary = normalized.salary;

    if (normalized.applyLink !== undefined) {
      if (normalized.applyLink && !isValidHttpUrl(normalized.applyLink)) {
        return res.status(400).json({
          success: false,
          message: 'Application link must be a valid http/https URL',
        });
      }
      updates.applyLink = normalized.applyLink;
    }

    if (normalized.applyEmail !== undefined) updates.applyEmail = normalized.applyEmail;
    if (normalized.jobImage !== undefined) updates.jobImage = normalized.jobImage || null;

    if (normalized.applicationDeadline !== undefined) {
      const parsedDeadline = parseDateField(normalized.applicationDeadline);
      if (!parsedDeadline.ok) {
        return res.status(400).json({ success: false, message: 'Invalid application deadline' });
      }
      updates.applicationDeadline = parsedDeadline.value;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'isActive')) {
      updates.isActive = Boolean(req.body.isActive);
    }

    if (!isAdminRequester) {
      updates.status = 'pending';
      updates.role = 'user';
    }

    const updatedJob = await Job.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    })
      .populate('postedBy', 'fullName studentId profileImage role userType batch')
      .populate('createdBy', 'fullName studentId profileImage role userType batch');

    return res.json({
      success: true,
      job: updatedJob,
      message: !isAdminRequester
        ? 'Job updated and resubmitted for approval'
        : 'Job updated successfully',
    });
  } catch (error) {
    console.error('Update job error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete job (admin any, user own)
router.delete('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const ownerId = resolveOwnerId(job);
    const requesterId = req.user._id.toString();
    const isAdminRequester = req.user.role === 'admin';

    if (!isAdminRequester && ownerId !== requesterId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this job' });
    }

    await Job.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Moderation actions (admin only)
router.put('/:id/approve', auth, isAdmin, updateJobStatus('approved', 'Job approved successfully'));
router.put('/:id/reject', auth, isAdmin, updateJobStatus('rejected', 'Job rejected successfully'));

// Apply to job
router.post('/:id/apply', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const moderationStatus = job.status || 'approved';
    if (!job.isActive || moderationStatus !== 'approved') {
      return res.status(400).json({ success: false, message: 'Job is not open for applications' });
    }

    const alreadyApplied = (job.applications || []).some(
      (entry) => entry?.user?.toString() === req.user._id.toString()
    );

    if (alreadyApplied) {
      return res.status(400).json({ success: false, message: 'Already applied to this job' });
    }

    const applyResult = await Job.updateOne(
      { _id: req.params.id, 'applications.user': { $ne: req.user._id } },
      { $push: { applications: { user: req.user._id } } }
    );

    if (applyResult.modifiedCount === 0) {
      return res.status(400).json({ success: false, message: 'Already applied to this job' });
    }

    return res.json({ success: true, message: 'Successfully applied to job' });
  } catch (error) {
    console.error('Apply job error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
