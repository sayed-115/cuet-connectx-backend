const mongoose = require('mongoose');
const User = require('../models/User');
const Job = require('../models/Job');
const Post = require('../models/Post');
const Scholarship = require('../models/Scholarship');
const {
  normalizeJobPayload,
  normalizeScholarshipPayload,
} = require('../utils/contentNormalization');

// ── Constants ──────────────────────────────────────────────
const ALLOWED_ROLES = ['student', 'alumni', 'admin'];
const ALLOWED_STATUS = ['active', 'banned'];
const CONTENT_STATUSES = ['pending', 'approved', 'rejected'];

// ── Helpers ────────────────────────────────────────────────
const sendSuccess = (res, message, data = {}, statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

const sendError = (res, message, statusCode = 400) =>
  res.status(statusCode).json({ success: false, message });

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const isValidHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_err) {
    return false;
  }
};

const parseDateField = (value) => {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || String(value).trim() === '') return { ok: true, value: null };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { ok: false, value: null };
  return { ok: true, value: parsed };
};

const updateModerationStatus = async ({
  res,
  model,
  id,
  status,
  notFoundMessage,
  successMessage,
  dataKey,
  populate = [],
}) => {
  if (!isValidObjectId(id)) return sendError(res, `Invalid ${dataKey} id`);

  const document = await model.findById(id);
  if (!document) return sendError(res, notFoundMessage, 404);

  document.status = status;
  await document.save();

  for (const { path, select } of populate) {
    await document.populate(path, select);
  }

  return sendSuccess(res, successMessage, { [dataKey]: document });
};

// ── 1. Dashboard Overview ──────────────────────────────────
exports.getDashboardOverview = async (req, res) => {
  try {
    const [
      totalUsers,
      totalAlumni,
      totalStudents,
      totalBannedUsers,
      totalAdmins,
      totalJobs,
      pendingJobs,
      approvedJobs,
      rejectedJobs,
      totalScholarships,
      pendingScholarships,
      approvedScholarships,
      rejectedScholarships,
      totalPosts,
      recentRegistrations
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: 'alumni' }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ status: 'banned' }),
      User.countDocuments({ role: 'admin' }),
      Job.countDocuments({}),
      Job.countDocuments({ status: 'pending' }),
      Job.countDocuments({ $or: [{ status: 'approved' }, { status: { $exists: false } }] }),
      Job.countDocuments({ status: 'rejected' }),
      Scholarship.countDocuments({}),
      Scholarship.countDocuments({ status: 'pending' }),
      Scholarship.countDocuments({ $or: [{ status: 'approved' }, { status: { $exists: false } }] }),
      Scholarship.countDocuments({ status: 'rejected' }),
      Post.countDocuments({}),
      User.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select('fullName email studentId role status userType profileImage createdAt')
    ]);

    return sendSuccess(res, 'Dashboard overview fetched', {
      totalUsers,
      totalAlumni,
      totalStudents,
      totalBannedUsers,
      totalAdmins,
      totalJobs,
      jobsByStatus: {
        pending: pendingJobs,
        approved: approvedJobs,
        rejected: rejectedJobs,
      },
      totalScholarships,
      scholarshipsByStatus: {
        pending: pendingScholarships,
        approved: approvedScholarships,
        rejected: rejectedScholarships,
      },
      totalPosts,
      recentRegistrations
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return sendError(res, 'Server error', 500);
  }
};

// Job image upload — file already on Cloudinary via multer-storage-cloudinary
exports.uploadJobImage = async (req, res, next) => {
  try {
    if (!req.file) return next({ status: 400, message: 'No image file uploaded' });
    const imageUrl = req.file.path; // Cloudinary secure URL
    res.json({ success: true, imageUrl });
  } catch (err) { next(err); }
};

// Scholarship image upload — file already on Cloudinary via multer-storage-cloudinary
exports.uploadScholarshipImage = async (req, res, next) => {
  try {
    if (!req.file) return next({ status: 400, message: 'No image file uploaded' });
    const imageUrl = req.file.path; // Cloudinary secure URL
    res.json({ success: true, imageUrl });
  } catch (err) { next(err); }
};

