import Kitchen from '../models/Kitchen.js';
import Billing from '../models/Billing.js';
import Order from '../models/Order.js';
import UserInventory from '../models/UserInventory.js';

export const getMyKitchen = async (req, res) => {
  try {
    console.log('getMyKitchen called for user:', req.user._id, 'role:', req.user.role);
    
    let kitchen = await Kitchen.findOne({ billingAdmin: req.user._id })
      .populate('assignedProducts.product', 'name unit price category thumbnail')
      .populate('admin', 'email name');

    console.log('Kitchen found by billingAdmin:', kitchen ? kitchen.name : 'null');
    console.log('Assigned products:', kitchen?.assignedProducts?.length || 0);

    if (!kitchen && req.user.kitchen) {
      kitchen = await Kitchen.findById(req.user.kitchen)
        .populate('assignedProducts.product', 'name unit price category thumbnail')
        .populate('admin', 'email name');
      console.log('Kitchen found by user.kitchen:', kitchen ? kitchen.name : 'null');
    }

    if (!kitchen) {
      return res.json({ success: true, kitchen: null, message: 'No kitchen assigned to you' });
    }

    console.log('Returning kitchen:', kitchen.name, 'with', kitchen.assignedProducts.length, 'assigned products');
    res.json({ success: true, kitchen });
  } catch (error) {
    console.error('getMyKitchen error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getMyKitchenOrders = async (req, res) => {
  try {
    console.log('getMyKitchenOrders called - User:', req.user._id, 'Role:', req.user.role);
    
    let kitchen = await Kitchen.findOne({ billingAdmin: req.user._id });

    if (!kitchen && req.user.kitchen) {
      kitchen = await Kitchen.findById(req.user.kitchen);
    }

    if (!kitchen) {
      console.log('No kitchen found for billing admin');
      return res.json({ success: true, orders: [] });
    }

    console.log('Kitchen found:', kitchen.name, 'ID:', kitchen._id);

    // Fetch both Bills and Orders (assigned + unassigned)
    const [bills, onlineOrders] = await Promise.all([
      Billing.find({ 
        $or: [
          { kitchen: kitchen._id },           // Assigned to this kitchen
          { kitchen: { $exists: false } },    // Not assigned yet
          { kitchen: null }                   // Not assigned yet
        ]
      })
        .populate('items.product', 'name price unit thumbnail')
        .populate('kitchen', 'name location')
        .sort({ createdAt: -1 })
        .lean(),
      Order.find({ 
        $or: [
          { kitchen: kitchen._id },           // Assigned to this kitchen
          { kitchen: { $exists: false } },    // Not assigned yet
          { kitchen: null }                   // Not assigned yet
        ]
      })
        .populate('items.product', 'name price unit thumbnail')
        .populate('customer', 'name mobile email')
        .populate('kitchen', 'name location')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    console.log('Bills found:', bills.length);
    console.log('Online Orders found:', onlineOrders.length);

    // Merge and normalize for frontend
    const allOrders = [
      ...bills.map(b => ({ 
        ...b, 
        type: 'BILL',
        customer: b.customer || { name: 'Walk-in Customer', phone: '' }
      })),
      ...onlineOrders.map(o => ({ 
        ...o, 
        type: 'ORDER',
        billNumber: o.orderNumber, // Map orderNumber to billNumber for frontend
        customer: { 
          name: o.customer?.name || 'Online Customer',
          phone: o.customer?.mobile || o.customer?.phone || ''
        }
      }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log('Total orders returned:', allOrders.length);
    res.json({ success: true, orders: allOrders });
  } catch (error) {
    console.error('getMyKitchenOrders error:', error);
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
