import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';

dotenv.config();

const cleanupBase64Images = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    console.log('Finding products with base64 images...');
    const products = await Product.find({
      $or: [
        { thumbnail: { $regex: '^data:image' } },
        { images: { $elemMatch: { $regex: '^data:image' } } }
      ]
    });

    console.log(`Found ${products.length} products with base64 images`);

    for (const product of products) {
      let updated = false;

      // Clean thumbnail
      if (product.thumbnail && product.thumbnail.startsWith('data:image')) {
        console.log(`Cleaning thumbnail for product: ${product.name}`);
        product.thumbnail = '';
        updated = true;
      }

      // Clean images array
      if (product.images && product.images.length > 0) {
        const cleanImages = product.images.filter(img => !img.startsWith('data:image'));
        if (cleanImages.length !== product.images.length) {
          console.log(`Cleaning ${product.images.length - cleanImages.length} base64 images from product: ${product.name}`);
          product.images = cleanImages;
          updated = true;
        }
      }

      if (updated) {
        await product.save();
        console.log(`✓ Updated product: ${product.name}`);
      }
    }

    console.log('\n✓ Cleanup completed successfully!');
    console.log(`Total products cleaned: ${products.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
};

cleanupBase64Images();
