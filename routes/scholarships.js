const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Scholarship = require('../models/Scholarship');

// Get all scholarships (public)
router.get('/', async (req, res) => {
  try {
    const { limit = 20, page = 1, search } = req.query;
    const query = {};
    
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { organization: { $regex: escaped, $options: 'i' } }
      ];
    }

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const scholarships = await Scholarship.find(query)
      .populate('postedBy', 'fullName studentId')
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .skip((safePage - 1) * safeLimit);
    
    const total = await Scholarship.countDocuments(query);
    
    res.json({ 
      success: true, 
      scholarships,
      pagination: { page: safePage, limit: safeLimit, total }
    });
  } catch (error) {
    console.error('Get scholarships error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get scholarship by ID
router.get('/:id', async (req, res) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id)
      .populate('postedBy', 'fullName studentId profileImage');
    
    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }
    res.json({ success: true, scholarship });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create scholarship (authenticated)
router.post('/', auth, async (req, res) => {
  try {
    const { title, organization, amount, eligibility, description, deadline, link } = req.body;
    
    if (!title || !organization) {
      return res.status(400).json({ success: false, message: 'Title and organization are required' });
    }

    const scholarship = new Scholarship({
      title: title.trim().slice(0, 200),
      organization: organization.trim().slice(0, 100),
      amount: amount?.trim().slice(0, 50) || '',
      eligibility: eligibility?.trim().slice(0, 1000) || '',
      description: description?.trim().slice(0, 5000) || '',
      deadline: deadline ? new Date(deadline) : null,
      link: link?.trim().slice(0, 500) || '',
      postedBy: req.user._id
    });

    await scholarship.save();
    res.status(201).json({ success: true, scholarship, message: 'Scholarship posted successfully' });
  } catch (error) {
    console.error('Create scholarship error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update scholarship (authenticated, owner only)
router.put('/:id', auth, async (req, res) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id);
    
    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    // Check ownership
    if (scholarship.postedBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this scholarship' });
    }

    const allowedFields = ['title', 'organization', 'amount', 'eligibility', 'description', 'deadline', 'link'];
    const updates = {};
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Sanitize string fields
    for (const key of ['title', 'organization', 'amount', 'eligibility', 'description', 'link']) {
      if (typeof updates[key] === 'string') updates[key] = updates[key].trim().slice(0, key === 'description' ? 5000 : key === 'eligibility' ? 1000 : 200);
    }

    const updatedScholarship = await Scholarship.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    res.json({ success: true, scholarship: updatedScholarship, message: 'Scholarship updated successfully' });
  } catch (error) {
    console.error('Update scholarship error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete scholarship (authenticated, owner only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id);
    
    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    // Check ownership
    if (scholarship.postedBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this scholarship' });
    }

    await Scholarship.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Scholarship deleted successfully' });
  } catch (error) {
    console.error('Delete scholarship error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
