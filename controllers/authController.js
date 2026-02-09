import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import Kitchen from '../models/Kitchen.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '7d'
  });
};

export const sendOtp = async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ message: 'Mobile number is required' });

    // Check if user is already registered
    const user = await User.findOne({ mobile });

    // Fixed OTP
    const otp = '757677';

    // Save/Update OTP in database
    await Otp.findOneAndUpdate(
      { mobile },
      { otp, createdAt: new Date() },
      { upsert: true, new: true }
    );

    console.log(`[SMS-SERVICE] OTP for ${mobile} is ${otp}`);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      isRegistered: !!user,
      otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    let assignedKitchen = null;
    if (user.role === 'kitchen_admin' || user.role === 'billing_admin') {
      assignedKitchen = await Kitchen.findOne({
        $or: [{ admin: user._id }, { billingAdmin: user._id }]
      }).select('name location');
    }

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
        kitchen: assignedKitchen
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const otpLogin = async (req, res) => {
  try {
    const { name, mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({ message: 'Mobile and OTP are required' });
    }

    // Verify OTP from database
    const otpRecord = await Otp.findOne({ mobile, otp });
    if (!otpRecord) {
      return res.status(401).json({ message: 'Invalid OTP' });
    }

    // Delete OTP after successful verification
    await Otp.deleteOne({ _id: otpRecord._id });

    let user = await User.findOne({ mobile });
    let isNewUser = false;

    if (!user) {
      if (!name) {
        return res.status(400).json({ message: 'Name is required for first-time registration' });
      }
      user = await User.create({ name, mobile, role: 'user' });
      isNewUser = true;
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      isNewUser,
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const register = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // RBAC: Only super_admin or admin can create new admins
    if (!req.user || (req.user.role !== 'super_admin' && req.user.role !== 'admin')) {
      return res.status(403).json({ message: 'Only Super Admins can create new users' });
    }

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    console.log(`Starting registration for: ${email} with role: ${role}`);

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`Registration failed: User ${email} already exists`);
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const user = await User.create({ email, password, role });
    console.log(`Registration successful: ${user._id}`);

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration Error Details:', error);

    // Check for MongoDB duplication error (code 11000)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ message: `A user with this ${field} already exists` });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }

    res.status(500).json({ message: 'Internal server error during registration' });
  }
};

export const getProfile = async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: 'Invalid current password' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'super_admin' } }).select('-password');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};