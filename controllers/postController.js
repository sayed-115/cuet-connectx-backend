const mongoose = require('mongoose');
const Post = require('../models/Post');

const ALLOWED_POST_TYPES = ['job', 'scholarship'];
const ALLOWED_STATUS = ['approved', 'pending', 'rejected'];

const asTrimmed = (value) => String(value || '').trim();
const normalize = (value) => asTrimmed(value).toLowerCase();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const populateCreatedBy = {
  path: 'createdBy',
  select: 'fullName studentId profileImage departmentShort batch role userType',
};

const isAdminUser = (user) => String(user?.role || '').toLowerCase() === 'admin';

const sanitizeDeadline = (deadlineValue) => {
  if (deadlineValue === undefined) return undefined;
  if (deadlineValue === null || asTrimmed(deadlineValue) === '') return null;

  const parsed = new Date(deadlineValue);
  if (Number.isNaN(parsed.getTime())) return 'invalid';
  return parsed;
};

exports.getPosts = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 100);
    const search = normalize(req.query.search);
    const providerName = normalize(req.query.providerName || req.query.provider);
    const type = normalize(req.query.type);
    const status = normalize(req.query.status);
    const includeAll = String(req.query.includeAll || '').toLowerCase() === 'true';
    const canViewAll = includeAll && isAdminUser(req.user);

    const query = {
      type: { $in: ALLOWED_POST_TYPES },
    };

    if (type) {
      if (!ALLOWED_POST_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid post type. Allowed values: ${ALLOWED_POST_TYPES.join(', ')}`,
        });
      }
      query.type = type;
    }

    if (providerName) {
      query.providerName = { $regex: escapeRegex(providerName), $options: 'i' };
    }

    if (canViewAll) {
      if (status) {
        if (!ALLOWED_STATUS.includes(status)) {
          return res.status(400).json({
            success: false,
            message: `Invalid status filter. Allowed values: ${ALLOWED_STATUS.join(', ')}`,
          });
        }
        query.status = status;
      }
    } else {
      // Public feed always shows only approved posts.
      query.status = 'approved';
    }

    if (search) {
      const searchRegex = { $regex: escapeRegex(search), $options: 'i' };
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { providerName: searchRegex },
      ];
    }

    const [posts, total] = await Promise.all([
      Post.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(populateCreatedBy),
      Post.countDocuments(query),
    ]);

    return res.json({
      success: true,
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1),
      },
      groupedByStatus: canViewAll
        ? {
          pending: posts.filter((post) => post.status === 'pending'),
          approved: posts.filter((post) => post.status === 'approved'),
          rejected: posts.filter((post) => post.status === 'rejected'),
        }
        : undefined,
    });
  } catch (error) {
    console.error('Get posts error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const includeAll = String(req.query.includeAll || '').toLowerCase() === 'true';
    const canViewAll = includeAll && isAdminUser(req.user);
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid post id' });
    }

    const query = {
      _id: id,
      type: { $in: ALLOWED_POST_TYPES },
    };

    if (!canViewAll) {
      query.status = 'approved';
    }

    const post = await Post.findOne(query).populate(populateCreatedBy);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    return res.json({ success: true, post });
  } catch (error) {
    console.error('Get post by id error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createPost = async (req, res) => {
  try {
    const title = asTrimmed(req.body.title);
    const description = asTrimmed(req.body.description);
    const providerName = asTrimmed(req.body.providerName || req.body.company || req.body.provider);
    const type = normalize(req.body.type);

    if (!title || !description || !providerName) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and providerName are required',
      });
    }

    if (!ALLOWED_POST_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid post type. Allowed values: ${ALLOWED_POST_TYPES.join(', ')}`,
      });
    }

    const postingAsAdmin = isAdminUser(req.user);

    const parsedDeadline = sanitizeDeadline(req.body.deadline);
    if (parsedDeadline === 'invalid') {
      return res.status(400).json({ success: false, message: 'Invalid deadline date' });
    }

    const post = new Post({
      title: title.slice(0, 200),
      description: description.slice(0, 5000),
      type,
      providerName: providerName.slice(0, 200),
      deadline: parsedDeadline === undefined ? null : parsedDeadline,
      createdBy: req.user._id,
      role: postingAsAdmin ? 'admin' : 'user',
      status: postingAsAdmin ? 'approved' : 'pending',
    });

    await post.save();
    await post.populate(populateCreatedBy);

    return res.status(201).json({
      success: true,
      post,
      message: 'Post created successfully',
    });
  } catch (error) {
    console.error('Create post error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid post id' });
    }

    const post = await Post.findOne({ _id: id, type: { $in: ALLOWED_POST_TYPES } });
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const postingAsAdmin = isAdminUser(req.user);
    if (!postingAsAdmin && String(post.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this post' });
    }

    if (req.body.title !== undefined) {
      const title = asTrimmed(req.body.title);
      if (!title) return res.status(400).json({ success: false, message: 'Title cannot be empty' });
      post.title = title.slice(0, 200);
    }

    if (req.body.description !== undefined) {
      const description = asTrimmed(req.body.description);
      if (!description) return res.status(400).json({ success: false, message: 'Description cannot be empty' });
      post.description = description.slice(0, 5000);
    }

    if (req.body.providerName !== undefined || req.body.company !== undefined || req.body.provider !== undefined) {
      const providerName = asTrimmed(req.body.providerName || req.body.company || req.body.provider);
      if (!providerName) return res.status(400).json({ success: false, message: 'Provider name cannot be empty' });
      post.providerName = providerName.slice(0, 200);
    }

    if (req.body.type !== undefined) {
      const type = normalize(req.body.type);
      if (!ALLOWED_POST_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid post type. Allowed values: ${ALLOWED_POST_TYPES.join(', ')}`,
        });
      }
      post.type = type;
    }

    if (req.body.deadline !== undefined) {
      const parsedDeadline = sanitizeDeadline(req.body.deadline);
      if (parsedDeadline === 'invalid') {
        return res.status(400).json({ success: false, message: 'Invalid deadline date' });
      }
      post.deadline = parsedDeadline;
    }

    // Preserve ownership metadata for user-originated posts unless admin explicitly created it.
    if (postingAsAdmin && post.role !== 'admin') {
      post.role = post.role || 'user';
    }

    await post.save();
    await post.populate(populateCreatedBy);

    return res.json({
      success: true,
      post,
      message: 'Post updated successfully',
    });
  } catch (error) {
    console.error('Update post error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid post id' });
    }

    const post = await Post.findOne({ _id: id, type: { $in: ALLOWED_POST_TYPES } });
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const postingAsAdmin = isAdminUser(req.user);
    if (!postingAsAdmin && String(post.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this post' });
    }

    await Post.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    console.error('Delete post error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.approvePost = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid post id' });
    }

    const post = await Post.findOne({ _id: id, type: { $in: ALLOWED_POST_TYPES } });
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    post.status = 'approved';
    await post.save();
    await post.populate(populateCreatedBy);

    return res.json({ success: true, post, message: 'Post approved successfully' });
  } catch (error) {
    console.error('Approve post error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.rejectPost = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid post id' });
    }

    const post = await Post.findOne({ _id: id, type: { $in: ALLOWED_POST_TYPES } });
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    post.status = 'rejected';
    await post.save();
    await post.populate(populateCreatedBy);

    return res.json({ success: true, post, message: 'Post rejected successfully' });
  } catch (error) {
    console.error('Reject post error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
