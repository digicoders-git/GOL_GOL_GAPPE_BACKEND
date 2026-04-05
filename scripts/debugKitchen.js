import mongoose from 'mongoose';
import Kitchen from '../models/Kitchen.js';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const kitchens = await Kitchen.find()
      .populate('assignedProducts.product', 'name')
      .lean();

    console.log('\n=== KITCHEN STOCK DEBUG ===\n');
    
    kitchens.forEach(k => {
      console.log(`Kitchen: ${k.name}`);
      console.log('Assigned Products:');
      k.assignedProducts.forEach(ap => {
        console.log(`  - ${ap.product?.name || 'Unknown'}`);
        console.log(`    assigned: ${ap.assigned}`);
        console.log(`    used: ${ap.used}`);
        console.log(`    quantity: ${ap.quantity}`);
        console.log(`    remaining: ${(ap.assigned || 0) - (ap.used || 0)}`);
      });
      console.log('---');
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

connectDB();
