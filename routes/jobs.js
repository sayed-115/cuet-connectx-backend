const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const normalize = (value) => String(value || '').toLowerCase().trim();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isValidHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_err) {
    return false;
  }
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

    const query = { isActive: true };

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
        console.log('[Jobs][filters]', filters);
        console.log('[Jobs][query]', query);
        console.log('[Jobs][response]', { count: 0, total: 0 });
        return res.json({
          success: true,
          jobs: [],
          pagination: { page: Math.max(parseInt(page, 10) || 1, 1), limit: Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100), total: 0 },
        });
      }

      query.postedBy = { $in: userIds };
    }

    console.log('[Jobs][filters]', filters);
    console.log('[Jobs][query]', query);

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

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
    const { title, company, location, type, description, requirements, responsibilities, experience, salary, deadline, applyLink } = req.body;
    
    // Validate required fields
    if (!title || !company || !description) {
      return res.status(400).json({ success: false, message: 'Title, company, and description are required' });
    }

    const sanitizedApplyLink = applyLink?.trim().slice(0, 500) || '';
    if (sanitizedApplyLink && !isValidHttpUrl(sanitizedApplyLink)) {
      return res.status(400).json({ success: false, message: 'Application link must be a valid http/https URL' });
    }

    let parsedDeadline = null;
    if (deadline !== undefined && deadline !== null && String(deadline).trim() !== '') {
      parsedDeadline = new Date(deadline);
      if (Number.isNaN(parsedDeadline.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid application deadline' });
      }
    }

    // Sanitize inputs
    const job = new Job({
      title: title.trim().slice(0, 200),
      company: company.trim().slice(0, 100),
      location: location?.trim().slice(0, 100) || '',
      type: ['Full-time', 'Part-time', 'Internship', 'Contract', 'Remote'].includes(type) ? type : 'Full-time',
      description: description.trim().slice(0, 5000),
      requirements: Array.isArray(requirements) ? requirements.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 20) : [],
      responsibilities: Array.isArray(responsibilities) ? responsibilities.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 20) : [],
      experience: typeof experience === 'string' ? experience.trim().slice(0, 100) : 'Entry Level',
      salary: salary || {},
      applicationDeadline: parsedDeadline,
      applyLink: sanitizedApplyLink,
      postedBy: req.user._id
    });

    await job.save();
    await job.populate('postedBy', 'fullName studentId profileImage role userType batch');
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

    // Check ownership
    if (job.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this job' });
    }

    const allowedFields = ['title', 'company', 'location', 'type', 'description', 'requirements', 'responsibilities', 'experience', 'salary', 'applicationDeadline', 'applyLink', 'isActive'];
    const updates = {};
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (req.body.deadline !== undefined) {
      updates.applicationDeadline = req.body.deadline;
    }

    // Sanitize string fields
    const maxLengths = {
      title: 200,
      company: 100,
      location: 100,
      description: 5000,
      applyLink: 500,
      experience: 100,
    };
    for (const key of Object.keys(maxLengths)) {
      if (typeof updates[key] === 'string') updates[key] = updates[key].trim().slice(0, maxLengths[key]);
    }
    if (updates.applyLink && !isValidHttpUrl(updates.applyLink)) {
      return res.status(400).json({ success: false, message: 'Application link must be a valid http/https URL' });
    }
    if (updates.type && !['Full-time', 'Part-time', 'Internship', 'Contract', 'Remote'].includes(updates.type)) {
      delete updates.type;
    }
    if (updates.requirements && Array.isArray(updates.requirements)) {
      updates.requirements = updates.requirements.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 20);
    }
    if (updates.responsibilities && Array.isArray(updates.responsibilities)) {
      updates.responsibilities = updates.responsibilities.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 20);
    }
    if (updates.applicationDeadline !== undefined) {
      if (updates.applicationDeadline === null || String(updates.applicationDeadline).trim() === '') {
        updates.applicationDeadline = null;
      } else {
        const parsed = new Date(updates.applicationDeadline);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid application deadline' });
        }
        updates.applicationDeadline = parsed;
      }
    }

    const updatedJob = await Job.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    res.json({ success: true, job: updatedJob, message: 'Job updated successfully' });
  } catch (error) {
    console.error('Update job error:', error);
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

    // Check ownership
    if (job.postedBy.toString() !== req.user._id.toString()) {
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
    const alreadyApplied = (job.applications || []).some((entry) => entry?.user?.toString() === req.user._id.toString());
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

    res.json({ success: true, message: 'Successfully applied to job' });
  } catch (error) {
    console.error('Apply job error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
