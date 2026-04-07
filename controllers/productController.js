import Product from '../models/Product.js';
import StockLog from '../models/StockLog.js';
import UserInventory from '../models/UserInventory.js';
import StockTransfer from '../models/StockTransfer.js';
import Kitchen from '../models/Kitchen.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import Offer from '../models/Offer.js';
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
    const product = await Product.findById(req.params.id)
      .populate({
        path: 'activeOffer',
        match: { 
          isActive: true, 
          expiryDate: { $gte: new Date() },
          $expr: { $lt: ['$usedCount', '$maxUses'] }
        },
        select: 'code title discountType discountValue offerType minOrderAmount expiryDate'
      })
      .lean();
      
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Find all kitchens that have this product assigned
    const kitchens = await Kitchen.find({
      'assignedProducts.product': product._id
    }).select('name location manager status admin assignedProducts').lean();

    // Calculate available quantity for each kitchen
    const kitchensWithStock = kitchens.map(kitchen => {
      const assignment = kitchen.assignedProducts.find(
        ap => ap.product.toString() === product._id.toString()
      );
      
      const assigned = assignment?.assigned || 0;
      const used = assignment?.used || 0;
      const availableQuantity = assigned - used;
      
      return {
        _id: kitchen._id,
        name: kitchen.name,
        location: kitchen.location,
        manager: kitchen.manager,
        status: kitchen.status,
        admin: kitchen.admin,
        availableQuantity
      };
    }).filter(k => k.availableQuantity > 0);

    res.json({ success: true, product, kitchens: kitchensWithStock });
  } catch (error) {
    console.error('getProductById error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createProduct = async (req, res) => {
  try {
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

    const product = await Product.create(productData);

    // Clear cache after creating product
    try {
      const { clearCache } = await import('../middleware/cache.js');
      clearCache('products');
    } catch (cacheError) {
      // continue
    }

    res.status(201).json({ success: true, product });
  } catch (error) {
    console.error('=== CREATE PRODUCT ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);

    if (error.name === 'ValidationError') {
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
      error: error.message
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
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
      // continue
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
    const productId = req.params.id;
    
    // Step 1: Sab kitchens se ye product remove karo
    await Kitchen.updateMany(
      {},
      { $pull: { assignedProducts: { product: productId } } }
    );
    
    // Step 2: Sab UserInventory entries remove karo
    await UserInventory.deleteMany({ product: productId });
    
    // Step 3: Sab StockTransfer records remove karo
    await StockTransfer.deleteMany({ product: productId });
    
    // Step 4: Sab StockLog entries remove karo
    await StockLog.deleteMany({ product: productId });
    
    // Step 5: Finally product delete karo
    const product = await Product.findByIdAndDelete(productId);
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

      if (product.quantity > product.minStock) {
        product.status = 'In Stock';
      } else if (product.quantity > 0) {
        product.status = 'Low Stock';
      } else {
        product.status = 'Out of Stock';
      }

      await product.save();

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
      product = await Product.create({
        name: productName,
        category,
        quantity: Number(quantity),
        unit,
        status: Number(quantity) > 10 ? 'In Stock' : 'Low Stock'
      });

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

    let recipient = await Admin.findById(finalToUserId);

    if (!recipient) {
      recipient = await User.findById(finalToUserId);
    }

    if (!recipient) return res.status(404).json({ message: 'Recipient not found' });
    if (recipient.role !== 'kitchen_admin') {
      return res.status(403).json({ message: 'Stock can only be assigned to Kitchen Admins' });
    }

    if (req.user.role === 'super_admin' || req.user.role === 'admin' || req.user.role === 'billing_admin') {
      if (product.quantity < quantity) {
        return res.status(400).json({ message: 'Insufficient stock in main inventory' });
      }
      product.quantity -= Number(quantity);
      await product.save();
    } else {
      const fromInv = await UserInventory.findOne({ user: fromUserId, product: finalProductId });
      if (!fromInv || fromInv.quantity < quantity) {
        return res.status(400).json({ message: 'Insufficient stock in your inventory' });
      }
      fromInv.quantity -= Number(quantity);
      await fromInv.save();
    }

    let toInv = await UserInventory.findOne({ user: finalToUserId, product: finalProductId });
    if (!toInv) {
      toInv = new UserInventory({ user: finalToUserId, product: finalProductId, quantity: 0 });
    }
    toInv.quantity += Number(quantity);
    await toInv.save();

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
    }

    await StockTransfer.create({
      fromUser: fromUserId,
      fromUserModel: 'Admin',
      toUser: finalToUserId,
      toUserModel: 'Admin',
      product: finalProductId,
      quantity,
      notes
    });

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

    clearCache('available-products');

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

    if (role === 'super_admin' || role === 'admin') {
      if (view === 'kitchen') {
        const kitchens = await Kitchen.find({}).populate({
          path: 'assignedProducts.product',
          select: 'name category unit price quantity status minStock thumbnail'
        });

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
              status
            },
            remaining,
            status
          };
        });
        return res.json({ success: true, inventory });
      } else {
        const products = await Product.find({})
          .select('name category unit price quantity status minStock thumbnail')
          .lean();

        const inventory = products.map(p => {
          const quantity = p.quantity || 0;
          const minStock = p.minStock || 10;
          
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
              status
            },
            quantity,
            status,
            user: userId,
            isWarehouse: true
          };
        });
        return res.json({ success: true, inventory });
      }
    }

    if (role === 'kitchen_admin' || role === 'billing_admin') {
      const kitchen = await Kitchen.findOne({
        $or: [{ admin: userId }, { billingAdmin: userId }]
      }).populate({
        path: 'assignedProducts.product',
        select: 'name category unit price quantity status minStock thumbnail'
      });

      if (kitchen) {
        const validProducts = (kitchen.assignedProducts || []).filter(item => {
          if (!item.product) {
            return false;
          }
          return true;
        });

        const inventory = validProducts.map(item => {
          const remaining = (item.assigned || 0) - (item.used || 0);
          const minStock = item.product.minStock || 10;
          
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

        return res.json({ success: true, inventory });
      }
    }

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
            status
          },
          quantity,
          status,
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
      const kitchen = await Kitchen.findOne({
        $or: [{ admin: userId }, { billingAdmin: userId }]
      });

      if (!kitchen) {
        query = { $or: [{ fromUser: userId }, { toUser: userId }] };
      } else {
        const userIds = [];
        if (kitchen.admin) userIds.push(kitchen.admin);
        if (kitchen.billingAdmin) userIds.push(kitchen.billingAdmin);

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
      .populate('fromUser', 'email role name')
      .populate('toUser', 'email role name')
      .populate('product', 'name unit quantity minStock status')
      .sort({ createdAt: -1 })
      .lean();

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

    res.json({ success: true, transfers: transfersWithStatus });
  } catch (error) {
    console.error('getTransferHistory error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStockLogs = async (req, res) => {
  try {
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

    const validLogs = logs.map(log => ({
      ...log,
      product: log.product || { name: 'Deleted Product', category: 'N/A', unit: 'N/A' },
      user: log.user || { username: 'System', email: 'system@auto', role: 'system' }
    }));

    res.json({ success: true, logs: validLogs });
  } catch (error) {
    console.error('getStockLogs error:', error);
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
    console.log('=== GET AVAILABLE PRODUCTS ===');
    
    // Get all kitchens with their assigned products
    const kitchens = await Kitchen.find({})
      .populate({
        path: 'assignedProducts.product'
      })
      .lean();

    console.log(`Found ${kitchens.length} kitchens`);

    // Aggregate products across all kitchens
    const productMap = {};
    
    kitchens.forEach(kitchen => {
      console.log(`Kitchen: ${kitchen.name}, Products: ${kitchen.assignedProducts.length}`);
      
      kitchen.assignedProducts.forEach(item => {
        if (item.product && item.product._id) {
          const assigned = item.assigned || 0;
          const used = item.used || 0;
          const remaining = assigned - used;
          
          console.log(`  Product: ${item.product.name}, Assigned: ${assigned}, Used: ${used}, Remaining: ${remaining}`);
          
          if (remaining > 0) {
            const productId = item.product._id.toString();
            
            if (!productMap[productId]) {
              productMap[productId] = {
                ...item.product,
                quantity: 0,
                inStock: true
              };
            }
            
            productMap[productId].quantity += remaining;
            console.log(`    -> Total quantity for ${item.product.name}: ${productMap[productId].quantity}`);
          }
        }
      });
    });

    // Now populate activeOffer for each product
    const productIds = Object.keys(productMap);
    const offersMap = {};
    
    if (productIds.length > 0) {
      const offers = await Offer.find({
        applicableProducts: { $in: productIds },
        isActive: true,
        expiryDate: { $gte: new Date() },
        $expr: { $lt: ['$usedCount', '$maxUses'] }
      }).select('code title discountType discountValue offerType minOrderAmount expiryDate applicableProducts');
      
      console.log(`Found ${offers.length} active offers`);
      
      offers.forEach(offer => {
        offer.applicableProducts.forEach(productId => {
          offersMap[productId.toString()] = {
            code: offer.code,
            title: offer.title,
            discountType: offer.discountType,
            discountValue: offer.discountValue,
            offerType: offer.offerType,
            minOrderAmount: offer.minOrderAmount,
            expiryDate: offer.expiryDate
          };
        });
      });
    }

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
      
      const productId = product._id.toString();
      const activeOffer = offersMap[productId] || null;
      
      if (activeOffer) {
        console.log(`Product: ${product.name} - Has offer: ${activeOffer.code}`);
      }
      
      console.log(`Final: ${product.name} - Quantity: ${quantity}, Status: ${status}, Offer: ${activeOffer ? 'Yes' : 'No'}`);
      
      return {
        ...product,
        status,
        inStock,
        activeOffer
      };
    }).sort((a, b) => {
      if (a.category < b.category) return -1;
      if (a.category > b.category) return 1;
      return a.name.localeCompare(b.name);
    });

    console.log(`Returning ${products.length} products`);
    console.log('=== END ===\n');

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
