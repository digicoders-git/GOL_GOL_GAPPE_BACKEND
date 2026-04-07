import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create subdirectories
const subdirs = ['products/thumbnails', 'products/images'];
subdirs.forEach(subdir => {
  const fullPath = path.join(uploadsDir, subdir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Local storage configuration
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = uploadsDir;
    
    if (file.fieldname === 'thumbnail') {
      uploadPath = path.join(uploadsDir, 'products/thumbnails');
    } else if (file.fieldname === 'images') {
      uploadPath = path.join(uploadsDir, 'products/images');
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const localUpload = multer({
  storage: localStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Save base64 image locally
export const saveBase64Locally = async (base64String, folder = 'products') => {
  try {
    const matches = base64String.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 image format');
    }
    
    const extension = matches[1];
    const imageData = matches[2];
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `image-${uniqueSuffix}.${extension}`;
    
    // Save to local filesystem
    const folderPath = path.join(uploadsDir, 'products', folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    
    const fullPath = path.join(folderPath, filename);
    fs.writeFileSync(fullPath, imageData, 'base64');
    
    console.log('Image saved locally:', fullPath);
    console.log('File exists:', fs.existsSync(fullPath));
    
    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 4000}`;
    const imageUrl = `${serverUrl}/uploads/products/${folder}/${filename}`;
    
    console.log('Image URL:', imageUrl);
    
    return {
      secure_url: imageUrl,
      public_id: filename
    };
  } catch (error) {
    console.error('Save base64 error:', error);
    throw new Error(`Failed to save base64 image: ${error.message}`);
  }
};

export default localUpload;