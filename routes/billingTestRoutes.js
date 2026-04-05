import express from 'express';
import Billing from '../models/Billing.js';
import Product from '../models/Product.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.use(auth);

// Direct billing creation for testing
router.post('/create-test-bill', async (req, res) => {
  try {
    console.log('=== CREATE TEST BILL ===');

    // Get first product
    const product = await Product.findOne({});
    if (!product) {
      return res.status(400).json({ message: 'No products found' });
    }

    const billNumber = `BILL${Date.now()}`;
    const billingData = {
      billNumber,
      customer: {
        name: req.user.name || 'Test User',
        phone: req.user.mobile || '9999999999'
      },
      items: [{
        product: product._id,
        quantity: 2,
        price: product.price
      }],
      totalAmount: product.price * 2,
      paymentMethod: 'Cash',
      status: 'Pending',
      kitchen: null
    };

    console.log('Creating billing:', billingData);
    const billing = await Billing.create(billingData);
    console.log('Billing created successfully:', billing._id);

    // Verify
    const verify = await Billing.findById(billing._id).populate('items.product');
    console.log('Verification:', verify ? 'SUCCESS' : 'FAILED');

    res.json({
      success: true,
      message: 'Test bill created',
      bill: verify
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
    const bills = await Billing.find({})
      .populate('items.product', 'name price unit')
      .populate('kitchen', 'name')
      .sort({ createdAt: -1 });

    console.log('Total bills:', bills.length);

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

// Delete all bills (for testing only)
router.delete('/delete-all-bills', async (req, res) => {
  try {
    const result = await Billing.deleteMany({});
    console.log('Deleted bills:', result.deletedCount);

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} bills`
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