// Post image upload — file already on Cloudinary via multer-storage-cloudinary
exports.uploadPostImage = async (req, res, next) => {
  try {
    if (!req.file) return next({ status: 400, message: 'No image file uploaded' });
    const imageUrl = req.file.path; // Cloudinary secure URL
    res.json({ success: true, imageUrl });
  } catch (err) { next(err); }
};

// ── 2. Get All Users (paginated + search + filter) ─────────
exports.getUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const search = (req.query.search || '').trim();
    const role = (req.query.role || '').trim();
    const status = (req.query.status || '').trim();

    const query = {};

    if (search) {
      // Escape regex special chars to prevent ReDoS
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { fullName: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { studentId: { $regex: escaped, $options: 'i' } }
      ];
    }

    if (role) {
      if (!ALLOWED_ROLES.includes(role)) {
        return sendError(res, 'Invalid role filter');
      }
      query.role = role;
    }

    if (status) {
      if (!ALLOWED_STATUS.includes(status)) {
        return sendError(res, 'Invalid status filter');
      }
      query.status = status;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-password -__v'),
      User.countDocuments(query)
    ]);

    return sendSuccess(res, 'Users fetched', {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    return sendError(res, 'Server error', 500);
  }
};

// ── 3. Get Single User ─────────────────────────────────────
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return sendError(res, 'Invalid user id');
    }

    const user = await User.findById(id).select('-password -__v');
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    return sendSuccess(res, 'User fetched', { user });
  } catch (error) {
    console.error('Admin get user error:', error);
    return sendError(res, 'Server error', 500);
  }
};

// ── 4. Update User Role ────────────────────────────────────
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, 'Invalid user id');
    }

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return sendError(res, 'Invalid role value. Allowed: student, alumni, admin');
    }

    // Prevent admin from removing their own admin role
    if (req.user._id.toString() === id && role !== 'admin') {
      return sendError(res, 'Admin cannot remove admin role from themselves');
    }

    const user = await User.findById(id).select('-password -__v');
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    user.role = role;
    await user.save();

    return sendSuccess(res, 'User role updated', { user });
  } catch (error) {
    console.error('Admin update role error:', error);
    return sendError(res, 'Server error', 500);
  }
};

// ── 5. Update User Status (ban / unban) ────────────────────
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, 'Invalid user id');
    }

    if (!status || !ALLOWED_STATUS.includes(status)) {
      return sendError(res, 'Invalid status value. Allowed: active, banned');
    }

    // Prevent admin from banning themselves
    if (req.user._id.toString() === id && status === 'banned') {
      return sendError(res, 'Admin cannot ban themselves');
    }

    const user = await User.findById(id).select('-password -__v');
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Prevent banning other admins
    if (user.role === 'admin' && status === 'banned') {
      return sendError(res, 'Cannot ban an admin. Remove admin role first.');
    }

    user.status = status;
    user.isActive = status === 'active';
    await user.save();

    return sendSuccess(res, `User ${status === 'banned' ? 'banned' : 'unbanned'} successfully`, { user });
  } catch (error) {
    console.error('Admin update status error:', error);
    return sendError(res, 'Server error', 500);
  }
};

// ── 6. Delete User ─────────────────────────────────────────
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return sendError(res, 'Invalid user id');
    }

    // Prevent admin from deleting themselves
    if (req.user._id.toString() === id) {
      return sendError(res, 'Admin cannot delete themselves');
    }

    const user = await User.findById(id).select('-password -__v');
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Prevent deleting other admins
    if (user.role === 'admin') {
      return sendError(res, 'Cannot delete another admin');
    }

    await User.findByIdAndDelete(id);

    return sendSuccess(res, 'User deleted successfully', { user });
  } catch (error) {
    console.error('Admin delete user error:', error);
    return sendError(res, 'Server error', 500);
  }
};

