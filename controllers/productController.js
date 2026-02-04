import Product from '../models/Product.js';
import StockLog from '../models/StockLog.js';

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

export const getStockLogs = async (req, res) => {
  try {
    const logs = await StockLog.find()
      .populate('product', 'name category unit')
      .populate('user', 'username')
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};