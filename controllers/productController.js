import Product from '../models/Product.js';
import StockLog from '../models/StockLog.js';
import UserInventory from '../models/UserInventory.js';
import StockTransfer from '../models/StockTransfer.js';
import Kitchen from '../models/Kitchen.js';
import User from '../models/User.js';
import { uploadToCloudinary } from '../middleware/upload.js';

export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .select('name category unit price discountPrice quantity status minStock thumbnail foodType inStock')
      .sort({ name: 1 })
      .lean()
      .maxTimeMS(5000);
    
    res.json({ 
      success: true, 
      products,
      count: products.length
    });
  } catch (error) {
    console.error('getAllProducts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Find UserInventory entries for this product with quantity > 0
    const inventories = await UserInventory.find({
      product: product._id,
      quantity: { $gt: 0 }
    });

    const userIds = inventories.map(inv => inv.user);

    // Find kitchens whose admins have this product
    const kitchens = await Kitchen.find({
      admin: { $in: userIds }
    }).select('name location manager status admin');

    // Also attach stock quantity to each kitchen for frontend info
    const kitchensWithStock = kitchens.map(k => {
      const inv = inventories.find(i => i.user && k.admin && i.user.toString() === k.admin.toString());
      return {
        ...k.toObject(),
        availableQuantity: inv ? inv.quantity : 0
      };
    });

    res.json({ success: true, product, kitchens: kitchensWithStock });
  } catch (error) {
    console.error('getProductById error:', error);
    res.status(500).json({ message: error.message });
  }
};
export const createProduct = async (req, res) => {
  try {
    let productData = { ...req.body };
    
    // Handle image uploads
    if (req.files) {
      const imageUploads = [];
      
      // Upload thumbnail
      if (req.files.thumbnail) {
        const result = await uploadToCloudinary(req.files.thumbnail[0].buffer, 'products/thumbnails');
        productData.thumbnail = result.secure_url;
      }
      
      // Upload multiple images
      if (req.files.images) {
        for (const file of req.files.images) {
          const result = await uploadToCloudinary(file.buffer, 'products/images');
          imageUploads.push(result.secure_url);
        }
        productData.images = imageUploads;
      }
    }
    
    const product = await Product.create(productData);
    
    // Clear cache after creating product
    const { clearCache } = await import('../middleware/cache.js');
    clearCache('products');
    
    res.status(201).json({ success: true, product });
  } catch (error) {
    console.error('Create product error:', error);
    if (error.name === 'ValidationError' || error.code === 11000) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Failed to create product' });
  }
};

