import Product from '../models/Product.js';
import StockLog from '../models/StockLog.js';
import UserInventory from '../models/UserInventory.js';
import StockTransfer from '../models/StockTransfer.js';

export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const addQuantity = async (req, res) => {
  try {
    const { productName, category, quantity, unit, notes } = req.body;

    let product = await Product.findOne({ name: productName });

    if (product) {
      const previousQuantity = product.quantity;
      product.quantity += Number(quantity);

      // Update status based on quantity
      if (product.quantity > product.minStock) {
        product.status = 'In Stock';
      } else if (product.quantity > 0) {
        product.status = 'Low Stock';
      } else {
        product.status = 'Out of Stock';
      }

      await product.save();

      // Create stock log
      await StockLog.create({
        product: product._id,
        type: 'ADD',
        quantity: Number(quantity),
        previousQuantity,
        newQuantity: product.quantity,
        notes,
        user: req.user._id
      });
    } else {
      // Create new product
      product = await Product.create({
        name: productName,
        category,
        quantity: Number(quantity),
        unit,
        status: Number(quantity) > 10 ? 'In Stock' : 'Low Stock'
      });

      // Create stock log
      await StockLog.create({
        product: product._id,
        type: 'ADD',
        quantity: Number(quantity),
        previousQuantity: 0,
        newQuantity: product.quantity,
        notes,
        user: req.user._id
      });
    }

    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const transferStock = async (req, res) => {
  try {
    const { toUserId, toUser, productId, product: productKey, quantity, notes } = req.body;
    const finalToUserId = toUserId || toUser;
    const finalProductId = productId || productKey;
    const fromUserId = req.user._id;

    if (!finalProductId) return res.status(400).json({ message: 'Product ID is required' });
    if (!finalToUserId) return res.status(400).json({ message: 'Recipient User ID is required' });

    const product = await Product.findById(finalProductId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // If sender is super_admin or admin, check global product stock
    if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      if (product.quantity < quantity) {
        return res.status(400).json({ message: 'Insufficient stock in main inventory' });
      }
      product.quantity -= Number(quantity);
      await product.save();
    } else {
      // Check sender's specific inventory
      const fromInv = await UserInventory.findOne({ user: fromUserId, product: finalProductId });
      if (!fromInv || fromInv.quantity < quantity) {
        return res.status(400).json({ message: 'Insufficient stock in your inventory' });
      }
      fromInv.quantity -= Number(quantity);
      await fromInv.save();
    }

    // Increase recipient's stock
    let toInv = await UserInventory.findOne({ user: finalToUserId, product: finalProductId });
    if (!toInv) {
      toInv = new UserInventory({ user: finalToUserId, product: finalProductId, quantity: 0 });
    }
    toInv.quantity += Number(quantity);
    await toInv.save();

    // Log the transfer
    await StockTransfer.create({
      fromUser: fromUserId,
      toUser: finalToUserId,
      product: finalProductId,
      quantity,
      notes
    });

    res.json({ success: true, message: 'Stock transferred successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getUserInventory = async (req, res) => {
  try {
    const inventory = await UserInventory.find({ user: req.user._id })
      .populate('product')
      .sort({ updatedAt: -1 });
    res.json({ success: true, inventory });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTransferHistory = async (req, res) => {
  try {
    const query = req.user.role === 'super_admin'
      ? {}
      : { $or: [{ fromUser: req.user._id }, { toUser: req.user._id }] };

    const transfers = await StockTransfer.find(query)
      .populate('fromUser', 'email role')
      .populate('toUser', 'email role')
      .populate('product', 'name unit')
      .sort({ createdAt: -1 });

    console.log(`Fetched ${transfers.length} transfers for role: ${req.user.role}`);
    res.json({ success: true, transfers });
  } catch (error) {
    console.error('getTransferHistory error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getStockLogs = async (req, res) => {
  try {
    const logs = await StockLog.find()
      .populate('product', 'name category unit')
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};