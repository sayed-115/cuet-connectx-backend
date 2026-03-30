const mongoose = require('mongoose');
const User = require('../models/User');
const Job = require('../models/Job');
const Post = require('../models/Post');
const Scholarship = require('../models/Scholarship');

// ── Constants ──────────────────────────────────────────────
const ALLOWED_ROLES = ['student', 'alumni', 'admin'];
const ALLOWED_STATUS = ['active', 'banned'];

// ── Helpers ────────────────────────────────────────────────
const sendSuccess = (res, message, data = {}, statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

const sendError = (res, message, statusCode = 400) =>
  res.status(statusCode).json({ success: false, message });

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

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
      totalScholarships,
      totalPosts,
      recentRegistrations
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: 'alumni' }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ status: 'banned' }),
      User.countDocuments({ role: 'admin' }),
      Job.countDocuments({}),
      Scholarship.countDocuments({}),
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
      totalScholarships,
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
    const [totalUsers, totalJobs, totalScholarships, totalPosts] = await Promise.all([
      User.countDocuments({}),
      Job.countDocuments({}),
      Scholarship.countDocuments({}),
      Post.countDocuments({})
    ]);

    return sendSuccess(res, 'Stats fetched', { totalUsers, totalJobs, totalScholarships, totalPosts });
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

    const query = {};
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { company: { $regex: escaped, $options: 'i' } }
      ];
    }

    const [jobs, total] = await Promise.all([
      Job.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('postedBy', 'fullName studentId profileImage'),
      Job.countDocuments(query)
    ]);

    return sendSuccess(res, 'Jobs fetched', {
      jobs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 }
    });
  } catch (error) {
    console.error('Admin get jobs error:', error);
    return sendError(res, 'Server error', 500);
  }
};

exports.createJob = async (req, res) => {
  try {
    const { title, company, location, type, description, requirements, salary, deadline, applyLink, jobImage } = req.body;

    if (!title || !company || !description) {
      return sendError(res, 'Title, company, and description are required');
    }

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
      jobImage: jobImage?.trim().slice(0, 500) || null,
      postedBy: req.user._id
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

    const allowedFields = ['title', 'company', 'location', 'type', 'description', 'requirements', 'salary', 'applicationDeadline', 'applyLink', 'isActive', 'jobImage'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    // Sanitize string fields
    for (const key of ['title', 'company', 'location', 'description', 'applyLink', 'jobImage']) {
      if (typeof updates[key] === 'string') updates[key] = updates[key].trim().slice(0, key === 'description' ? 5000 : 500);
    }
    if (updates.type && !['Full-time', 'Part-time', 'Internship', 'Contract', 'Remote'].includes(updates.type)) {
      delete updates.type;
    }

    const updatedJob = await Job.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
      .populate('postedBy', 'fullName studentId profileImage');
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

// ── 10. Scholarships Management ───────────────────────────
exports.getScholarships = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const search = (req.query.search || '').trim();

    const query = {};
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { organization: { $regex: escaped, $options: 'i' } }
      ];
    }

    const [scholarships, total] = await Promise.all([
      Scholarship.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('postedBy', 'fullName studentId'),
      Scholarship.countDocuments(query)
    ]);

    return sendSuccess(res, 'Scholarships fetched', {
      scholarships,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 }
    });
  } catch (error) {
    console.error('Admin get scholarships error:', error);
    return sendError(res, 'Server error', 500);
  }
};

exports.createScholarship = async (req, res) => {
  try {
    const { title, organization, amount, eligibility, description, deadline, link, scholarshipImage } = req.body;

    if (!title || !organization) {
      return sendError(res, 'Title and organization are required');
    }

    const scholarship = new Scholarship({
      title: title.trim().slice(0, 200),
      organization: organization.trim().slice(0, 100),
      amount: amount?.trim().slice(0, 50) || '',
      eligibility: eligibility?.trim().slice(0, 1000) || '',
      description: description?.trim().slice(0, 5000) || '',
      deadline: deadline ? new Date(deadline) : null,
      link: link?.trim().slice(0, 500) || '',
      scholarshipImage: scholarshipImage?.trim().slice(0, 500) || null,
      postedBy: req.user._id
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

    const allowedFields = ['title', 'organization', 'amount', 'eligibility', 'description', 'deadline', 'link', 'scholarshipImage'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    // Sanitize string fields
    for (const key of ['title', 'organization', 'amount', 'eligibility', 'description', 'link', 'scholarshipImage']) {
      if (typeof updates[key] === 'string') updates[key] = updates[key].trim().slice(0, key === 'description' ? 5000 : key === 'eligibility' ? 1000 : 500);
    }

    const updatedScholarship = await Scholarship.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
      .populate('postedBy', 'fullName studentId');
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
