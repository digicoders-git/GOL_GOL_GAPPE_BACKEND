import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const uploadToCloudinary = async (fileStr) => {
  if (!fileStr || !fileStr.startsWith('data:image')) return fileStr;
  
  try {
    const uploadResponse = await cloudinary.uploader.upload(fileStr, {
      folder: 'golgolgappe_products'
    });
    return uploadResponse.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return fileStr; // Fallback to base64 if upload fails
  }
};

export default cloudinary;