// ── 7. Approve Alumni ──────────────────────────────────────
exports.approveAlumni = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return sendError(res, 'Invalid user id');
    }

    const user = await User.findById(id).select('-password -__v');
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    if (user.userType !== 'alumni' && user.role !== 'alumni') {
      return sendError(res, 'Only alumni accounts can be approved');
    }

    user.isVerified = true;
    await user.save();

    return sendSuccess(res, 'Alumni approved successfully', { user });
  } catch (error) {
    console.error('Admin approve alumni error:', error);
    return sendError(res, 'Server error', 500);
  }
};

// ── 8. Stats ───────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalJobs,
      totalScholarships,
      totalPosts,
      pendingJobs,
      approvedJobs,
      rejectedJobs,
      pendingScholarships,
      approvedScholarships,
      rejectedScholarships,
    ] = await Promise.all([
      User.countDocuments({}),
      Job.countDocuments({}),
      Scholarship.countDocuments({}),
      Post.countDocuments({}),
      Job.countDocuments({ status: 'pending' }),
      Job.countDocuments({ $or: [{ status: 'approved' }, { status: { $exists: false } }] }),
      Job.countDocuments({ status: 'rejected' }),
      Scholarship.countDocuments({ status: 'pending' }),
      Scholarship.countDocuments({ $or: [{ status: 'approved' }, { status: { $exists: false } }] }),
      Scholarship.countDocuments({ status: 'rejected' }),
    ]);

    return sendSuccess(res, 'Stats fetched', {
      totalUsers,
      totalJobs,
      totalScholarships,
      totalPosts,
      jobsByStatus: {
        pending: pendingJobs,
        approved: approvedJobs,
        rejected: rejectedJobs,
      },
      scholarshipsByStatus: {
        pending: pendingScholarships,
        approved: approvedScholarships,
        rejected: rejectedScholarships,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return sendError(res, 'Server error', 500);
  }
};

// ── 9. Jobs Management ────────────────────────────────────
exports.getJobs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim().toLowerCase();

    const query = {};
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { company: { $regex: escaped, $options: 'i' } }
      ];
    }

    if (status && CONTENT_STATUSES.includes(status)) {
      query.status = status;
    }

    const [jobs, total, groupedStatusCounts] = await Promise.all([
      Job.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('postedBy', 'fullName studentId profileImage role userType batch')
        .populate('createdBy', 'fullName studentId profileImage role userType batch'),
      Job.countDocuments(query),
      Job.aggregate([
        {
          $group: {
            _id: { $ifNull: ['$status', 'approved'] },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const statusCounts = { pending: 0, approved: 0, rejected: 0 };
    groupedStatusCounts.forEach((entry) => {
      if (CONTENT_STATUSES.includes(entry._id)) {
        statusCounts[entry._id] = entry.count;
      }
    });

    return sendSuccess(res, 'Jobs fetched', {
      jobs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
      statusCounts,
    });
  } catch (error) {
    console.error('Admin get jobs error:', error);
    return sendError(res, 'Server error', 500);
  }
};

exports.createJob = async (req, res) => {
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
      return sendError(res, 'Title, company, and description are required');
    }

    const sanitizedApplyLink = normalized.applyLink || '';
    if (sanitizedApplyLink && !isValidHttpUrl(sanitizedApplyLink)) {
      return sendError(res, 'Application link must be a valid http/https URL');
    }

    const parsedDeadline = parseDateField(normalized.applicationDeadline);
    if (!parsedDeadline.ok) {
      return sendError(res, 'Invalid application deadline');
    }

    const resolvedType = ['Full-time', 'Part-time', 'Internship', 'Contract', 'Remote'].includes(normalized.type)
      ? normalized.type
      : 'Full-time';

    const resolvedWorkMode = ['Remote', 'On-site', 'Hybrid'].includes(normalized.workMode)
      ? normalized.workMode
      : (String(normalized.location || '').toLowerCase().includes('remote') ? 'Remote' : 'On-site');

    const job = new Job({
      title,
      company,
      location: normalized.location || '',
      type: resolvedType,
      workMode: resolvedWorkMode,
      description,
      shortDescription: normalized.shortDescription || description.slice(0, 220),
      requirements: normalized.requirements || [],
      responsibilities: normalized.responsibilities || [],
      skills: normalized.skills || [],
      experience: normalized.experience || 'Entry Level',
      salary: normalized.salary || {},
      applicationDeadline: parsedDeadline.value,
      applyLink: sanitizedApplyLink,
      applyEmail: normalized.applyEmail || '',
      jobImage: normalized.jobImage || null,
      postedBy: req.user._id,
      createdBy: req.user._id,
      role: 'admin',
      status: 'approved',
    });

    await job.save();
    return sendSuccess(res, 'Job created successfully', { job }, 201);
  } catch (error) {
    console.error('Admin create job error:', error);
    return sendError(res, 'Server error', 500);
  }
};

exports.updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 'Invalid job id');

    const job = await Job.findById(id);
    if (!job) return sendError(res, 'Job not found', 404);

    const normalized = normalizeJobPayload(req.body, { partial: true });
    const updates = {};

    if (normalized.title !== undefined) {
      if (!normalized.title) return sendError(res, 'Title cannot be empty');
      updates.title = normalized.title;
    }

    if (normalized.company !== undefined) {
      if (!normalized.company) return sendError(res, 'Company cannot be empty');
      updates.company = normalized.company;
    }

    if (normalized.location !== undefined) updates.location = normalized.location;
    if (normalized.type !== undefined) {
      updates.type = ['Full-time', 'Part-time', 'Internship', 'Contract', 'Remote'].includes(normalized.type)
        ? normalized.type
        : 'Full-time';
    }

    if (normalized.workMode !== undefined || normalized.location !== undefined) {
      const sourceMode = normalized.workMode !== undefined ? normalized.workMode : job.workMode;
      const sourceLocation = normalized.location !== undefined ? normalized.location : job.location;
      updates.workMode = ['Remote', 'On-site', 'Hybrid'].includes(sourceMode)
        ? sourceMode
        : (String(sourceLocation || '').toLowerCase().includes('remote') ? 'Remote' : 'On-site');
    }

    if (normalized.description !== undefined) {
      if (!normalized.description) return sendError(res, 'Description cannot be empty');
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
        return sendError(res, 'Application link must be a valid http/https URL');
      }
      updates.applyLink = normalized.applyLink;
    }

    if (normalized.applyEmail !== undefined) updates.applyEmail = normalized.applyEmail;
    if (normalized.jobImage !== undefined) updates.jobImage = normalized.jobImage || null;

    if (normalized.applicationDeadline !== undefined) {
      const parsedDeadline = parseDateField(normalized.applicationDeadline);
      if (!parsedDeadline.ok) return sendError(res, 'Invalid application deadline');
      updates.applicationDeadline = parsedDeadline.value;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'isActive')) {
      updates.isActive = Boolean(req.body.isActive);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'status') && CONTENT_STATUSES.includes(req.body.status)) {
      updates.status = req.body.status;
    }

    if (updates.applyLink && !isValidHttpUrl(updates.applyLink)) {
      return sendError(res, 'Application link must be a valid http/https URL');
    }

    const updatedJob = await Job.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
      .populate('postedBy', 'fullName studentId profileImage role userType batch')
      .populate('createdBy', 'fullName studentId profileImage role userType batch');
    return sendSuccess(res, 'Job updated successfully', { job: updatedJob });
  } catch (error) {
    console.error('Admin update job error:', error);
    return sendError(res, 'Server error', 500);
  }
};

