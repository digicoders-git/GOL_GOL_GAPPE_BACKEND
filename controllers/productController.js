import Product from '../models/Product.js';
import StockLog from '../models/StockLog.js';
import UserInventory from '../models/UserInventory.js';
import StockTransfer from '../models/StockTransfer.js';
import Kitchen from '../models/Kitchen.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import { clearCache } from '../middleware/cache.js';
import { saveBase64Locally } from '../middleware/localUpload.js';

export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate({
        path: 'activeOffer',
        match: { 
          isActive: true, 
          expiryDate: { $gte: new Date() },
          $expr: { $lt: ['$usedCount', '$maxUses'] }
        },
        select: 'code title discountType discountValue offerType minOrderAmount expiryDate'
      })
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
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
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
    res.status(500).json({ success: false, message: error.message });
  }
};
export const createProduct = async (req, res) => {
  try {
    // console.log('=== CREATE PRODUCT REQUEST ===');
    // console.log('Request body:', JSON.stringify(req.body, null, 2));
    // console.log('Request files:', req.files);
    // console.log('User:', req.user?._id, req.user?.role);

    let productData = { ...req.body };

    // Handle base64 thumbnail upload
    if (productData.thumbnail && productData.thumbnail.startsWith('data:image')) {
      try {
        const result = await saveBase64Locally(productData.thumbnail, 'thumbnails');
        productData.thumbnail = result.secure_url;
      } catch (uploadError) {
        return res.status(500).json({ success: false, message: 'Failed to save thumbnail', error: uploadError.message });
      }
    }

    // Handle base64 images array upload
    if (productData.images && Array.isArray(productData.images)) {
      const imageUploads = [];
      for (const image of productData.images) {
        if (image.startsWith('data:image')) {
          try {
            const result = await saveBase64Locally(image, 'images');
            imageUploads.push(result.secure_url);
          } catch (uploadError) {
            return res.status(500).json({ success: false, message: 'Failed to save image', error: uploadError.message });
          }
        } else {
          imageUploads.push(image);
        }
      }
      productData.images = imageUploads;
    }

    // console.log('Final product data before saving:', JSON.stringify(productData, null, 2));

    const product = await Product.create(productData);
    // console.log('Product created successfully:', product._id);

    // Clear cache after creating product
    try {
      const { clearCache } = await import('../middleware/cache.js');
      clearCache('products');
    } catch (cacheError) {
      // console.log('Cache clear failed, but continuing:', cacheError.message);
    }

    res.status(201).json({ success: true, product });
  } catch (error) {
    console.error('=== CREATE PRODUCT ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    if (error.name === 'ValidationError') {
      console.error('Validation errors:', error.errors);
      const validationErrors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry found',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    // console.log('Updating product with data:', req.body);
    // console.log('Files received:', req.files);

    let updateData = { ...req.body };

    // Handle base64 thumbnail upload
    if (updateData.thumbnail && updateData.thumbnail.startsWith('data:image')) {
      try {
        const result = await saveBase64Locally(updateData.thumbnail, 'thumbnails');
        updateData.thumbnail = result.secure_url;
      } catch (uploadError) {
        return res.status(500).json({ success: false, message: 'Failed to save thumbnail', error: uploadError.message });
      }
    }

    // Handle base64 images array upload
    if (updateData.images && Array.isArray(updateData.images)) {
      const imageUploads = [];
      for (const image of updateData.images) {
        if (image.startsWith('data:image')) {
          try {
            const result = await saveBase64Locally(image, 'images');
            imageUploads.push(result.secure_url);
          } catch (uploadError) {
            return res.status(500).json({ success: false, message: 'Failed to save image', error: uploadError.message });
          }
        } else {
          imageUploads.push(image);
        }
      }
      updateData.images = imageUploads;
    }

    // console.log('Final update data before saving:', updateData);
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Clear cache after updating
    try {
      const { clearCache } = await import('../middleware/cache.js');
      clearCache('products');
    } catch (cacheError) {
      // console.log('Cache clear failed, but continuing:', cacheError.message);
    }

    res.json({ success: true, product });
  } catch (error) {
    console.error('Update product error:', error);
    if (error.name === 'ValidationError' || error.code === 11000) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Failed to update product', error: error.message });
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
    console.error('deleteProduct error:', error);
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
    console.error('addQuantity error:', error);
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

    // Try to find recipient in Admin collection first (kitchen_admin is there)
    let recipient = await Admin.findById(finalToUserId);

    // If not found in Admin, try User collection
    if (!recipient) {
      recipient = await User.findById(finalToUserId);
    }

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

    // Increase recipient's stock in UserInventory (Legacy)
    let toInv = await UserInventory.findOne({ user: finalToUserId, product: finalProductId });
    if (!toInv) {
      toInv = new UserInventory({ user: finalToUserId, product: finalProductId, quantity: 0 });
    }
    toInv.quantity += Number(quantity);
    await toInv.save();

    // SYNC WITH KITCHEN MODEL (Modern)
    const kitchen = await Kitchen.findOne({
      $or: [{ admin: finalToUserId }, { billingAdmin: finalToUserId }]
    });

    if (kitchen) {
      const existingAssignment = kitchen.assignedProducts.find(
        ap => ap.product.toString() === finalProductId.toString()
      );

      if (existingAssignment) {
        existingAssignment.assigned += Number(quantity);
      } else {
        kitchen.assignedProducts.push({
          product: finalProductId,
          assigned: Number(quantity),
          used: 0
        });
      }
      await kitchen.save();
      // console.log(`Kitchen stock updated for ${kitchen.name}: +${quantity} units assigned`);
    }

    // Log the transfer
    await StockTransfer.create({
      fromUser: fromUserId,
      fromUserModel: 'Admin', // Since super_admin/billing_admin are in Admin collection
      toUser: finalToUserId,
      toUserModel: 'Admin', // Kitchen admins are in Admin collection
      product: finalProductId,
      quantity,
      notes
    });

    // Notify all panels via WebSockets
    const io = req.app.get('io');
    if (io) {
      io.to('admin-panel').emit('stock-updated', { timestamp: new Date() });
      if (kitchen) {
        const updatedK = await Kitchen.findById(kitchen._id)
          .populate('assignedProducts.product', 'name unit quantity');
        io.to(`kitchen-${kitchen._id}`).emit('kitchen-stock-updated', {
          kitchenId: kitchen._id,
          inventory: updatedK.assignedProducts,
          timestamp: new Date()
        });
      }
    }

    // Clear available products cache since kitchen stock changed
    clearCache('available-products');

    // console.log('Stock transferred successfully');
    res.json({ success: true, message: 'Stock transferred successfully' });
  } catch (error) {
    console.error('transferStock error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getUserInventory = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { role, _id: userId } = req.user;
    const { view } = req.query;

    // For super_admin/admin, allow switching between Warehouse and Total Kitchen Stock
    if (role === 'super_admin' || role === 'admin') {
      if (view === 'kitchen') {
        const kitchens = await Kitchen.find({}).populate({
          path: 'assignedProducts.product',
          select: 'name category unit price quantity status minStock thumbnail'
        });

        // Aggregate stock across all kitchens
        const aggregateMap = {};
        kitchens.forEach(k => {
          k.assignedProducts.forEach(item => {
            if (item.product) {
              const pid = item.product._id.toString();
              if (!aggregateMap[pid]) {
                aggregateMap[pid] = {
                  _id: item._id,
                  product: item.product,
                  assigned: 0,
                  used: 0,
                  user: userId,
                  isAggregate: true
                };
              }
              aggregateMap[pid].assigned += Number(item.assigned || 0);
              aggregateMap[pid].used += Number(item.used || 0);
            }
          });
        });

        const inventory = Object.values(aggregateMap).map(item => {
          const remaining = item.assigned - item.used;
          const minStock = item.product.minStock || 10;
          
          // Calculate status based on remaining quantity
          let status = 'Out of Stock';
          if (remaining > minStock) {
            status = 'In Stock';
          } else if (remaining > 0) {
            status = 'Low Stock';
          }
          
          return {
            ...item,
            product: {
              ...item.product,
              status // Add calculated status
            },
            remaining,
            status // Add status at inventory level too
          };
        });
        // console.log(`Aggregate Kitchen inventory fetched: ${inventory.length} products total.`);
        return res.json({ success: true, inventory });
      } else {
        // Warehouse View (Default)
        const products = await Product.find({})
          .select('name category unit price quantity status minStock thumbnail')
          .lean();

        const inventory = products.map(p => {
          const quantity = p.quantity || 0;
          const minStock = p.minStock || 10;
          
          // Calculate status based on quantity
          let status = 'Out of Stock';
          if (quantity > minStock) {
            status = 'In Stock';
          } else if (quantity > 0) {
            status = 'Low Stock';
          }
          
          return {
            _id: p._id,
            product: {
              ...p,
              status // Override with calculated status
            },
            quantity,
            status, // Add status at inventory level too
            user: userId,
            isWarehouse: true
          };
        });
        return res.json({ success: true, inventory });
      }
    }

    // For kitchen or billing admins, fetch from their assigned Kitchen's inventory
    if (role === 'kitchen_admin' || role === 'billing_admin') {
      const kitchen = await Kitchen.findOne({
        $or: [{ admin: userId }, { billingAdmin: userId }]
      }).populate({
        path: 'assignedProducts.product',
        select: 'name category unit price quantity status minStock thumbnail'
      });

      if (kitchen) {
        // console.log('Kitchen found:', kitchen.name);
        // console.log('Assigned products:', JSON.stringify(kitchen.assignedProducts, null, 2));
        
        // Filter out items where product population failed (e.g., product deleted)
        const validProducts = (kitchen.assignedProducts || []).filter(item => {
          if (!item.product) {
            // console.log('Product is null for item:', item._id);
            return false;
          }
          if (!item.product.name) {
            // console.log('Product name is missing for product:', item.product._id);
          }
          return true;
        });

        const inventory = validProducts.map(item => {
          const remaining = (item.assigned || 0) - (item.used || 0);
          const minStock = item.product.minStock || 10;
          
          // Calculate status based on remaining quantity
          let status = 'Out of Stock';
          if (remaining > minStock) {
            status = 'In Stock';
          } else if (remaining > 0) {
            status = 'Low Stock';
          }
          
          return {
            _id: item._id,
            product: {
              _id: item.product._id,
              name: item.product.name || 'Unknown Product',
              category: item.product.category || 'General',
              unit: item.product.unit || 'Units',
              price: item.product.price || 0,
              quantity: item.product.quantity || 0,
              minStock: item.product.minStock || 10,
              thumbnail: item.product.thumbnail || null,
              status
            },
            assigned: item.assigned || 0,
            used: item.used || 0,
            remaining,
            status,
            user: userId,
            kitchenName: kitchen.name
          };
        });

        // console.log(`Inventory fetched from Kitchen: ${kitchen.name} for user: ${userId} (${validProducts.length} items)`);
        return res.json({ success: true, inventory });
      } else {
        // console.log('No kitchen found for user:', userId);
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
        const quantity = item.quantity || 0;
        const minStock = item.product.minStock || 10;
        
        // Calculate status based on quantity
        let status = 'Out of Stock';
        if (quantity > minStock) {
          status = 'In Stock';
        } else if (quantity > 0) {
          status = 'Low Stock';
        }
        
        return {
          _id: item._id,
          product: {
            ...item.product,
            status // Add calculated status
          },
          quantity,
          status, // Add status at inventory level too
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

    // Use refPath for dynamic population
    const transfers = await StockTransfer.find(query)
      .populate('fromUser', 'email role name')
      .populate('toUser', 'email role name')
      .populate('product', 'name unit quantity minStock status')
      .sort({ createdAt: -1 })
      .lean();

    // Add calculated status if product exists
    const transfersWithStatus = transfers.map(transfer => {
      if (transfer.product) {
        const quantity = transfer.product.quantity || 0;
        const minStock = transfer.product.minStock || 10;
        
        let status = 'Out of Stock';
        if (quantity > minStock) {
          status = 'In Stock';
        } else if (quantity > 0) {
          status = 'Low Stock';
        }
        
        return {
          ...transfer,
          product: {
            ...transfer.product,
            status
          }
        };
      }
      return transfer;
    });

    // console.log(`Fetched ${transfersWithStatus.length} transfers for role: ${role}`);
    res.json({ success: true, transfers: transfersWithStatus });
  } catch (error) {
    console.error('getTransferHistory error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStockLogs = async (req, res) => {
  try {
    // console.log('getStockLogs called by user:', req.user?._id, 'role:', req.user?.role);

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

    // console.log(`Returning ${validLogs.length} stock logs`);
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

export const uploadImage = async (req, res) => {
  try {
    const { image, folder = 'products' } = req.body;

    if (!image || !image.startsWith('data:image')) {
      return res.status(400).json({ success: false, message: 'Valid base64 image required' });
    }

    // console.log('Uploading image to Cloudinary folder:', folder);

    const result = await saveBase64Locally(image, folder);

    res.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
};

export const getAvailableProducts = async (req, res) => {
  try {
    // Get all kitchens with their assigned products
    const kitchens = await Kitchen.find({})
      .populate({
        path: 'assignedProducts.product',
        select: 'name shortName description category foodType price discountPrice images thumbnail tags unit minStock',
        populate: {
          path: 'activeOffer',
          match: { 
            isActive: true, 
            expiryDate: { $gte: new Date() },
            $expr: { $lt: ['$usedCount', '$maxUses'] }
          },
          select: 'code title discountType discountValue offerType minOrderAmount expiryDate'
        }
      })
      .lean();

    // Aggregate products across all kitchens
    const productMap = {};
    
    kitchens.forEach(kitchen => {
      kitchen.assignedProducts.forEach(item => {
        if (item.product) {
          const remaining = (item.assigned || 0) - (item.used || 0);
          
          // Only include products with available stock
          if (remaining > 0) {
            const productId = item.product._id.toString();
            
            if (!productMap[productId]) {
              productMap[productId] = {
                ...item.product,
                quantity: 0,
                inStock: true
              };
            }
            
            // Aggregate quantity across all kitchens
            productMap[productId].quantity += remaining;
          }
        }
      });
    });

    // Calculate proper status based on quantity and minStock
    const products = Object.values(productMap).map(product => {
      const quantity = product.quantity || 0;
      const minStock = product.minStock || 10;
      
      let status = 'Out of Stock';
      let inStock = false;
      
      if (quantity > minStock) {
        status = 'In Stock';
        inStock = true;
      } else if (quantity > 0) {
        status = 'Low Stock';
        inStock = true;
      }
      
      return {
        ...product,
        status,
        inStock
      };
    }).sort((a, b) => {
      if (a.category < b.category) return -1;
      if (a.category > b.category) return 1;
      return a.name.localeCompare(b.name);
    });

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
