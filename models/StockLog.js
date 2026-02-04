import mongoose from 'mongoose';

const stockLogSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  type: {
    type: String,
    enum: ['ADD', 'REMOVE', 'TRANSFER'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  previousQuantity: {
    type: Number,
    required: true
  },
  newQuantity: {
    type: Number,
    required: true
  },
  notes: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

export default mongoose.model('StockLog', stockLogSchema);