import Order from '../models/Order.js';
import Billing from '../models/Billing.js';
import Kitchen from '../models/Kitchen.js';
import Product from '../models/Product.js';
import UserInventory from '../models/UserInventory.js';
import Offer from '../models/Offer.js';
import StockLog from '../models/StockLog.js';
import { getIO } from '../config/socket.js';
import { clearCache } from '../middleware/cache.js';

export const createOrder = async (req, res) => {
  try {
    const { items, offerCode } = req.body;
    const customerId = req.user._id;
    const customerMobile = req.user.mobile;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items in order' });
    }
    
    let offerData = null;
    if (offerCode) {
      // console.log('Processing offer in order:', offerCode);
      
      if (items.length !== 1) {
        return res.status(400).json({ message: 'Offer can only be applied to 1 item' });
      }

      const offer = await Offer.findOne({ code: offerCode.toUpperCase() });
      if (!offer) {
        return res.status(400).json({ message: 'Invalid offer code' });
      }

      if (!offer.isActive) {
        return res.status(400).json({ message: 'Offer is inactive' });
      }
      if (offer.expiryDate < new Date()) {
        return res.status(400).json({ message: 'Offer expired' });
      }
      if (offer.usedCount >= offer.maxUses) {
        return res.status(400).json({ message: 'Offer limit reached' });
      }

      // Check if user already used this offer in a COMPLETED order
      const alreadyUsedInOrder = offer.usedByCustomers.some(usage => {
        const userIdMatch = customerId && usage.customer && usage.customer.toString() === customerId.toString();
        const mobileMatch = customerMobile && usage.customerMobile === customerMobile;
        return (userIdMatch || mobileMatch) && usage.orderCompleted === true;
      });

      if (alreadyUsedInOrder) {
        return res.status(400).json({ message: 'You have already used this offer' });
      }

      // Validate product-specific offer
      if (offer.offerType === 'product-specific') {
        if (!offer.applicableProducts || offer.applicableProducts.length === 0) {
          return res.status(400).json({ message: 'No products configured for this offer' });
        }
        
        const orderProductId = items[0]?.product?.toString();
        const isApplicable = offer.applicableProducts.some(p => p.toString() === orderProductId);
        
        if (!isApplicable) {
          return res.status(400).json({ message: 'This offer is not applicable to the selected product' });
        }
      }
      
      const orderAmount = req.body.totalAmount;
      
      const discount = offer.discountType === 'percentage'
        ? (orderAmount * offer.discountValue) / 100
        : offer.discountValue;

      offerData = {
        code: offer.code,
        offerId: offer._id,
        discountAmount: Math.round(discount)
      };

      // console.log('Offer already applied, using in order:', offerCode);
    }
    
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ message: `Product not found` });
      }
      if (!product.inStock || product.quantity <= 0 || product.status === 'Out of Stock') {
        return res.status(400).json({ message: `${product.name} is out of stock` });
      }
      if (product.quantity < item.quantity) {
        return res.status(400).json({ message: `Only ${product.quantity} ${product.unit} of ${product.name} available` });
      }
    }
    
    const orderNumber = `ORD${Date.now()}`;

    const orderData = {
      orderNumber,
      customer: customerId,
      items: items,
      totalAmount: req.body.totalAmount,
      paymentMethod: null,
      paymentStatus: req.body.paymentStatus || 'Pending',
      status: 'Pending'
    };

    if (offerData) {
      orderData.offer = offerData;
    }

    const order = await Order.create(orderData);

    // Mark offer as used in a completed order
    if (offerData) {
      console.log('=== UPDATING OFFER USAGE ===');
      console.log('Offer Code:', offerData.code);
      console.log('Offer ID:', offerData.offerId);
      
      const offer = await Offer.findById(offerData.offerId);
      if (offer) {
        console.log('Offer found - Current usedCount:', offer.usedCount);
        console.log('Offer maxUses:', offer.maxUses);
        
        // Add new usage entry for this order
        offer.usedByCustomers.push({
          customer: customerId,
          customerMobile: customerMobile,
          orderId: order._id,
          orderCompleted: true,
          usedAt: new Date()
        });
        
        // Increment usedCount for every order
        offer.usedCount += 1;
        
        console.log('New usedCount:', offer.usedCount);
        console.log('UsedByCustomers length:', offer.usedByCustomers.length);
        
        await offer.save();
        console.log('Offer saved successfully');
        console.log('=== OFFER UPDATE COMPLETE ===');
      } else {
        console.log('ERROR: Offer not found with ID:', offerData.offerId);
      }
    }

    await order.populate('items.product', 'name price unit thumbnail');
    await order.populate('customer', 'name email mobile');

    const io = getIO();
    if (io) {
      const updatedProducts = await Product.find({ _id: { $in: items.map(i => i.product) } });
      
      io.to('admin-panel').emit('order-created', {
        order: order,
        products: updatedProducts
      });

      io.emit('new-billing-order', {
        order: order,
        products: updatedProducts
      });

      // console.log('Socket events emitted for order:', order.orderNumber);
    }

    // console.log('Order created successfully:', order._id, 'for customer:', customerId);
    res.status(201).json({ success: true, order });
  } catch (error) {
    console.error('createOrder error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .populate('items.product', 'name price unit thumbnail')
      .populate('kitchen', 'name location')
      .sort({ createdAt: -1 });

    // console.log('getMyOrders - User:', req.user._id, 'Orders found:', orders.length);
    res.json({ success: true, orders });
  } catch (error) {
    console.error('getMyOrders error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    // console.log('User role:', req.user.role, 'User ID:', req.user._id);
    
    const totalOrders = await Order.countDocuments({});
    // console.log('Total orders in database:', totalOrders);
    
    let query = {};

    if (req.user.role === 'billing_admin' || req.user.role === 'kitchen_admin' || req.user.role === 'super_admin' || req.user.role === 'admin') {
      query = {};
    } else {
      query = { customer: req.user._id };
    }

    // console.log('Query:', JSON.stringify(query));

    const orders = await Order.find(query)
      .populate('items.product', 'name price unit')
      .populate('customer', 'name email mobile')
      .populate('kitchen', 'name location')
      .sort({ createdAt: -1 });

    // console.log('Orders found:', orders.length);

    res.json({ success: true, orders, totalInDB: totalOrders });
  } catch (error) {
    console.error('getAllOrders error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const assignKitchenToOrder = async (req, res) => {
  try {
    const { kitchenId, paymentMethod } = req.body;

    const updateData = { 
      kitchen: kitchenId, 
      status: 'Assigned_to_Kitchen'
    };
    
    // If payment method is provided, update payment status to Completed
    if (paymentMethod) {
      updateData.paymentMethod = paymentMethod;
      updateData.paymentStatus = 'Completed';
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate('items.product', 'name price unit')
      .populate('customer', 'name email mobile')
      .populate('kitchen', 'name location');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // console.log('=== ASSIGNING ORDER TO KITCHEN ===');
    // console.log('Order:', order.orderNumber);
    // console.log('Kitchen ID:', kitchenId);
    // console.log('Order items:', order.items.map(i => ({ productId: i.product._id, qty: i.quantity })));

    // Fetch kitchen WITHOUT populating - keep product as ID
    const kitchen = await Kitchen.findById(kitchenId);
    
    if (kitchen) {
      // console.log('Kitchen found:', kitchen.name);
      // console.log('Assigned products BEFORE:', kitchen.assignedProducts.map(ap => ({
      //   productId: ap.product.toString(),
      //   assigned: ap.assigned,
      //   used: ap.used
      // })));
      
      // Process each order item
      for (const item of order.items) {
        if (item.product) {
          // console.log('Processing item:', item.product._id, 'Quantity:', item.quantity);
          
          // Find the assignment for this product - COMPARE IDs DIRECTLY
          const assignment = kitchen.assignedProducts.find(
            ap => ap.product.toString() === item.product._id.toString()
          );
          
          if (assignment) {
            // Only increment USED, don't touch ASSIGNED
            const oldUsed = assignment.used || 0;
            assignment.used = Number(oldUsed) + Number(item.quantity);
            // console.log(`Updated product ${item.product._id}: used ${oldUsed} -> ${assignment.used}`);
          } else {
            // console.log('WARNING: Product not assigned to kitchen:', item.product._id);
          }

          // Create stock log
          const productRecord = await Product.findById(item.product._id);
          await StockLog.create({
            product: item.product._id,
            type: 'REMOVE',
            quantity: item.quantity,
            previousQuantity: productRecord ? productRecord.quantity : 0,
            newQuantity: productRecord ? productRecord.quantity : 0,
            notes: `Kitchen Consumption for Online Order: ${order.orderNumber} (Kitchen: ${kitchen.name})`,
            user: req.user ? req.user._id : null
          });
        }
      }
      
      // console.log('Assigned products AFTER:', kitchen.assignedProducts.map(ap => ({
      //   productId: ap.product.toString(),
      //   assigned: ap.assigned,
      //   used: ap.used
      // })));
      
      // Mark as modified and save
      kitchen.markModified('assignedProducts');
      await kitchen.save();
      // console.log('Kitchen saved successfully');
    } else {
      // console.log('ERROR: Kitchen not found:', kitchenId);
    }

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.to(`kitchen-${kitchenId}`).emit('order-assigned', order);
      io.to('admin-panel').emit('order-assigned', order);
      
      const updatedKitchen = await Kitchen.findById(kitchenId)
        .populate('assignedProducts.product', 'name unit quantity');
      io.to(`kitchen-${kitchenId}`).emit('kitchen-stock-updated', {
        kitchenId,
        inventory: updatedKitchen.assignedProducts,
        timestamp: new Date()
      });
      io.to('admin-panel').emit('stock-updated', {
        kitchenId,
        timestamp: new Date()
      });

      // console.log('Socket events emitted for order:', order.orderNumber);
    }

    // Clear available products cache since kitchen stock changed
    clearCache('available-products');

    res.json({ success: true, order });
  } catch (error) {
    console.error('assignKitchenToOrder error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate('items.product', 'name price unit')
      .populate('customer', 'name email mobile')
      .populate('kitchen', 'name location');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const io = req.app.get('io');
    if (io) {
      if (order.kitchen) {
        io.to(`kitchen-${order.kitchen._id}`).emit('order-status-updated', order);
        
        if (status === 'Completed') {
          const updatedKC = await Kitchen.findById(order.kitchen._id)
            .populate('assignedProducts.product', 'name unit quantity');
          io.to(`kitchen-${order.kitchen._id}`).emit('kitchen-stock-updated', {
            kitchenId: order.kitchen._id,
            inventory: updatedKC.assignedProducts,
            timestamp: new Date()
          });
        }
      }
      io.to('admin-panel').emit('order-status-updated', order);
      io.to('admin-panel').emit('stock-updated', { timestamp: new Date() });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('updateOrderStatus error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    console.error('deleteOrder error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
