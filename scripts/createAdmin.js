import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const createAdmin = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');

    const userSchema = new mongoose.Schema({
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      role: { type: String, enum: ['admin', 'manager'], default: 'admin' }
    }, { timestamps: true });

    const User = mongoose.model('User', userSchema);

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@golgolgappe.com' });
    if (existingAdmin) {
      console.log('ℹ️  Admin user already exists');
      console.log('Email: admin@golgolgappe.com');
      console.log('Password: admin123');
      process.exit(0);
    }

    // Create new admin
    console.log('👤 Creating admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const admin = new User({
      email: 'admin@golgolgappe.com',
      password: hashedPassword,
      role: 'admin'
    });

    await admin.save();
    
    console.log('✅ Admin user created successfully!');
    console.log('📋 Login Credentials:');
    console.log('Email: admin@golgolgappe.com');
    console.log('Password: admin123');
    console.log('Role: admin');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }
};

createAdmin();