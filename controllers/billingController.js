import Billing from '../models/Billing.js';
import Product from '../models/Product.js';
import StockLog from '../models/StockLog.js';
import UserInventory from '../models/UserInventory.js';
import Kitchen from '../models/Kitchen.js';
import mongoose from 'mongoose';

export const getAllBills = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'kitchen_admin') {
      const kitchen = await Kitchen.findOne({ admin: req.user._id });
      if (kitchen) {
        query.kitchen = kitchen._id;
      } else {
        return res.json({ success: true, bills: [] });
      }
    } else if (req.user.role === 'billing_admin') {
      // Billing admin sees orders for their assigned kitchen
      const kitchen = await Kitchen.findOne({ billingAdmin: req.user._id });
      if (kitchen) {
        query.kitchen = kitchen._id;
      } else {
        return res.json({ success: true, bills: [] });
      }
    }

    const bills = await Billing.find(query)
      .populate('kitchen', 'name location')
      .populate('items.product', 'name unit')
      .sort({ createdAt: -1 });
    res.json({ success: true, bills });
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

    // Prepare bill data
    const billData = {
      ...req.body,
      billNumber,
      kitchen: req.body.kitchen || kitchenId,
      customer: req.body.customer || {
        name: customerName,
        phone: customerMobile
      },
      status: req.body.status || 'Pending'
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
    let kitchen;

    if (req.user.role === 'kitchen_admin') {
      kitchen = await Kitchen.findOne({ admin: req.user._id });
    } else if (req.user.role === 'billing_admin') {
      kitchen = await Kitchen.findById(req.user.kitchen);
    }

    if (!kitchen) {
      return res.json({ success: true, bills: [] });
    }

    const bills = await Billing.find({
      kitchen: kitchen._id,
      status: { $in: ['Assigned_to_Kitchen', 'Processing', 'Ready', 'Completed'] }
    })
      .populate('items.product', 'name unit')
      .populate('kitchen', 'name location')
      .sort({ createdAt: -1 });

    res.json({ success: true, bills });
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