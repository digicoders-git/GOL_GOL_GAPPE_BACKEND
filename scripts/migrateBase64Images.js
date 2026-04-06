import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "./models/Product.js";
import { saveBase64Locally } from "./middleware/localUpload.js";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
    process.exit(1);
  }
};

const migrateBase64Images = async () => {
  try {
    console.log('=== Starting Base64 Image Migration ===\n');
    
    // Find all products with base64 images
    const products = await Product.find({
      $or: [
        { thumbnail: { $regex: /^data:image/ } },
        { images: { $elemMatch: { $regex: /^data:image/ } } }
      ]
    });

    console.log(`Found ${products.length} products with base64 images\n`);

    let migratedCount = 0;

    for (const product of products) {
      console.log(`Processing: ${product.name}`);
      
      // Convert thumbnail
      if (product.thumbnail && product.thumbnail.startsWith('data:image')) {
        try {
          const result = await saveBase64Locally(product.thumbnail, 'products/thumbnails');
          product.thumbnail = result.secure_url;
          console.log(`  ✓ Thumbnail converted: ${result.secure_url}`);
        } catch (err) {
          console.error(`  ✗ Thumbnail error: ${err.message}`);
        }
      }

      // Convert images array
      if (product.images && product.images.length > 0) {
        const newImages = [];
        for (const img of product.images) {
          if (img && img.startsWith('data:image')) {
            try {
              const result = await saveBase64Locally(img, 'products/images');
              newImages.push(result.secure_url);
              console.log(`  ✓ Image converted: ${result.secure_url}`);
            } catch (err) {
              console.error(`  ✗ Image error: ${err.message}`);
            }
          } else {
            newImages.push(img);
          }
        }
        product.images = newImages;
      }

      await product.save();
      migratedCount++;
      console.log('');
    }

    console.log(`=== Migration Complete ===`);
    console.log(`Processed ${migratedCount} products`);

  } catch (error) {
    console.error('Migration Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

connectDB().then(migrateBase64Images);