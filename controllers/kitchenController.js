import Kitchen from '../models/Kitchen.js';
import UserInventory from '../models/UserInventory.js';

export const getKitchenInventory = async (req, res) => {
  try {
    const kitchen = await Kitchen.findById(req.params.id);
    if (!kitchen) {
      return res.status(404).json({ message: 'Kitchen not found' });
    }

    if (!kitchen.admin) {
      return res.json({ success: true, inventory: [], message: 'No administrator assigned to this kitchen' });
    }

    const inventory = await UserInventory.find({ user: kitchen.admin })
      .populate('product', 'name unit category thumbnail price')
      .sort({ updatedAt: -1 });

    res.json({ success: true, inventory });
  } catch (error) {
    console.error('getKitchenInventory error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getAllKitchens = async (req, res) => {
  try {
    const kitchens = await Kitchen.find()
      .populate('assignedProducts.product', 'name unit')
      .sort({ createdAt: -1 });
    res.json({ success: true, kitchens });
  } catch (error) {
    console.error('getAllKitchens error:', error);
    res.status(500).json({ message: error.message });
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
    ).populate('assignedProducts.product', 'name unit');

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
      existingAssignment.quantity = quantity;
    } else {
      kitchen.assignedProducts.push({ product: productId, quantity });
    }

    await kitchen.save();
    await kitchen.populate('assignedProducts.product', 'name unit');

    res.json({ success: true, kitchen });
  } catch (error) {
    console.error('assignProduct error:', error);
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