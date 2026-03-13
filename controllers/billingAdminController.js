import Kitchen from '../models/Kitchen.js';
import Billing from '../models/Billing.js';
import Order from '../models/Order.js';
import UserInventory from '../models/UserInventory.js';

export const getMyKitchen = async (req, res) => {
  try {
    // Check both billingAdmin field and user's kitchen reference
    let kitchen = await Kitchen.findOne({ billingAdmin: req.user._id })
      .populate('assignedProducts.product', 'name unit price')
      .populate('admin', 'email name');

    // If not found by billingAdmin, try by user's kitchen field
    if (!kitchen && req.user.kitchen) {
      kitchen = await Kitchen.findById(req.user.kitchen)
        .populate('assignedProducts.product', 'name unit price')
        .populate('admin', 'email name');
    }

    if (!kitchen) {
      return res.json({ success: true, kitchen: null, message: 'No kitchen assigned to you' });
    }

    res.json({ success: true, kitchen });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyKitchenOrders = async (req, res) => {
  try {
    let kitchen = await Kitchen.findOne({ billingAdmin: req.user._id });

    if (!kitchen && req.user.kitchen) {
      kitchen = await Kitchen.findById(req.user.kitchen);
    }

    if (!kitchen) {
      return res.json({ success: true, orders: [] });
    }

    const [bills, onlineOrders] = await Promise.all([
      Billing.find({ kitchen: kitchen._id })
        .populate('items.product', 'name price unit')
        .sort({ createdAt: -1 }),
      Order.find({ kitchen: kitchen._id })
        .populate('items.product', 'name price unit')
        .populate('customer', 'name phone')
        .sort({ createdAt: -1 })
    ]);

    // Merge and normalize for frontend
    const allOrders = [
      ...bills.map(b => ({ ...b.toObject(), type: 'BILL' })),
      ...onlineOrders.map(o => ({ 
        ...o.toObject(), 
        type: 'ORDER',
        billNumber: o.orderNumber, // Map to field name frontend expects
        customer: { name: o.customer?.name || 'Online Customer' }
      }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, orders: allOrders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyKitchenInventory = async (req, res) => {
  try {
    // Find billing admin's kitchen
    let kitchen = await Kitchen.findOne({ billingAdmin: req.user._id });

    if (!kitchen && req.user.kitchen) {
      kitchen = await Kitchen.findById(req.user.kitchen);
    }

    if (!kitchen) {
      return res.json({ success: true, inventory: [] });
    }

    // Get kitchen admin's inventory (not billing admin's)
    const inventory = await UserInventory.find({ user: kitchen.admin })
      .populate('product', 'name unit price thumbnail')
      .sort({ updatedAt: -1 });

    // Filter out entries where product is null (deleted products)
    const validInventory = inventory.filter(item => item.product !== null);

    res.json({ success: true, inventory: validInventory });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
