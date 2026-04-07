import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const cleanup = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all products
    const allProducts = await mongoose.connection.collection('products').find({}).toArray();
    console.log(`Total products in DB: ${allProducts.length}`);
    allProducts.forEach(p => console.log(`  - ${p._id}: ${p.name}`));

    // Get all kitchens
    const kitchens = await mongoose.connection.collection('kitchens').find({}).toArray();
    console.log(`\nTotal kitchens: ${kitchens.length}`);

    for (const kitchen of kitchens) {
      console.log(`\nKitchen: ${kitchen.name}`);
      console.log(`  Assigned products: ${kitchen.assignedProducts?.length || 0}`);
      
      if (kitchen.assignedProducts && kitchen.assignedProducts.length > 0) {
        for (const ap of kitchen.assignedProducts) {
          const productExists = allProducts.some(p => p._id.toString() === ap.product.toString());
          console.log(`    - Product ${ap.product}: ${productExists ? '✅ EXISTS' : '❌ DELETED'}`);
        }
      }
    }

    // Now remove invalid products
    console.log('\n--- REMOVING INVALID PRODUCTS ---\n');
    
    let totalRemoved = 0;
    for (const kitchen of kitchens) {
      if (!kitchen.assignedProducts || kitchen.assignedProducts.length === 0) continue;

      const validProducts = kitchen.assignedProducts.filter(ap => {
        return allProducts.some(p => p._id.toString() === ap.product.toString());
      });

      const removed = kitchen.assignedProducts.length - validProducts.length;
      
      if (removed > 0) {
        await mongoose.connection.collection('kitchens').updateOne(
          { _id: kitchen._id },
          { $set: { assignedProducts: validProducts } }
        );
        console.log(`Kitchen "${kitchen.name}": Removed ${removed} invalid products`);
        totalRemoved += removed;
      }
    }

    console.log(`\n✅ Total invalid products removed: ${totalRemoved}`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

cleanup();
