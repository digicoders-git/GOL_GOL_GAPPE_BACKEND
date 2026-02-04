import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['ingredients', 'stationery', 'packaging', 'others']
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'ltr', 'pcs', 'pkt']
  },
  minStock: {
    type: Number,
    default: 10
  },
  status: {
    type: String,
    enum: ['In Stock', 'Low Stock', 'Out of Stock'],
    default: 'In Stock'
  }
}, {
  timestamps: true
});

export default mongoose.model('Product', productSchema);