exports.deleteJob = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 'Invalid job id');

    const job = await Job.findById(id);
    if (!job) return sendError(res, 'Job not found', 404);

    await Job.findByIdAndDelete(id);
    return sendSuccess(res, 'Job deleted successfully');
  } catch (error) {
    console.error('Admin delete job error:', error);
    return sendError(res, 'Server error', 500);
  }
};

exports.approveJob = async (req, res) => {
  try {
    return await updateModerationStatus({
      res,
      model: Job,
      id: req.params.id,
      status: 'approved',
      notFoundMessage: 'Job not found',
      successMessage: 'Job approved successfully',
      dataKey: 'job',
      populate: [
        { path: 'postedBy', select: 'fullName studentId profileImage role userType batch' },
        { path: 'createdBy', select: 'fullName studentId profileImage role userType batch' },
      ],
    });
  } catch (error) {
    console.error('Admin approve job error:', error);
    return sendError(res, 'Server error', 500);
  }
};

exports.rejectJob = async (req, res) => {
  try {
    return await updateModerationStatus({
      res,
      model: Job,
      id: req.params.id,
      status: 'rejected',
      notFoundMessage: 'Job not found',
      successMessage: 'Job rejected successfully',
      dataKey: 'job',
      populate: [
        { path: 'postedBy', select: 'fullName studentId profileImage role userType batch' },
        { path: 'createdBy', select: 'fullName studentId profileImage role userType batch' },
      ],
    });
  } catch (error) {
    console.error('Admin reject job error:', error);
    return sendError(res, 'Server error', 500);
  }
};

