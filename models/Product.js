import mongoose from 'mongoose';

const nutritionSchema = new mongoose.Schema({
  calories: { type: Number, default: 0 },
  protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  fat: { type: Number, default: 0 }
}, { _id: false });

const productSchema = new mongoose.Schema({
  // BASIC INFO
  name: {
    type: String,
    required: true,
    trim: true
  },
  shortName: {
    type: String,
    trim: true
  },
  slug: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  detailedDescription: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  cuisineType: [String], // ["North Indian", "Chinese"]
  tags: [String], // Bestseller, Chef Special

  // IMAGES
  images: [String],
  thumbnail: String,
  videoUrl: String,

  // PRICING
  price: {
    type: Number,
    required: true,
    min: 0
  },
  discountPrice: {
    type: Number,
    min: 0
  },
  gstPercent: {
    type: Number,
    default: 0
  },
  serviceChargeApplicable: {
    type: Boolean,
    default: false
  },
  packagingCharge: {
    type: Number,
    default: 0
  },
  costPrice: {
    type: Number,
    min: 0
  },

  // FOOD TYPE
  foodType: {
    type: String,
    enum: ["veg", "non-veg", "jain", "vegan"],
    required: true
  },

  // NUTRITION
  nutrition: nutritionSchema,

  // STOCK & INVENTORY (Enhanced)
  inStock: {
    type: Boolean,
    default: true
  },
  quantity: {
    type: Number,
    default: 0
  },
  unit: {
    type: String,
    default: 'pcs'
  },
  minStock: {
    type: Number,
    default: 10
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['In Stock', 'Low Stock', 'Out of Stock'],
    default: 'In Stock'
  }
}, {
  timestamps: true
});

// Middleware to generate slug from name if not provided
productSchema.pre('save', function () {
  if (this.name && !this.slug) {
    let baseSlug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!baseSlug) baseSlug = 'product';

    // Add timestamp to ensure uniqueness
    this.slug = `${baseSlug}-${Date.now()}`;
  }
});

export default mongoose.model('Product', productSchema);