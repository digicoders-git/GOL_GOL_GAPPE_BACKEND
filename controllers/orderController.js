import Order from '../models/Order.js';
import Kitchen from '../models/Kitchen.js';
import Product from '../models/Product.js';
import UserInventory from '../models/UserInventory.js';

export const createOrder = async (req, res) => {
  try {
    const { items } = req.body;
    
    // Check stock for all items
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ message: `Product not found` });
      }
      if (!product.inStock || product.quantity <= 0 || product.status === 'Out of Stock') {
        return res.status(400).json({ message: `${product.name} is out of stock` });
      }
      if (product.quantity < item.quantity) {
        return res.status(400).json({ message: `Only ${product.quantity} ${product.unit} of ${product.name} available` });
      }
    }
    
    const orderNumber = `ORD${Date.now()}`;

    const orderData = {
      orderNumber,
      customer: req.user._id,
      items: items,
      totalAmount: req.body.totalAmount,
      paymentMethod: req.body.paymentMethod,
      paymentStatus: req.body.paymentStatus || 'Pending',
      status: 'Pending'
    };

    const order = await Order.create(orderData);
    await order.populate('items.product', 'name price unit thumbnail');
    await order.populate('customer', 'name email mobile');

    res.status(201).json({ success: true, order });
  } catch (error) {
    console.error('createOrder error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .populate('items.product', 'name price unit thumbnail')
      .populate('kitchen', 'name location')
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (error) {
    console.error('getMyOrders error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'billing_admin') {
      // Billing admin sees unassigned orders OR orders assigned to their kitchen
      const kitchen = await Kitchen.findOne({ billingAdmin: req.user._id });
      if (kitchen) {
        query = {
          $or: [
            { kitchen: null },
            { kitchen: kitchen._id }
          ]
        };
      } else {
        query.kitchen = null;
      }
    } else if (req.user.role === 'kitchen_admin') {
      const kitchen = await Kitchen.findOne({ admin: req.user._id });
      if (kitchen) {
        query.kitchen = kitchen._id;
      }
    }

    const orders = await Order.find(query)
      .populate('items.product', 'name price unit')
      .populate('customer', 'name email mobile')
      .populate('kitchen', 'name location')
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (error) {
    console.error('getAllOrders error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const assignKitchenToOrder = async (req, res) => {
  try {
    const { kitchenId } = req.body;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { kitchen: kitchenId, status: 'Assigned_to_Kitchen' },
      { new: true }
    )
      .populate('items.product', 'name price unit')
      .populate('customer', 'name email mobile')
      .populate('kitchen', 'name location');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('assignKitchenToOrder error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate('items.product', 'name price unit')
      .populate('customer', 'name email mobile')
      .populate('kitchen', 'name location');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('updateOrderStatus error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    console.error('deleteOrder error:', error);
    res.status(500).json({ message: error.message });
  }
};
