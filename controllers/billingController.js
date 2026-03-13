import Billing from '../models/Billing.js';
import Product from '../models/Product.js';
import StockLog from '../models/StockLog.js';
import UserInventory from '../models/UserInventory.js';
import Kitchen from '../models/Kitchen.js';
import Order from '../models/Order.js'; // Added Order model
import mongoose from 'mongoose';

export const getAllBills = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let query = {};

    if (req.user.role === 'kitchen_admin') {
      const kitchen = await Kitchen.findOne({ admin: req.user._id }).select('_id').lean();
      if (kitchen) {
        query.kitchen = kitchen._id;
      } else {
        return res.json({ success: true, bills: [], pagination: { page, limit, total: 0, pages: 0 } });
      }
    } else if (req.user.role === 'billing_admin') {
      const kitchen = await Kitchen.findOne({ billingAdmin: req.user._id }).select('_id').lean();
      if (kitchen) {
        query.kitchen = kitchen._id;
      } else {
        return res.json({ success: true, bills: [], pagination: { page, limit, total: 0, pages: 0 } });
      }
    }

    const [bills, total] = await Promise.all([
      Billing.find(query)
        .select('billNumber kitchen customer items totalAmount status createdAt')
        .populate('kitchen', 'name location')
        .populate('items.product', 'name unit')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Billing.countDocuments(query)
    ]);

    res.json({
      success: true,
      bills,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('getAllBills error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getUserOrders = async (req, res) => {
  try {
    const bills = await Billing.find({ 'customer.phone': req.user.mobile })
      .populate('items.product', 'name thumbnail price')
      .populate('kitchen', 'name location')
      .sort({ createdAt: -1 });
    res.json({ success: true, bills });
  } catch (error) {
    console.error('getUserOrders error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const createBill = async (req, res) => {
  try {
    const { items, kitchenId, customerName, customerMobile } = req.body;
    const billNumber = `BILL${Date.now()}`;

    // Kitchen assignment logic based on user role
    let kitchenToAssign = req.body.kitchen || kitchenId || null;

    // Only billing_admin can auto-assign their kitchen
    if (!kitchenToAssign && req.user && req.user.role === 'billing_admin') {
      const userKitchen = await Kitchen.findOne({ billingAdmin: req.user._id });
      if (userKitchen) {
        kitchenToAssign = userKitchen._id;
      }
    }

    // For regular users, kitchen remains null (billing admin will assign later)
    console.log('Creating bill - User:', req.user?.email, 'Role:', req.user?.role, 'Kitchen:', kitchenToAssign);

    // Prepare bill data
    const billData = {
      billNumber,
      kitchen: kitchenToAssign,
      customer: req.body.customer || { name: customerName, phone: customerMobile },
      items: items,
      totalAmount: req.body.totalAmount,
      status: req.body.status || 'Pending',
      paymentMethod: req.body.paymentMethod
    };

    // Create the bill
    const bill = await Billing.create(billData);

    // Get kitchen if assigned to handle localized stock deduction
    let kitchenAdmin = null;
    if (bill.kitchen) {
      const kitchen = await Kitchen.findById(bill.kitchen);
      if (kitchen) kitchenAdmin = kitchen.admin;
    }

    // Deduct stock for each item
    for (const item of items) {
      if (item.product) {
        // 1. Update Global Product Stock
        const product = await Product.findById(item.product);
        if (product) {
          const previousQuantity = product.quantity;
          product.quantity -= Number(item.quantity);

          // Update status
          if (product.quantity > product.minStock) {
            product.status = 'In Stock';
          } else if (product.quantity > 0) {
            product.status = 'Low Stock';
          } else {
            product.status = 'Out of Stock';
          }
          await product.save();

          // 2. Update Kitchen-Specific Inventory if applicable
          if (kitchenAdmin) {
            const uInv = await UserInventory.findOne({ user: kitchenAdmin, product: product._id });
            if (uInv) {
              uInv.quantity -= Number(item.quantity);
              await uInv.save();
            }
          }

          // Log the stock removal
          await StockLog.create({
            product: product._id,
            type: 'REMOVE',
            quantity: Number(item.quantity),
            previousQuantity,
            newQuantity: product.quantity,
            notes: `Auto-deducted for Bill: ${billNumber} ${bill.kitchen ? `(Kitchen: ${bill.kitchen})` : ''}`,
            user: req.user ? req.user._id : null
          });
        }
      }
    }

    await bill.populate('kitchen', 'name location');
    await bill.populate('items.product', 'name unit');

    res.status(201).json({ success: true, bill });
  } catch (error) {
    console.error('createBill error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateBill = async (req, res) => {
  try {
    const bill = await Billing.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    )
      .populate('kitchen', 'name location')
      .populate('items.product', 'name unit');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    res.json({ success: true, bill });
  } catch (error) {
    console.error('updateBill error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getBillById = async (req, res) => {
  try {
    const bill = await Billing.findById(req.params.id)
      .populate('kitchen', 'name location')
      .populate('items.product', 'name unit');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    res.json({ success: true, bill });
  } catch (error) {
    console.error('getBillById error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getKitchenOrders = async (req, res) => {
  try {
    console.log('getKitchenOrders called by:', req.user.email, 'Role:', req.user.role);
    let kitchen;

    if (req.user.role === 'kitchen_admin') {
      kitchen = await Kitchen.findOne({ admin: req.user._id });
      console.log('Kitchen found for kitchen_admin:', kitchen);
    } else if (req.user.role === 'billing_admin') {
      kitchen = await Kitchen.findOne({ billingAdmin: req.user._id });
      if (!kitchen && req.user.kitchen) {
        kitchen = await Kitchen.findById(req.user.kitchen);
      }
      console.log('Kitchen found for role', req.user.role, ':', kitchen?._id || 'None');
    }

    if (!kitchen) {
      console.log('No kitchen found, returning empty array');
      return res.json({ success: true, bills: [], message: 'No kitchen assigned' });
    }

    console.log('Searching bills and orders for kitchen:', kitchen._id);
    
    // Fetch both POS Bills and Online Orders in parallel
    const [bills, onlineOrders] = await Promise.all([
      Billing.find({ kitchen: kitchen._id })
        .populate('items.product', 'name unit thumbnail category')
        .populate('kitchen', 'name location')
        .sort({ createdAt: -1 })
        .lean(),
      Order.find({ kitchen: kitchen._id })
        .populate('items.product', 'name unit thumbnail category')
        .populate('customer', 'name mobile email')
        .populate('kitchen', 'name location')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    // Mark types and merge
    const merged = [
      ...bills.map(b => ({ ...b, type: 'BILL' })),
      ...onlineOrders.map(o => ({ ...o, type: 'ORDER' }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`Kitchen data found: Bills(${bills.length}), Orders(${onlineOrders.length})`);
    res.json({ success: true, bills: merged });
  } catch (error) {
    console.error('getKitchenOrders error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateBillStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const bill = await Billing.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate('kitchen', 'name location')
      .populate('items.product', 'name unit');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    res.json({ success: true, bill });
  } catch (error) {
    console.error('updateBillStatus error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteBill = async (req, res) => {
  try {
    const bill = await Billing.findByIdAndDelete(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }
    res.json({ success: true, message: 'Bill deleted successfully' });
  } catch (error) {
    console.error('deleteBill error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getPrintBill = async (req, res) => {
  try {
    const bill = await Billing.findById(req.params.id)
      .populate('kitchen', 'name location')
      .populate('items.product', 'name unit price')
      .populate('customer');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    res.json({ success: true, bill });
  } catch (error) {
    console.error('getPrintBill error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Test endpoint to check kitchen assignment logic
export const testKitchenAssignment = async (req, res) => {
  try {
    const userRole = req.user?.role || 'unknown';
    const userId = req.user?._id || 'unknown';

    let result = {
      userRole,
      userId,
      assignedKitchen: null
    };

    if (userRole === 'billing_admin') {
      const userKitchen = await Kitchen.findOne({ billingAdmin: userId });
      result.assignedKitchen = userKitchen;
    }

    const allKitchens = await Kitchen.find();
    result.allKitchens = allKitchens;

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};