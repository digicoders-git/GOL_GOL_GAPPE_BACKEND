import Offer from '../models/Offer.js';

export const getAllOffers = async (req, res) => {
  try {
    const offers = await Offer.find().sort({ createdAt: -1 });
    res.json({ success: true, offers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getActiveOffers = async (req, res) => {
  try {
    const offers = await Offer.find({ 
      isActive: true,
      expiryDate: { $gte: new Date() },
      $expr: { $lt: ['$usedCount', '$maxUses'] }
    }).sort({ createdAt: -1 });
    res.json({ success: true, offers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const validateOffer = async (req, res) => {
  try {
    const { code, orderAmount, productId } = req.body;
    const offer = await Offer.findOne({ code: code.toUpperCase() }).populate('applicableProducts');

    if (!offer) return res.status(404).json({ message: 'Invalid offer code' });
    if (!offer.isActive) return res.status(400).json({ message: 'Offer is inactive' });
    if (offer.expiryDate < new Date()) return res.status(400).json({ message: 'Offer expired' });
    if (offer.usedCount >= offer.maxUses) return res.status(400).json({ message: 'Offer limit reached' });
    if (orderAmount < offer.minOrderAmount) return res.status(400).json({ message: `Minimum order amount is ₹${offer.minOrderAmount}` });

    // Check if offer is applicable to the product
    let productDetails = null;
    if (offer.applicableProducts.length > 0 && productId) {
      const applicableProduct = offer.applicableProducts.find(p => p._id.toString() === productId.toString());
      if (!applicableProduct) {
        return res.status(400).json({ message: 'Offer not applicable to this product' });
      }
      productDetails = {
        id: applicableProduct._id,
        name: applicableProduct.name,
        basePrice: applicableProduct.price
      };
    }

    // Calculate discount
    const discount = offer.discountType === 'percentage'
      ? (orderAmount * offer.discountValue) / 100
      : offer.discountValue;

    const finalAmount = Math.max(0, orderAmount - Math.round(discount));

    res.json({ 
      success: true, 
      offer: {
        code: offer.code,
        title: offer.title,
        discountType: offer.discountType,
        discountValue: offer.discountValue,
        discount: Math.round(discount)
      },
      priceBreakdown: {
        basePrice: orderAmount,
        discountPercent: offer.discountType === 'percentage' ? offer.discountValue : null,
        discountAmount: Math.round(discount),
        finalPrice: finalAmount,
        savings: Math.round(discount)
      },
      product: productDetails
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const applyOffer = async (req, res) => {
  try {
    const { code, orderAmount, productId } = req.body;
    const offer = await Offer.findOne({ code: code.toUpperCase() }).populate('applicableProducts');

    if (!offer) return res.status(404).json({ message: 'Invalid offer code' });
    
    // Get product details if productId provided
    let productDetails = null;
    if (productId && offer.applicableProducts.length > 0) {
      const product = offer.applicableProducts.find(p => p._id.toString() === productId.toString());
      if (product) {
        productDetails = {
          id: product._id,
          name: product.name,
          basePrice: product.price
        };
      }
    }

    // Calculate discount
    const discount = offer.discountType === 'percentage'
      ? (orderAmount * offer.discountValue) / 100
      : offer.discountValue;

    const finalAmount = Math.max(0, orderAmount - Math.round(discount));

    offer.usedCount += 1;
    await offer.save();

    res.json({ 
      success: true, 
      message: 'Offer applied successfully',
      offer: {
        code: offer.code,
        title: offer.title,
        discountType: offer.discountType,
        discountValue: offer.discountValue
      },
      priceBreakdown: {
        basePrice: orderAmount,
        discountPercent: offer.discountType === 'percentage' ? offer.discountValue : null,
        discountAmount: Math.round(discount),
        finalPrice: finalAmount,
        savings: Math.round(discount)
      },
      product: productDetails
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createOffer = async (req, res) => {
  try {
    const offer = await Offer.create(req.body);
    res.status(201).json({ success: true, offer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateOffer = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    res.json({ success: true, offer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    res.json({ success: true, message: 'Offer deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
