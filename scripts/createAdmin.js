import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const createAdmin = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');

    const adminSchema = new mongoose.Schema({
      name: { type: String, trim: true },
      mobile: { type: String, unique: true, sparse: true, trim: true },
      email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
      password: { type: String },
      profilePic: { type: String, trim: true },
      address: { type: String, trim: true },
      role: {
        type: String,
        enum: ['super_admin', 'billing_admin', 'kitchen_admin'],
        default: 'billing_admin'
      }
    }, { timestamps: true });

    // Hash password before saving
    adminSchema.pre('save', async function () {
      if (!this.password || !this.isModified('password')) return;
      this.password = await bcrypt.hash(this.password, 10);
    });

    adminSchema.methods.comparePassword = async function (password) {
      if (!this.password) return false;
      return await bcrypt.compare(password, this.password);
    };

    const Admin = mongoose.model('Admin', adminSchema);

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: 'admin@golgolgappe.com' });
    if (existingAdmin) {
      console.log('ℹ️  Admin user already exists');
      console.log('Email: admin@golgolgappe.com');
      console.log('Password: admin123');
      console.log('Role:', existingAdmin.role);
      process.exit(0);
    }

    // Create new admin
    console.log('👤 Creating admin user...');
    
    const admin = new Admin({
      name: 'Super Admin',
      email: 'admin@golgolgappe.com',
      password: 'admin123',
      role: 'super_admin'
    });

    await admin.save();
    
    console.log('✅ Admin user created successfully!');
    console.log('📋 Login Credentials:');
    console.log('Email: admin@golgolgappe.com');
    console.log('Password: admin123');
    console.log('Role: super_admin');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }
};

createAdmin();