// ── 10. Scholarships Management ───────────────────────────
exports.getScholarships = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim().toLowerCase();

    const query = {};
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { organization: { $regex: escaped, $options: 'i' } }
      ];
    }

    if (status && CONTENT_STATUSES.includes(status)) {
      query.status = status;
    }

    const [scholarships, total, groupedStatusCounts] = await Promise.all([
      Scholarship.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('postedBy', 'fullName studentId role userType profileImage batch')
        .populate('createdBy', 'fullName studentId role userType profileImage batch'),
      Scholarship.countDocuments(query),
      Scholarship.aggregate([
        {
          $group: {
            _id: { $ifNull: ['$status', 'approved'] },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const statusCounts = { pending: 0, approved: 0, rejected: 0 };
    groupedStatusCounts.forEach((entry) => {
      if (CONTENT_STATUSES.includes(entry._id)) {
        statusCounts[entry._id] = entry.count;
      }
    });

    return sendSuccess(res, 'Scholarships fetched', {
      scholarships,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
      statusCounts,
    });
  } catch (error) {
    console.error('Admin get scholarships error:', error);
    return sendError(res, 'Server error', 500);
  }
};

exports.createScholarship = async (req, res) => {
  try {
    const normalized = normalizeScholarshipPayload(req.body);

    if (!normalized.title || !normalized.organization) {
      return sendError(res, 'Title and organization are required');
    }

    const sanitizedLink = normalized.link || '';
    if (sanitizedLink && !isValidHttpUrl(sanitizedLink)) {
      return sendError(res, 'Scholarship link must be a valid http/https URL');
    }

    const parsedDeadline = parseDateField(normalized.deadline);
    if (!parsedDeadline.ok) {
      return sendError(res, 'Invalid scholarship deadline');
    }

    const scholarship = new Scholarship({
      title: normalized.title,
      organization: normalized.organization,
      amount: normalized.amount || '',
      eligibility: normalized.eligibility || '',
      description: normalized.description || '',
      deadline: parsedDeadline.value,
      link: sanitizedLink,
      scholarshipImage: normalized.scholarshipImage || null,
      postedBy: req.user._id,
      createdBy: req.user._id,
      role: 'admin',
      status: 'approved',
    });

    await scholarship.save();
    return sendSuccess(res, 'Scholarship created successfully', { scholarship }, 201);
  } catch (error) {
    console.error('Admin create scholarship error:', error);
    return sendError(res, 'Server error', 500);
  }
};

exports.updateScholarship = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 'Invalid scholarship id');

    const scholarship = await Scholarship.findById(id);
    if (!scholarship) return sendError(res, 'Scholarship not found', 404);

    const normalized = normalizeScholarshipPayload(req.body, { partial: true });
    const updates = {};

    if (normalized.title !== undefined) {
      if (!normalized.title) return sendError(res, 'Title cannot be empty');
      updates.title = normalized.title;
    }

    if (normalized.organization !== undefined) {
      if (!normalized.organization) return sendError(res, 'Organization cannot be empty');
      updates.organization = normalized.organization;
    }

    if (normalized.amount !== undefined) updates.amount = normalized.amount;
    if (normalized.eligibility !== undefined) updates.eligibility = normalized.eligibility;
    if (normalized.description !== undefined) updates.description = normalized.description;

    if (normalized.link !== undefined) {
      if (normalized.link && !isValidHttpUrl(normalized.link)) {
        return sendError(res, 'Scholarship link must be a valid http/https URL');
      }
      updates.link = normalized.link;
    }

    if (normalized.scholarshipImage !== undefined) {
      updates.scholarshipImage = normalized.scholarshipImage || null;
    }

    if (normalized.deadline !== undefined) {
      const parsedDeadline = parseDateField(normalized.deadline);
      if (!parsedDeadline.ok) return sendError(res, 'Invalid scholarship deadline');
      updates.deadline = parsedDeadline.value;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'status') && CONTENT_STATUSES.includes(req.body.status)) {
      updates.status = req.body.status;
    }

    const updatedScholarship = await Scholarship.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
      .populate('postedBy', 'fullName studentId role userType profileImage batch')
      .populate('createdBy', 'fullName studentId role userType profileImage batch');
    return sendSuccess(res, 'Scholarship updated successfully', { scholarship: updatedScholarship });
  } catch (error) {
    console.error('Admin update scholarship error:', error);
    return sendError(res, 'Server error', 500);
  }
};

