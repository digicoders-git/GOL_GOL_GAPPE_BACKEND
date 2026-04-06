import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  image: { type: String},
  code: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true,
    minlength: 6,
    maxlength: 6,
    validate: {
      validator: function(v) {
        return /^[A-Z0-9]{6}$/.test(v);
      },
      message: 'Code must be exactly 6 alphanumeric characters'
    }
  },
  offerType: { type: String, enum: ['global', 'product-specific'], default: 'global' },
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
  discountValue: { type: Number, required: true },
  applicableProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  maxUses: { type: Number, required: true },
  usedCount: { type: Number, default: 0 },
  minOrderAmount: { type: Number, default: 0 },
  expiryDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  usedByCustomers: [{
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerMobile: { type: String },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    orderCompleted: { type: Boolean, default: false },
    usedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export default mongoose.model('Offer', offerSchema);
