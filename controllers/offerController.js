import Offer from '../models/Offer.js';
import Product from '../models/Product.js';

export const getOfferById = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id)
      .populate('applicableProducts', 'name price thumbnail')
      .lean();
    
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    
    // Check if offer is still valid
    const isValid = offer.isActive && 
                    offer.expiryDate >= new Date() && 
                    offer.usedCount < offer.maxUses;
    
    res.json({ 
      success: true, 
      offer: {
        ...offer,
        isValid
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

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
    console.log('=== VALIDATE OFFER ===');
    console.log('Request body:', req.body);
    
    const { code, orderAmount, productId } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: 'Offer code is required' });
    }
    
    let offer = await Offer.findOne({ code: code.toUpperCase() }).populate('applicableProducts');
    console.log('Offer found:', offer ? 'Yes' : 'No');

    if (!offer) return res.status(404).json({ message: 'Invalid offer code' });
    
    // Migration: Set default offerType if not present
    if (!offer.offerType) {
      console.log('Setting offerType for offer:', offer._id);
      offer.offerType = offer.applicableProducts && offer.applicableProducts.length > 0 ? 'product-specific' : 'global';
      await offer.save();
    }
    
    console.log('Offer type:', offer.offerType);
    console.log('Minimum order amount:', offer.minOrderAmount);
    console.log('Current order amount:', orderAmount);
    
    if (!offer.isActive) return res.status(400).json({ message: 'Offer is inactive' });
    if (offer.expiryDate < new Date()) return res.status(400).json({ message: 'Offer expired' });
    if (offer.usedCount >= offer.maxUses) return res.status(400).json({ message: 'Offer limit reached' });
    
    // Check minimum order amount BEFORE applying discount
    if (offer.minOrderAmount > 0 && orderAmount < offer.minOrderAmount) {
      console.log('❌ VALIDATION FAILED: Order amount too low');
      return res.status(400).json({ 
        success: false,
        message: `Your cart total is ₹${orderAmount}. You need to order at least ₹${offer.minOrderAmount} to use this offer.` 
      });
    }
    console.log('✅ Minimum order check passed');

    // For product-specific offers, validate product
    if (offer.offerType === 'product-specific') {
      if (!productId) {
        return res.status(400).json({ message: 'This offer is only valid for specific products' });
      }
      
      const isApplicable = offer.applicableProducts.some(p => p._id.toString() === productId.toString());
      if (!isApplicable) {
        return res.status(400).json({ message: 'This offer is not applicable to the selected product' });
      }
    }

    // Check if customer already used this offer
    if (req.user) {
      const customerId = req.user._id;
      const customerMobile = req.user.mobile;
      const alreadyUsed = offer.usedByCustomers.some(usage => {
        const userIdMatch = customerId && usage.customer && usage.customer.toString() === customerId.toString();
        const mobileMatch = customerMobile && usage.customerMobile === customerMobile;
        return userIdMatch || mobileMatch;
      });

      if (alreadyUsed) {
        return res.status(400).json({ success: false, message: 'You have already used this offer', usedByCurrentUser: true });
      }
    }

    // Get product details if productId provided
    let productDetails = null;
    if (productId && offer.offerType === 'product-specific') {
      const applicableProduct = offer.applicableProducts.find(p => p._id.toString() === productId.toString());
      if (applicableProduct) {
        productDetails = {
          id: applicableProduct._id,
          name: applicableProduct.name,
          basePrice: applicableProduct.price
        };
      }
    }

    // Calculate discount
    const discount = offer.discountType === 'percentage'
      ? (orderAmount * offer.discountValue) / 100
      : offer.discountValue;

    const finalAmount = Math.max(0, orderAmount - Math.round(discount));

    console.log('Validation successful');
    res.json({ 
      success: true, 
      offer: {
        code: offer.code,
        title: offer.title,
        offerType: offer.offerType,
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
    console.error('=== VALIDATE OFFER ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: error.message, error: error.toString() });
  }
};

export const applyOffer = async (req, res) => {
  try {
    console.log('=== APPLY OFFER ===');
    console.log('Request body:', req.body);
    console.log('User:', req.user);
    
    const { code, orderAmount, productId } = req.body;
    const customerId = req.user?._id;
    const customerMobile = req.user?.mobile;
    
    if (!customerId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    if (!code) {
      return res.status(400).json({ message: 'Offer code is required' });
    }
    
    console.log('Applying offer for user:', customerId, 'Mobile:', customerMobile);
    
    let offer = await Offer.findOne({ code: code.toUpperCase() }).populate('applicableProducts');
    console.log('Offer found:', offer ? 'Yes' : 'No');

    if (!offer) return res.status(404).json({ message: 'Invalid offer code' });
    
    // Migration: Set default offerType if not present
    if (!offer.offerType) {
      console.log('Setting offerType for offer:', offer._id);
      offer.offerType = offer.applicableProducts && offer.applicableProducts.length > 0 ? 'product-specific' : 'global';
      await offer.save();
    }
    
    console.log('Offer type:', offer.offerType);
    console.log('Current usedByCustomers:', offer.usedByCustomers);
    
    // Check if customer already used this offer (by userId or mobile)
    const alreadyUsed = offer.usedByCustomers.some(usage => {
      const userIdMatch = customerId && usage.customer && usage.customer.toString() === customerId.toString();
      const mobileMatch = customerMobile && usage.customerMobile === customerMobile;
      console.log('Checking usage - UserID match:', userIdMatch, 'Mobile match:', mobileMatch);
      return userIdMatch || mobileMatch;
    });
    
    console.log('Already used:', alreadyUsed);
    
    if (alreadyUsed) {
      return res.status(400).json({ message: 'You have already used this offer' });
    }
    
    // For product-specific offers, validate product
    if (offer.offerType === 'product-specific') {
      if (!productId) {
        return res.status(400).json({ message: 'This offer is only valid for specific products' });
      }
      
      const isApplicable = offer.applicableProducts.some(p => p._id.toString() === productId.toString());
      if (!isApplicable) {
        return res.status(400).json({ message: 'This offer is not applicable to the selected product' });
      }
    }
    
    // Get product details if productId provided
    let productDetails = null;
    if (productId && offer.offerType === 'product-specific') {
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

    // Record customer usage with both userId and mobile
    offer.usedByCustomers.push({
      customer: customerId,
      customerMobile: customerMobile,
      product: productId || null,
      usedAt: new Date()
    });
    
    offer.usedCount += 1;
    await offer.save();

    console.log('Offer applied successfully');
    res.json({ 
      success: true, 
      message: 'Offer applied successfully',
      offer: {
        code: offer.code,
        title: offer.title,
        offerType: offer.offerType,
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
    console.error('=== APPLY OFFER ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: error.message, error: error.toString() });
  }
};

export const createOffer = async (req, res) => {
  try {
    const offer = await Offer.create(req.body);
    
    // ✅ NEW: If product-specific offer, update products with activeOffer
    if (offer.offerType === 'product-specific' && offer.applicableProducts && offer.applicableProducts.length > 0) {
      await Product.updateMany(
        { _id: { $in: offer.applicableProducts } },
        { $set: { activeOffer: offer._id } }
      );
      console.log('Products updated with offer:', offer.applicableProducts);
    }
    
    res.status(201).json({ success: true, offer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateOffer = async (req, res) => {
  try {
    const oldOffer = await Offer.findById(req.params.id);
    const offer = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    
    // ✅ NEW: Update products if applicableProducts changed
    if (offer.offerType === 'product-specific') {
      // Remove offer from old products
      if (oldOffer && oldOffer.applicableProducts) {
        await Product.updateMany(
          { _id: { $in: oldOffer.applicableProducts } },
          { $set: { activeOffer: null } }
        );
      }
      
      // Add offer to new products
      if (offer.applicableProducts && offer.applicableProducts.length > 0) {
        await Product.updateMany(
          { _id: { $in: offer.applicableProducts } },
          { $set: { activeOffer: offer._id } }
        );
      }
    }
    
    res.json({ success: true, offer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    
    // ✅ NEW: Remove offer from products
    if (offer.offerType === 'product-specific' && offer.applicableProducts) {
      await Product.updateMany(
        { _id: { $in: offer.applicableProducts } },
        { $set: { activeOffer: null } }
      );
    }
    
    res.json({ success: true, message: 'Offer deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const applyOfferToProduct = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const customerId = req.user?._id;
    const customerMobile = req.user?.mobile;
    
    if (!customerId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const product = await Product.findById(productId).populate('activeOffer');
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    if (!product.activeOffer) {
      return res.status(400).json({ message: 'No active offer on this product' });
    }
    
    const offer = product.activeOffer;
    
    if (!offer.isActive) {
      return res.status(400).json({ message: 'Offer is inactive' });
    }
    if (offer.expiryDate < new Date()) {
      return res.status(400).json({ message: 'Offer expired' });
    }
    if (offer.usedCount >= offer.maxUses) {
      return res.status(400).json({ message: 'Offer limit reached' });
    }
    
    const alreadyUsed = offer.usedByCustomers.some(usage => {
      const userIdMatch = customerId && usage.customer && usage.customer.toString() === customerId.toString();
      const mobileMatch = customerMobile && usage.customerMobile === customerMobile;
      return userIdMatch || mobileMatch;
    });
    
    if (alreadyUsed) {
      return res.status(400).json({ message: 'You have already used this offer' });
    }
    
    const basePrice = product.price * quantity;
    
    if (offer.minOrderAmount > 0 && basePrice < offer.minOrderAmount) {
      return res.status(400).json({ 
        message: `Minimum order amount is ₹${offer.minOrderAmount}` 
      });
    }
    
    const discount = offer.discountType === 'percentage'
      ? (basePrice * offer.discountValue) / 100
      : offer.discountValue;
    
    const finalPrice = Math.max(0, basePrice - Math.round(discount));
    
    offer.usedByCustomers.push({
      customer: customerId,
      customerMobile: customerMobile,
      product: productId,
      usedAt: new Date()
    });
    
    offer.usedCount += 1;
    await offer.save();
    
    res.json({
      success: true,
      product: {
        _id: product._id,
        name: product.name,
        basePrice: product.price,
        quantity: quantity,
        totalBasePrice: basePrice
      },
      offer: {
        _id: offer._id,
        code: offer.code,
        title: offer.title,
        discountType: offer.discountType,
        discountValue: offer.discountValue
      },
      priceBreakdown: {
        basePrice: basePrice,
        discountAmount: Math.round(discount),
        finalPrice: finalPrice,
        savings: Math.round(discount)
      }
    });
  } catch (error) {
    console.error('applyOfferToProduct error:', error);
    res.status(500).json({ message: error.message });
  }
};
