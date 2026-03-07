const mongoose = require('mongoose');
const User = require('../models/User');

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
      recentRegistrations
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: 'alumni' }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ status: 'banned' }),
      User.countDocuments({ role: 'admin' }),
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
      recentRegistrations
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return sendError(res, 'Server error', 500);
  }
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
