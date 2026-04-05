import express from 'express';
import Billing from '../models/Billing.js';
import Order from '../models/Order.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.use(auth);

// Debug endpoint to see all assigned orders
router.get('/assigned-orders', async (req, res) => {
  try {
    console.log('=== DEBUG: Checking Assigned Orders ===');
    
    const assignedBills = await Billing.find({ status: 'Assigned_to_Kitchen' })
      .populate('kitchen', 'name location')
      .populate('items.product', 'name unit')
      .lean();
    
    const assignedOrders = await Order.find({ status: 'Assigned_to_Kitchen' })
      .populate('kitchen', 'name location')
      .populate('items.product', 'name unit')
      .populate('customer', 'name mobile')
      .lean();
    
    console.log('Assigned Bills:', assignedBills.length);
    console.log('Assigned Orders:', assignedOrders.length);
    
    res.json({
      success: true,
      assignedBills,
      assignedOrders,
      totalAssigned: assignedBills.length + assignedOrders.length
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Check all orders regardless of status
router.get('/all-orders-debug', async (req, res) => {
  try {
    const allBills = await Billing.find({}).lean();
    const allOrders = await Order.find({}).lean();
    
    res.json({
      success: true,
      totalBills: allBills.length,
      totalOrders: allOrders.length,
      bills: allBills,
      orders: allOrders
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
