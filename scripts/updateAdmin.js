import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const updateAdmin = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');

    const userSchema = new mongoose.Schema({
      name: { type: String, trim: true },
      mobile: { type: String, unique: true, sparse: true, trim: true },
      email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
      password: { type: String },
      profilePic: { type: String, trim: true },
      address: { type: String, trim: true },
      role: {
        type: String,
        enum: ['super_admin', 'billing_admin', 'kitchen_admin', 'user', 'admin'],
        default: 'user'
      }
    }, { timestamps: true });

    const User = mongoose.model('User', userSchema);

    // Update admin role
    const result = await User.updateOne(
      { email: 'admin@golgolgappe.com' },
      { 
        role: 'super_admin',
        name: 'Super Admin'
      }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Admin role updated to super_admin');
    } else {
      console.log('ℹ️  No changes made');
    }

    const admin = await User.findOne({ email: 'admin@golgolgappe.com' });
    console.log('📋 Current Admin Details:');
    console.log('Email:', admin.email);
    console.log('Role:', admin.role);
    console.log('Name:', admin.name);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating admin:', error.message);
    process.exit(1);
  }
};

updateAdmin();