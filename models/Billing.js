import mongoose from 'mongoose';

const billingSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    name: String,
    phone: String
  },
  kitchen: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Kitchen',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    quantity: Number,
    price: Number
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Paid', 'Assigned_to_Kitchen', 'Processing', 'Ready', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'UPI', 'Online']
  }
}, {
  timestamps: true
});

export default mongoose.model('Billing', billingSchema);