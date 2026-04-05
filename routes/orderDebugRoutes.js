import express from 'express';
import Order from '../models/Order.js';
import Billing from '../models/Billing.js';
import Product from '../models/Product.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.use(auth);

// Create simple order + billing
router.post('/create-simple-order', async (req, res) => {
  try {
    console.log('=== CREATE SIMPLE ORDER ===');
    console.log('User:', req.user._id, req.user.email);

    // Get first product
    const product = await Product.findOne({});
    if (!product) {
      return res.status(400).json({ message: 'No products found' });
    }

    console.log('Product:', product._id, product.name, 'Price:', product.price);

    // Create order
    const orderNumber = `ORD${Date.now()}`;
    const order = await Order.create({
      orderNumber,
      customer: req.user._id,
      items: [{
        product: product._id,
        quantity: 1,
        price: product.price
      }],
      totalAmount: product.price,
      paymentMethod: 'Cash',
      paymentStatus: 'Pending',
      status: 'Pending'
    });

    console.log('Order created:', order._id);

    // Create billing
    const billNumber = `BILL${Date.now()}`;
    const billing = await Billing.create({
      billNumber,
      customer: {
        name: req.user.name || 'Test User',
        phone: req.user.mobile || '9999999999'
      },
      items: [{
        product: product._id,
        quantity: 1,
        price: product.price
      }],
      totalAmount: product.price,
      paymentMethod: 'Cash',
      status: 'Pending',
      kitchen: null
    });

    console.log('Billing created:', billing._id);

    // Verify both
    const orderCheck = await Order.findById(order._id);
    const billingCheck = await Billing.findById(billing._id);

    console.log('Order exists:', !!orderCheck);
    console.log('Billing exists:', !!billingCheck);

    res.json({
      success: true,
      message: 'Order and billing created',
      order: {
        _id: order._id,
        orderNumber: order.orderNumber
      },
      billing: {
        _id: billing._id,
        billNumber: billing.billNumber
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: error.stack
    });
  }
});

// Get all bills
router.get('/all-bills', async (req, res) => {
  try {
    console.log('=== GET ALL BILLS ===');

    const bills = await Billing.find({})
      .populate('items.product', 'name price')
      .sort({ createdAt: -1 });

    console.log('Bills found:', bills.length);

    res.json({
      success: true,
      count: bills.length,
      bills
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all orders
router.get('/all-orders', async (req, res) => {
  try {
    console.log('=== GET ALL ORDERS ===');

    const orders = await Order.find({})
      .populate('items.product', 'name price')
      .sort({ createdAt: -1 });

    console.log('Orders found:', orders.length);

    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
