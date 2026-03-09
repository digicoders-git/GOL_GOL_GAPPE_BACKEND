import Kitchen from '../models/Kitchen.js';
import Billing from '../models/Billing.js';
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

    const orders = await Billing.find({ kitchen: kitchen._id })
      .populate('items.product', 'name price unit')
      .populate('customer')
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyKitchenInventory = async (req, res) => {
  try {
    let kitchen = await Kitchen.findOne({ billingAdmin: req.user._id });

    if (!kitchen && req.user.kitchen) {
      kitchen = await Kitchen.findById(req.user.kitchen);
    }

    if (!kitchen) {
      return res.json({ success: true, inventory: [], message: 'No kitchen found' });
    }

    // Get inventory from kitchen admin's UserInventory
    if (!kitchen.admin) {
      return res.json({ success: true, inventory: [], message: 'Kitchen has no admin' });
    }

    const inventory = await UserInventory.find({ user: kitchen.admin })
      .populate('product', 'name unit price thumbnail')
      .sort({ updatedAt: -1 });

    // Filter out entries where product is null (deleted products)
    const validInventory = inventory.filter(item => item.product !== null);

    res.json({ 
      success: true, 
      inventory: validInventory,
      debug: {
        kitchenId: kitchen._id,
        kitchenAdmin: kitchen.admin,
        totalInventoryItems: inventory.length,
        validItems: validInventory.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
