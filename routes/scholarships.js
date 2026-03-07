const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');

// Scholarship Schema
const scholarshipSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  organization: { type: String, required: true, maxlength: 100 },
  amount: { type: String, maxlength: 50 },
  eligibility: { type: String, maxlength: 1000 },
  description: { type: String, maxlength: 5000 },
  deadline: Date,
  link: { type: String, maxlength: 500 },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const Scholarship = mongoose.models.Scholarship || mongoose.model('Scholarship', scholarshipSchema);

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

    const scholarships = await Scholarship.find(query)
      .populate('postedBy', 'fullName studentId')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Scholarship.countDocuments(query);
    
    res.json({ 
      success: true, 
      scholarships,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
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

    const updatedScholarship = await Scholarship.findByIdAndUpdate(req.params.id, updates, { new: true });
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
