import Billing from '../models/Billing.js';
import Product from '../models/Product.js';
import StockLog from '../models/StockLog.js';
import mongoose from 'mongoose';

export const getAllBills = async (req, res) => {
  try {
    let query = {};

    // If not super_admin or admin, filter by kitchen assigned to this user
    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
      const kitchen = await mongoose.model('Kitchen').findOne({ admin: req.user._id });
      if (kitchen) {
        query.kitchen = kitchen._id;
      } else {
        // If no kitchen assigned to this admin, they shouldn't see any bills
        return res.json({ success: true, bills: [] });
      }
    }

    const bills = await Billing.find(query)
      .populate('kitchen', 'name location')
      .populate('items.product', 'name unit')
      .sort({ createdAt: -1 });
    res.json({ success: true, bills });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createBill = async (req, res) => {
  try {
    const { items } = req.body;
    const billNumber = `BILL${Date.now()}`;
    const billData = { ...req.body, billNumber };

    // Create the bill
    const bill = await Billing.create(billData);

    // Deduct stock for each item
    for (const item of items) {
      if (item.product) {
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

          // Log the stock removal
          await StockLog.create({
            product: product._id,
            type: 'REMOVE',
            quantity: Number(item.quantity),
            previousQuantity,
            newQuantity: product.quantity,
            notes: `Auto-deducted for Bill: ${billNumber}`,
            user: req.user ? req.user._id : null
          });
        }
      }
    }

    await bill.populate('kitchen', 'name location');
    await bill.populate('items.product', 'name unit');

    res.status(201).json({ success: true, bill });
  } catch (error) {
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
    res.status(500).json({ message: error.message });
  }
};

export const getKitchenOrders = async (req, res) => {
  try {
    // Find kitchen assigned to this admin
    const kitchen = await mongoose.model('Kitchen').findOne({ admin: req.user._id });
    if (!kitchen) {
      return res.status(404).json({ message: 'No kitchen assigned to this admin' });
    }

    const bills = await Billing.find({
      kitchen: kitchen._id,
      status: { $in: ['Assigned_to_Kitchen', 'Processing', 'Ready', 'Completed'] }
    })
      .populate('items.product', 'name unit')
      .sort({ updatedAt: -1 });

    res.json({ success: true, bills });
  } catch (error) {
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
    ).populate('items.product', 'name unit');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    res.json({ success: true, bill });
  } catch (error) {
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
    res.status(500).json({ message: error.message });
  }
};