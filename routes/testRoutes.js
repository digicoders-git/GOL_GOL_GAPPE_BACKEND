import express from 'express';
import Order from '../models/Order.js';
import Billing from '../models/Billing.js';
import Product from '../models/Product.js';
import Kitchen from '../models/Kitchen.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.use(auth);

// Test endpoint to create order and billing
router.post('/test-order-billing', async (req, res) => {
  try {
    console.log('=== TEST ORDER BILLING ===');
    console.log('User:', req.user._id, req.user.email);

    // Get first product
    const product = await Product.findOne({});
    if (!product) {
      return res.status(400).json({ message: 'No products found' });
    }

    console.log('Product found:', product._id, product.name);

    // Create order
    const orderNumber = `ORD${Date.now()}`;
    const orderData = {
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
    };

    console.log('Creating order with data:', orderData);
    const order = await Order.create(orderData);
    console.log('Order created:', order._id);

    // Create billing
    const billNumber = `BILL${Date.now()}`;
    const billingData = {
      billNumber,
      customer: {
        name: req.user.name || 'Test Customer',
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
    };

    console.log('Creating billing with data:', billingData);
    const billing = await Billing.create(billingData);
    console.log('Billing created:', billing._id);

    // Verify both exist
    const orderCheck = await Order.findById(order._id);
    const billingCheck = await Billing.findById(billing._id);

    console.log('Order verification:', orderCheck ? 'OK' : 'FAILED');
    console.log('Billing verification:', billingCheck ? 'OK' : 'FAILED');

    res.json({
      success: true,
      message: 'Test order and billing created successfully',
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
    console.error('Test error:', error);
    res.status(500).json({ message: error.message, stack: error.stack });
  }
});

// Check all orders and bills
router.get('/test-check-data', async (req, res) => {
  try {
    console.log('=== CHECK DATA ===');

    const orders = await Order.find({}).lean();
    const bills = await Billing.find({}).lean();
    const products = await Product.find({}).lean();
    const kitchens = await Kitchen.find({}).lean();

    console.log('Orders:', orders.length);
    console.log('Bills:', bills.length);
    console.log('Products:', products.length);
    console.log('Kitchens:', kitchens.length);

    res.json({
      success: true,
      counts: {
        orders: orders.length,
        bills: bills.length,
        products: products.length,
        kitchens: kitchens.length
      },
      data: {
        latestOrder: orders[orders.length - 1] || null,
        latestBill: bills[bills.length - 1] || null,
        firstProduct: products[0] || null,
        firstKitchen: kitchens[0] || null
      }
    });
  } catch (error) {
    console.error('Check error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all bills for current user
router.get('/test-my-bills', async (req, res) => {
  try {
    console.log('=== GET MY BILLS ===');
    console.log('User:', req.user._id, req.user.email, 'Role:', req.user.role);

    const bills = await Billing.find({})
      .populate('items.product', 'name price')
      .lean();

    console.log('Total bills in DB:', bills.length);

    res.json({
      success: true,
      bills,
      userInfo: {
        userId: req.user._id,
        email: req.user.email,
        role: req.user.role,
        mobile: req.user.mobile
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
