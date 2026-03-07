const Profile = require('../models/Profile');
const cloudinary = require('../utils/cloudinary');

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

exports.updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) return next({ status: 400, message: 'No file uploaded' });
    const profile = await Profile.findOne({ user: req.user.id });
    if (profile.avatar) await cloudinary.deleteImage(profile.avatar);
    const result = await cloudinary.uploadImage(req.file.path, 'avatars');
    profile.avatar = result.secure_url;
    await profile.save();
    res.json({ success: true, message: 'Avatar updated', data: profile.avatar });
  } catch (err) { next(err); }
};

exports.updateCover = async (req, res, next) => {
  try {
    if (!req.file) return next({ status: 400, message: 'No file uploaded' });
    const profile = await Profile.findOne({ user: req.user.id });
    if (profile.coverImage) await cloudinary.deleteImage(profile.coverImage);
    const result = await cloudinary.uploadImage(req.file.path, 'covers');
    profile.coverImage = result.secure_url;
    await profile.save();
    res.json({ success: true, message: 'Cover image updated', data: profile.coverImage });
  } catch (err) { next(err); }
};
