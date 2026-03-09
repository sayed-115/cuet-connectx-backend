const Profile = require('../models/Profile');
const cloudinaryUtils = require('../utils/cloudinary');

exports.getMyProfile = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ user: req.user.id }).populate('user', 'fullName email studentId');
    if (!profile) return next({ status: 404, message: 'Profile not found' });
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
};

exports.updateBasic = async (req, res, next) => {
  try {
    const profile = await Profile.findOneAndUpdate(
      { user: req.user.id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    res.json({ success: true, message: 'Profile updated', data: profile });
  } catch (err) { next(err); }
};

exports.updateProfessional = async (req, res, next) => {
  try {
    const profile = await Profile.findOneAndUpdate(
      { user: req.user.id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    res.json({ success: true, message: 'Professional info updated', data: profile });
  } catch (err) { next(err); }
};

exports.addEducation = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ user: req.user.id });
    profile.education.push(req.body);
    await profile.save();
    res.json({ success: true, message: 'Education added', data: profile.education });
  } catch (err) { next(err); }
};

exports.updateEducation = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ user: req.user.id });
    const edu = profile.education.id(req.params.id);
    if (!edu) return next({ status: 404, message: 'Education not found' });
    Object.assign(edu, req.body);
    await profile.save();
    res.json({ success: true, message: 'Education updated', data: edu });
  } catch (err) { next(err); }
};

exports.deleteEducation = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ user: req.user.id });
    profile.education.id(req.params.id).remove();
    await profile.save();
    res.json({ success: true, message: 'Education deleted' });
  } catch (err) { next(err); }
};

exports.updateSkills = async (req, res, next) => {
  try {
    const profile = await Profile.findOneAndUpdate(
      { user: req.user.id },
      { $set: { skills: req.body.skills } },
      { new: true }
    );
    res.json({ success: true, message: 'Skills updated', data: profile.skills });
  } catch (err) { next(err); }
};

// Profile image upload — file already on Cloudinary via multer-storage-cloudinary
exports.uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) return next({ status: 400, message: 'No image file uploaded' });
    const imageUrl = req.file.path; // Cloudinary secure URL
    await Profile.findOneAndUpdate(
      { user: req.user.id },
      { $set: { profileImage: imageUrl } },
      { new: true, upsert: true }
    );
    res.json({ success: true, imageUrl });
  } catch (err) { next(err); }
};

// Avatar upload — file already on Cloudinary via multer-storage-cloudinary
exports.updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) return next({ status: 400, message: 'No file uploaded' });
    const profile = await Profile.findOne({ user: req.user.id });
    if (profile && profile.profileImage) {
      await cloudinaryUtils.deleteImage(profile.profileImage);
    }
    const imageUrl = req.file.path; // Cloudinary secure URL
    const updated = await Profile.findOneAndUpdate(
      { user: req.user.id },
      { $set: { profileImage: imageUrl } },
      { new: true, upsert: true }
    );
    res.json({ success: true, message: 'Avatar updated', data: updated.profileImage });
  } catch (err) { next(err); }
};

// Cover image upload — file already on Cloudinary via multer-storage-cloudinary
exports.updateCover = async (req, res, next) => {
  try {
    if (!req.file) return next({ status: 400, message: 'No file uploaded' });
    const profile = await Profile.findOne({ user: req.user.id });
    if (profile && profile.coverImage) {
      await cloudinaryUtils.deleteImage(profile.coverImage);
    }
    const imageUrl = req.file.path; // Cloudinary secure URL
    const updated = await Profile.findOneAndUpdate(
      { user: req.user.id },
      { $set: { coverImage: imageUrl } },
      { new: true, upsert: true }
    );
    res.json({ success: true, message: 'Cover image updated', data: updated.coverImage });
  } catch (err) { next(err); }
};
