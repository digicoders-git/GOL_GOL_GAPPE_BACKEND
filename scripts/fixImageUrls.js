import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "./models/Product.js";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
};

const fixImageUrls = async () => {
  try {
    console.log("=== Fixing Image URLs ===\n");

    // Find all products with thumbnail or images
    const products = await Product.find({
      $or: [
        { thumbnail: { $exists: true, $ne: "" } },
        { images: { $exists: true, $ne: [] } }
      ]
    });

    console.log(`Found ${products.length} products\n`);

    let fixedCount = 0;
    const serverUrl = process.env.SERVER_URL || "http://localhost:4000";

    for (const product of products) {
      let needsSave = false;

      // Fix thumbnail URL
      if (product.thumbnail) {
        // If URL is like https://gol-gol-gappe-backend.onrender.com/uploads/products/thumbnails/xxx
        // Change to https://gol-gol-gappe-backend.onrender.com/uploads/thumbnails/xxx
        if (product.thumbnail.includes("/uploads/products/thumbnails/")) {
          const newUrl = product.thumbnail.replace("/uploads/products/thumbnails/", "/uploads/thumbnails/");
          console.log(`Fixing thumbnail: ${product.thumbnail} -> ${newUrl}`);
          product.thumbnail = newUrl;
          needsSave = true;
        }
      }

      // Fix images array URLs
      if (product.images && product.images.length > 0) {
        const newImages = product.images.map(img => {
          if (img && img.includes("/uploads/products/images/")) {
            return img.replace("/uploads/products/images/", "/uploads/images/");
          }
          return img;
        });
        
        if (JSON.stringify(product.images) !== JSON.stringify(newImages)) {
          product.images = newImages;
          needsSave = true;
        }
      }

      if (needsSave) {
        await product.save();
        fixedCount++;
        console.log(`✓ Updated: ${product.name}\n`);
      }
    }

    console.log(`=== Complete ===`);
    console.log(`Updated ${fixedCount} products`);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected");
    process.exit(0);
  }
};

connectDB().then(fixImageUrls);