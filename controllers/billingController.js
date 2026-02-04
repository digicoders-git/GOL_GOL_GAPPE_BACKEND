import Billing from '../models/Billing.js';

export const getAllBills = async (req, res) => {
  try {
    const bills = await Billing.find()
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
    const billNumber = `BILL${Date.now()}`;
    const billData = { ...req.body, billNumber };
    
    const bill = await Billing.create(billData);
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