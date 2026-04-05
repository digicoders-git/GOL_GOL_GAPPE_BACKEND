import Kitchen from '../models/Kitchen.js';
import UserInventory from '../models/UserInventory.js';
import Order from '../models/Order.js';
import Billing from '../models/Billing.js';

export const getKitchenInventory = async (req, res) => {
  try {
    const kitchen = await Kitchen.findById(req.params.id)
      .populate('assignedProducts.product', 'name unit category thumbnail price quantity');
    
    if (!kitchen) {
      return res.status(404).json({ message: 'Kitchen not found' });
    }

    const inventory = kitchen.assignedProducts || [];

    res.json({ success: true, inventory });
  } catch (error) {
    console.error('getKitchenInventory error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getAllKitchens = async (req, res) => {
  try {
    let kitchens = await Kitchen.find()
      .populate('admin', 'name email')
      .populate('billingAdmin', 'name email')
      .populate('assignedProducts.product', 'name unit category thumbnail price quantity')
      .sort({ createdAt: -1 });

    const formattedKitchens = await Promise.all(kitchens.map(async (k) => {
      let kitchenObj = k.toObject();
      
      // MIGRATION: Convert old quantity format to new assigned/used format
      const needsMigration = k.assignedProducts.some(ap => 
        ap.quantity !== undefined && (ap.assigned === undefined || ap.used === undefined)
      );

      if (needsMigration) {
        console.log(`Migrating kitchen: ${k.name}`);
        k.assignedProducts = k.assignedProducts.map(ap => ({
          product: ap.product,
          assigned: ap.quantity || ap.assigned || 0,
          used: ap.used || 0
        }));
        await k.save();
        kitchenObj = k.toObject();
      }

      // AUTO-HEALING: If assignedProducts is empty but admin has stock, sync it
      if (k.admin && (k.assignedProducts.length === 0)) {
        console.log(`Auto-healing stock for kitchen: ${k.name}`);
        const userStock = await UserInventory.find({ user: k.admin._id });
        
        if (userStock.length > 0) {
          k.assignedProducts = userStock.map(inv => ({
            product: inv.product,
            assigned: inv.quantity,
            used: 0
          }));
          await k.save();
          await k.populate('assignedProducts.product', 'name unit category thumbnail price quantity');
          return { ...k.toObject(), id: k._id };
        }
      }

      return {
        ...kitchenObj,
        id: k._id,
        _id: k._id
      };
    }));

    res.json({ success: true, kitchens: formattedKitchens });
  } catch (error) {
    console.error('getAllKitchens error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createKitchen = async (req, res) => {
  try {
    const { billingAdmin } = req.body;
    
    // Check if billing admin is already assigned to another kitchen
    const existingKitchen = await Kitchen.findOne({ billingAdmin });
    if (existingKitchen) {
      return res.status(400).json({ 
        message: 'This billing admin is already assigned to another kitchen' 
      });
    }
    
    const kitchen = await Kitchen.create(req.body);
    res.status(201).json({ success: true, kitchen });
  } catch (error) {
    console.error('createKitchen error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateKitchen = async (req, res) => {
  try {
    const { billingAdmin } = req.body;
    
    // Check if billing admin is already assigned to another kitchen
    if (billingAdmin) {
      const existingKitchen = await Kitchen.findOne({ 
        billingAdmin, 
        _id: { $ne: req.params.id } 
      });
      if (existingKitchen) {
        return res.status(400).json({ 
          message: 'This billing admin is already assigned to another kitchen' 
        });
      }
    }
    
    const kitchen = await Kitchen.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('assignedProducts.product', 'name unit quantity');

    if (!kitchen) {
      return res.status(404).json({ message: 'Kitchen not found' });
    }

    res.json({ success: true, kitchen });
  } catch (error) {
    console.error('updateKitchen error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const assignProduct = async (req, res) => {
  try {
    const { kitchenId, productId, quantity } = req.body;

    const kitchen = await Kitchen.findById(kitchenId);
    if (!kitchen) {
      return res.status(404).json({ message: 'Kitchen not found' });
    }

    const existingAssignment = kitchen.assignedProducts.find(
      ap => ap.product.toString() === productId
    );

    if (existingAssignment) {
      existingAssignment.assigned = quantity;
    } else {
      kitchen.assignedProducts.push({ 
        product: productId, 
        assigned: quantity,
        used: 0
      });
    }

    await kitchen.save();
    await kitchen.populate('assignedProducts.product', 'name unit quantity');

    const io = req.app.get('io');
    if (io) {
      io.to(`kitchen-${kitchenId}`).emit('kitchen-stock-updated', {
        kitchenId,
        inventory: kitchen.assignedProducts,
        timestamp: new Date()
      });
      io.to('admin-panel').emit('stock-updated', {
        kitchenId,
        timestamp: new Date()
      });
    }

    res.json({ success: true, kitchen });
  } catch (error) {
    console.error('assignProduct error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateKitchenStock = async (req, res) => {
  try {
    const { kitchenId, productId, quantityUsed } = req.body;

    const kitchen = await Kitchen.findById(kitchenId);
    if (!kitchen) {
      return res.status(404).json({ message: 'Kitchen not found' });
    }

    const assignment = kitchen.assignedProducts.find(
      ap => ap.product.toString() === productId
    );

    if (!assignment) {
      return res.status(404).json({ message: 'Product not assigned to this kitchen' });
    }

    assignment.used = (assignment.used || 0) + quantityUsed;
    if (assignment.used > assignment.assigned) {
      assignment.used = assignment.assigned;
    }

    await kitchen.save();
    await kitchen.populate('assignedProducts.product', 'name unit quantity');

    // Emit stock update event
    const io = req.app.get('io');
    if (io) {
      io.to(`kitchen-${kitchenId}`).emit('kitchen-stock-updated', {
        kitchenId,
        productId,
        newUsed: assignment.used,
        newRemaining: assignment.assigned - assignment.used,
        timestamp: new Date()
      });
    }

    res.json({ success: true, kitchen });
  } catch (error) {
    console.error('updateKitchenStock error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteKitchen = async (req, res) => {
  try {
    const kitchen = await Kitchen.findByIdAndDelete(req.params.id);
    if (!kitchen) {
      return res.status(404).json({ message: 'Kitchen not found' });
    }
    res.json({ success: true, message: 'Kitchen deleted successfully' });
  } catch (error) {
    console.error('deleteKitchen error:', error);
    res.status(500).json({ message: error.message });
  }
};
