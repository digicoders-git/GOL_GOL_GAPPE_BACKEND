import Kitchen from '../models/Kitchen.js';

export const getAllKitchens = async (req, res) => {
  try {
    const kitchens = await Kitchen.find()
      .populate('assignedProducts.product', 'name unit')
      .sort({ createdAt: -1 });
    res.json({ success: true, kitchens });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createKitchen = async (req, res) => {
  try {
    const kitchen = await Kitchen.create(req.body);
    res.status(201).json({ success: true, kitchen });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateKitchen = async (req, res) => {
  try {
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
    res.status(500).json({ message: error.message });
  }
};