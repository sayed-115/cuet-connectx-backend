const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const { auth } = require('../middleware/auth');

// Get all jobs (public)
router.get('/', async (req, res) => {
  try {
    const { type, location, search, limit = 20, page = 1 } = req.query;
    const query = {};
    
    if (type) query.type = type;
    const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (location) query.location = { $regex: escapeRx(location), $options: 'i' };
    if (search) {
      const escaped = escapeRx(search);
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { company: { $regex: escaped, $options: 'i' } }
      ];
    }

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('postedBy', 'fullName studentId profileImage');
    
    const total = await Job.countDocuments(query);
    
    res.json({ 
      success: true, 
      jobs,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
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
    const { title, company, location, type, description, requirements, salary, deadline, applyLink } = req.body;
    
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
      postedBy: req.user._id
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

    // Check ownership
    if (job.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this job' });
    }

    const allowedFields = ['title', 'company', 'location', 'type', 'description', 'requirements', 'salary', 'deadline', 'applyLink', 'isActive'];
    const updates = {};
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const updatedJob = await Job.findByIdAndUpdate(req.params.id, updates, { new: true });
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