export const updateProduct = async (req, res) => {
  try {
    let updateData = { ...req.body };
    
    // Handle image uploads
    if (req.files) {
      // Upload new thumbnail
      if (req.files.thumbnail) {
        const result = await uploadToCloudinary(req.files.thumbnail[0].buffer, 'products/thumbnails');
        updateData.thumbnail = result.secure_url;
      }
      
      // Upload new images
      if (req.files.images) {
        const imageUploads = [];
        for (const file of req.files.images) {
          const result = await uploadToCloudinary(file.buffer, 'products/images');
          imageUploads.push(result.secure_url);
        }
        updateData.images = imageUploads;
      }
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Clear cache after updating
    const { clearCache } = await import('../middleware/cache.js');
    clearCache('products');

    res.json({ success: true, product });
  } catch (error) {
    console.error('Update product error:', error);
    if (error.name === 'ValidationError' || error.code === 11000) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Failed to update product' });
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

    const recipient = await User.findById(finalToUserId);
    if (!recipient) return res.status(404).json({ message: 'Recipient not found' });
    if (recipient.role !== 'kitchen_admin') {
      return res.status(403).json({ message: 'Stock can only be assigned to Kitchen Admins' });
    }

    // If sender is super_admin, admin, or billing_admin, check global product stock
    if (req.user.role === 'super_admin' || req.user.role === 'admin' || req.user.role === 'billing_admin') {
      if (product.quantity < quantity) {
        return res.status(400).json({ message: 'Insufficient stock in main inventory' });
      }
      product.quantity -= Number(quantity);
      await product.save();
    } else {
      // Check sender's specific inventory (e.g. for sub-admins if needed)
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
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { role, _id: userId } = req.user;

    // For super_admin, show global inventory
    if (role === 'super_admin') {
      const products = await Product.find({})
        .select('name category unit price quantity status minStock thumbnail')
        .lean();

      const inventory = products.map(p => ({
        _id: p._id,
        product: p,
        quantity: p.quantity,
        user: userId
      }));
      return res.json({ success: true, inventory });
    }

    // For kitchen or billing admins, fetch from UserInventory of the Kitchen Admin
    if (role === 'kitchen_admin' || role === 'billing_admin') {
      const kitchen = await Kitchen.findOne({
        $or: [{ admin: userId }, { billingAdmin: userId }]
      });

      if (kitchen && kitchen.admin) {
        // Fetch inventory for the KITCHEN ADMIN (who holds the stock)
        const populatedInventory = await UserInventory.find({ user: kitchen.admin })
          .populate({
            path: 'product',
            select: 'name category unit price quantity status minStock thumbnail'
          })
          .lean()
          .sort({ updatedAt: -1 });

        const validInventory = populatedInventory
          .filter(item => item.product !== null)
          .map(item => {
            return {
              _id: item._id,
              product: item.product,
              quantity: item.quantity,
              user: kitchen.admin
            };
          });

        return res.json({ success: true, inventory: validInventory });
      } else if (role === 'kitchen_admin') {
        // Fallback for kitchen_admin without a kitchen (improbable but safe)
        // Just let it fall through to default UserInventory fetch
      }
    }

    // Default: fetch from UserInventory
    const populatedInventory = await UserInventory.find({ user: userId })
      .populate({
        path: 'product',
        select: 'name category unit price quantity status minStock thumbnail'
      })
      .lean()
      .sort({ updatedAt: -1 });

    const validInventory = populatedInventory
      .filter(item => item.product !== null)
      .map(item => {
        return {
          _id: item._id,
          product: item.product,
          quantity: item.quantity,
          user: userId
        };
      });

    return res.json({ success: true, inventory: validInventory });

  } catch (error) {
    console.error('getUserInventory error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTransferHistory = async (req, res) => {
  try {
    let query = {};
    const { role, _id: userId } = req.user;

    if (role === 'super_admin' || role === 'admin') {
      query = {};
    } else if (role === 'kitchen_admin' || role === 'billing_admin') {
      // Find the kitchen for this user
      const kitchen = await Kitchen.findOne({
        $or: [{ admin: userId }, { billingAdmin: userId }]
      });

      if (!kitchen) {
        // If not associated with any kitchen, return empty or self-transfers
        query = { $or: [{ fromUser: userId }, { toUser: userId }] };
      } else {
        // Include transfers to/from the kitchen admin AND billing admin
        const userIds = [];
        if (kitchen.admin) userIds.push(kitchen.admin);
        if (kitchen.billingAdmin) userIds.push(kitchen.billingAdmin);

        // Ensure we search by ID value
        query = {
          $or: [
            { toUser: { $in: userIds } },
            { fromUser: { $in: userIds } }
          ]
        };
      }
    } else {
      query = { $or: [{ fromUser: userId }, { toUser: userId }] };
    }

    const transfers = await StockTransfer.find(query)
      .populate('fromUser', 'email role')
      .populate('toUser', 'email role')
      .populate('product', 'name unit')
      .sort({ createdAt: -1 });

    console.log(`Fetched ${transfers.length} transfers for role: ${role}`);
    res.json({ success: true, transfers });
  } catch (error) {
    console.error('getTransferHistory error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getStockLogs = async (req, res) => {
  try {
    console.log('getStockLogs called by user:', req.user?._id, 'role:', req.user?.role);

    const logs = await StockLog.find()
      .populate({
        path: 'product',
        select: 'name category unit'
      })
      .populate({
        path: 'user',
        select: 'username email role'
      })
      .lean()
      .sort({ createdAt: -1 })
      .limit(100);

    // Filter out logs where product or user was deleted
    const validLogs = logs.map(log => ({
      ...log,
      product: log.product || { name: 'Deleted Product', category: 'N/A', unit: 'N/A' },
      user: log.user || { username: 'System', email: 'system@auto', role: 'system' }
    }));

    console.log(`Returning ${validLogs.length} stock logs`);
    res.json({ success: true, logs: validLogs });
  } catch (error) {
    console.error('getStockLogs error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: error.message, error: error.toString() });
  }
};

export const deleteStockLog = async (req, res) => {
  try {
    const log = await StockLog.findByIdAndDelete(req.params.id);
    if (!log) {
      return res.status(404).json({ message: 'Stock log not found' });
    }
    res.json({ success: true, message: 'Stock log deleted successfully' });
  } catch (error) {
    console.error('deleteStockLog error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getAvailableProducts = async (req, res) => {
  try {
    const products = await Product.find({
      inStock: true,
      quantity: { $gt: 0 }
    })
    .select('name shortName description category foodType price discountPrice images thumbnail tags inStock quantity status')
    .sort({ category: 1, name: 1 })
    .lean()
    .maxTimeMS(3000);

    res.json({ 
      success: true, 
      products,
      count: products.length 
    });
  } catch (error) {
    console.error('getAvailableProducts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch available products' });
  }
};