exports.deleteScholarship = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 'Invalid scholarship id');

    const scholarship = await Scholarship.findById(id);
    if (!scholarship) return sendError(res, 'Scholarship not found', 404);

    await Scholarship.findByIdAndDelete(id);
    return sendSuccess(res, 'Scholarship deleted successfully');
  } catch (error) {
    console.error('Admin delete scholarship error:', error);
    return sendError(res, 'Server error', 500);
  }
};

exports.approveScholarship = async (req, res) => {
  try {
    return await updateModerationStatus({
      res,
      model: Scholarship,
      id: req.params.id,
      status: 'approved',
      notFoundMessage: 'Scholarship not found',
      successMessage: 'Scholarship approved successfully',
      dataKey: 'scholarship',
      populate: [
        { path: 'postedBy', select: 'fullName studentId role userType profileImage batch' },
        { path: 'createdBy', select: 'fullName studentId role userType profileImage batch' },
      ],
    });
  } catch (error) {
    console.error('Admin approve scholarship error:', error);
    return sendError(res, 'Server error', 500);
  }
};

exports.rejectScholarship = async (req, res) => {
  try {
    return await updateModerationStatus({
      res,
      model: Scholarship,
      id: req.params.id,
      status: 'rejected',
      notFoundMessage: 'Scholarship not found',
      successMessage: 'Scholarship rejected successfully',
      dataKey: 'scholarship',
      populate: [
        { path: 'postedBy', select: 'fullName studentId role userType profileImage batch' },
        { path: 'createdBy', select: 'fullName studentId role userType profileImage batch' },
      ],
    });
  } catch (error) {
    console.error('Admin reject scholarship error:', error);
    return sendError(res, 'Server error', 500);
  }
};

// ── 11. Community Moderation ──────────────────────────────
exports.getPosts = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

    const [posts, total] = await Promise.all([
      Post.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('author', 'fullName studentId profileImage departmentShort batch')
        .populate('comments.user', 'fullName studentId profileImage'),
      Post.countDocuments()
    ]);

    return sendSuccess(res, 'Posts fetched', {
      posts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 }
    });
  } catch (error) {
    console.error('Admin get posts error:', error);
    return sendError(res, 'Server error', 500);
  }
};

exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 'Invalid post id');

    const post = await Post.findById(id);
    if (!post) return sendError(res, 'Post not found', 404);

    await Post.findByIdAndDelete(id);
    return sendSuccess(res, 'Post deleted successfully');
  } catch (error) {
    console.error('Admin delete post error:', error);
    return sendError(res, 'Server error', 500);
  }
};
