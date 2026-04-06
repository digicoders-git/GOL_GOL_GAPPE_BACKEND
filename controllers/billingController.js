import Billing from '../models/Billing.js';
import Product from '../models/Product.js';
import StockLog from '../models/StockLog.js';
import UserInventory from '../models/UserInventory.js';
import Kitchen from '../models/Kitchen.js';
import Order from '../models/Order.js';
import Offer from '../models/Offer.js';
import mongoose from 'mongoose';
import { getIO } from '../config/socket.js';

export const getAllBills = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    console.log('getAllBills called - User:', req.user?.email, 'Role:', req.user?.role);

    let query = {};

    if (req.user.role === 'kitchen_admin') {
      const kitchen = await Kitchen.findOne({ admin: req.user._id }).select('_id').lean();
      if (kitchen) {
        query.kitchen = kitchen._id;
        console.log('Kitchen admin - filtering by kitchen:', kitchen._id);
      } else {
        console.log('Kitchen admin - no kitchen found');
        return res.json({ success: true, bills: [], pagination: { page, limit, total: 0, pages: 0 } });
      }
    } else if (req.user.role === 'billing_admin') {
      // Billing admin can see all bills OR only their kitchen's bills
      const userKitchen = await Kitchen.findOne({ billingAdmin: req.user._id }).select('_id').lean();
      if (userKitchen) {
        query.kitchen = userKitchen._id;
        console.log('Billing admin - filtering by their kitchen:', userKitchen._id);
      } else {
        // If no kitchen assigned, show all bills (for super billing admin)
        console.log('Billing admin - no specific kitchen, showing all bills');
      }
    } else if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      console.log('Super admin - showing all bills');
    }

    console.log('Query:', JSON.stringify(query));

    const [bills, total] = await Promise.all([
      Billing.find(query)
        .select('billNumber kitchen customer items totalAmount status createdAt paymentMethod')
        .populate('kitchen', 'name location')
        .populate('items.product', 'name unit price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Billing.countDocuments(query)
    ]);

    console.log('Bills found:', bills.length, 'Total:', total);

    res.json({
      success: true,
      bills,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('getAllBills error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getUserOrders = async (req, res) => {
  try {
    console.log('getUserOrders called - User:', req.user);
    console.log('Searching for phone:', req.user.mobile);
    console.log('Searching for user ID:', req.user._id);
    
    // Search in both Billing and Order collections
    const [bills, orders] = await Promise.all([
      // Search bills by phone
      Billing.find({ 'customer.phone': req.user.mobile })
        .populate('items.product', 'name thumbnail price')
        .populate('kitchen', 'name location')
        .sort({ createdAt: -1 })
        .lean(),
      // Search orders by user ID
      Order.find({ customer: req.user._id })
        .populate('items.product', 'name thumbnail price')
        .populate('kitchen', 'name location')
        .sort({ createdAt: -1 })
        .lean()
    ]);
    
    console.log('Bills found by phone:', bills.length);
    console.log('Orders found by user ID:', orders.length);
    
    // Merge both and normalize
    const allBills = [
      ...bills.map(b => ({ ...b, type: 'BILL' })),
      ...orders.map(o => ({ 
        ...o, 
        type: 'ORDER',
        billNumber: o.orderNumber,
        customer: {
          name: req.user.name,
          phone: req.user.mobile
        }
      }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    console.log('Total bills/orders returned:', allBills.length);
    res.json({ success: true, bills: allBills });
  } catch (error) {
    console.error('getUserOrders error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const createBill = async (req, res) => {
  try {
    const { items, kitchenId, customerName, customerMobile, offerCode } = req.body;
    const billNumber = `BILL${Date.now()}`;

    console.log('Creating bill:', billNumber);

    let offerData = null;
    if (offerCode) {
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

      const customerId = req.user?._id;
      const alreadyUsed = offer.usedByCustomers.some(usage => {
        const userIdMatch = customerId && usage.customer && usage.customer.toString() === customerId.toString();
        const mobileMatch = customerMobile && usage.customerMobile === customerMobile;
        return userIdMatch || mobileMatch;
      });

      if (alreadyUsed) {
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
      
      if (offer.minOrderAmount > 0 && orderAmount < offer.minOrderAmount) {
        return res.status(400).json({ message: `Minimum order amount of ₹${offer.minOrderAmount} required for this offer` });
      }
      
      const discount = offer.discountType === 'percentage'
        ? (orderAmount * offer.discountValue) / 100
        : offer.discountValue;

      offerData = {
        code: offer.code,
        offerId: offer._id,
        discountAmount: Math.round(discount)
      };
    }

    let kitchenToAssign = req.body.kitchen || kitchenId || null;

    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const existingBill = await Billing.findOne({
      'customer.phone': req.body.customer?.phone || customerMobile,
      totalAmount: req.body.totalAmount,
      createdAt: { $gte: fiveSecondsAgo }
    });

    if (existingBill) {
      console.log('Duplicate bill creation attempt blocked');
      return res.status(200).json({ success: true, bill: existingBill, message: 'Existing bill returned' });
    }

    if (!kitchenToAssign && req.user && req.user.role === 'billing_admin') {
      const userKitchen = await Kitchen.findOne({ billingAdmin: req.user._id });
      if (userKitchen) {
        kitchenToAssign = userKitchen._id;
      }
    }

    console.log('Creating bill - User:', req.user?.email, 'Role:', req.user?.role, 'Kitchen:', kitchenToAssign);

    const billData = {
      billNumber,
      kitchen: kitchenToAssign,
      customer: req.body.customer || { name: customerName, phone: customerMobile },
      items: items,
      totalAmount: req.body.totalAmount,
      status: req.body.status || 'Pending',
      paymentMethod: req.body.paymentMethod
    };

    if (offerData) {
      billData.offer = offerData;
    }

    const bill = await Billing.create(billData);
    console.log('Bill created:', bill._id);

    if (offerData) {
      const offer = await Offer.findById(offerData.offerId);
      if (offer) {
        offer.usedByCustomers.push({
          customer: req.user?._id || null,
          customerMobile: customerMobile,
          product: items[0]?.product || null,
          usedAt: new Date()
        });
        offer.usedCount += 1;
        await offer.save();
        console.log('Offer marked as used:', offerData.code);
      }
    }

    let kitchenObj = null;
    let kitchenAdmin = null;
    if (bill.kitchen) {
      kitchenObj = await Kitchen.findById(bill.kitchen);
      if (kitchenObj) kitchenAdmin = kitchenObj.admin;
    }

    for (const item of items) {
      if (item.product) {
        const product = await Product.findById(item.product);
        if (product) {
          const previousQuantity = product.quantity;
          const quantityToDeduct = Number(item.quantity) || 0;

          // 1. Deduct from Kitchen Inventory (ONLY IF KITCHEN IS ASSIGNED)
          if (kitchenObj) {
            console.log('Kitchen Bill - Deducting from Kitchen stock ONLY');
            const assignment = kitchenObj.assignedProducts.find(
              ap => ap.product.toString() === item.product.toString()
            );
            if (assignment) {
              // Update used count
              assignment.used = (assignment.used || 0) + quantityToDeduct;
              console.log(`Stock update: ${product.name} - Assigned: ${assignment.assigned}, Used: ${assignment.used}, Remaining: ${assignment.assigned - assignment.used}`);
            }

            // Also update UserInventory for kitchen admin
            if (kitchenAdmin) {
              const uInv = await UserInventory.findOne({ user: kitchenAdmin, product: product._id });
              if (uInv) {
                uInv.quantity -= quantityToDeduct;
                await uInv.save();
              }
            }
          } else {
            // 2. Direct Sale (NO KITCHEN) - Deduct from Master Inventory
            console.log('Direct Sale - Deducting from Master Product stock');
            product.quantity -= quantityToDeduct;
            if (product.quantity > product.minStock) {
              product.status = 'In Stock';
            } else if (product.quantity > 0) {
              product.status = 'Low Stock';
            } else {
              product.status = 'Out of Stock';
            }
            await product.save();
          }

          // 3. Create Stock Log (Documentation Only)
          await StockLog.create({
            product: product._id,
            type: 'REMOVE',
            quantity: quantityToDeduct,
            previousQuantity,
            newQuantity: product.quantity,
            notes: kitchenObj
              ? `[KITCHEN SALE] Sold from ${kitchenObj.name}. (Warehouse balance unaffected)`
              : `[DIRECT SALE] Sold from Warehouse. (Master stock decreased)`,
            user: req.user ? req.user._id : null
          });
        }
      }
    }

    if (kitchenObj) {
      kitchenObj.markModified('assignedProducts');
      await kitchenObj.save();
    }

    await bill.populate('kitchen', 'name location');
    await bill.populate('items.product', 'name unit');

    const io = getIO();
    if (io) {
      // Notify Admin Panel
      io.emit('new-billing-order', { bill, timestamp: new Date() });
      io.to('admin-panel').emit('new-billing-order', { bill, timestamp: new Date() });
      io.to('admin-panel').emit('stock-updated', { timestamp: new Date() });

      // Notify Kitchen Panel
      if (bill.kitchen) {
        const updatedKC = await Kitchen.findById(bill.kitchen)
          .populate('assignedProducts.product', 'name unit quantity');
        io.to(`kitchen-${bill.kitchen}`).emit('kitchen-stock-updated', {
          kitchenId: bill.kitchen,
          inventory: updatedKC.assignedProducts,
          timestamp: new Date()
        });
      }
    }

    res.status(201).json({ success: true, bill });
  } catch (error) {
    console.error('createBill error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateBill = async (req, res) => {
  try {
    console.log('updateBill called - ID:', req.params.id);

    // 1. Try updating in Billing collection
    let record = await Billing.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    )
      .populate('kitchen', 'name location')
      .populate('items.product', 'name unit');

    if (!record) {
      // 2. Try updating in Order collection
      console.log('Not found in Billing, trying Order collection...');
      record = await Order.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      )
        .populate('kitchen', 'name location')
        .populate('items.product', 'name unit');
    }

    if (!record) {
      console.log('Record not found in any collection:', req.params.id);
      return res.status(404).json({ message: 'Record not found' });
    }

    console.log('Record updated successfully:', record._id);
    res.json({ success: true, bill: record });
  } catch (error) {
    console.error('updateBill error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getBillById = async (req, res) => {
  try {
    let bill = await Billing.findById(req.params.id)
      .populate('kitchen', 'name location')
      .populate('items.product', 'name unit');

    if (!bill) {
      // Try finding in Order collection if not found in Billing
      bill = await Order.findById(req.params.id)
        .populate('kitchen', 'name location')
        .populate('items.product', 'name unit')
        .populate('customer', 'name mobile email');

      if (bill) {
        // Transform Order to match Bill structure for frontend consistency if needed
        const orderObj = bill.toObject();
        return res.json({
          success: true,
          bill: {
            ...orderObj,
            type: 'ORDER',
            billNumber: orderObj.orderNumber // alias for frontend
          }
        });
      }
    }

    if (!bill) {
      return res.status(404).json({ message: 'Record not found' });
    }

    res.json({ success: true, bill: { ...bill.toObject(), type: 'BILL' } });
  } catch (error) {
    console.error('getBillById error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getKitchenOrders = async (req, res) => {
  try {
    console.log('getKitchenOrders called by:', req.user.email, 'Role:', req.user.role);
    let kitchen;

    if (req.user.role === 'kitchen_admin') {
      kitchen = await Kitchen.findOne({ admin: req.user._id });
      console.log('Kitchen found for kitchen_admin:', kitchen);
    } else if (req.user.role === 'billing_admin') {
      kitchen = await Kitchen.findOne({ billingAdmin: req.user._id });
      if (!kitchen && req.user.kitchen) {
        kitchen = await Kitchen.findById(req.user.kitchen);
      }
      console.log('Kitchen found for role', req.user.role, ':', kitchen?._id || 'None');
    }

    if (!kitchen) {
      console.log('No kitchen found, returning empty array');
      return res.json({ success: true, bills: [], message: 'No kitchen assigned' });
    }

    console.log('Searching bills and orders for kitchen:', kitchen._id);

    const [bills, onlineOrders] = await Promise.all([
      Billing.find({ kitchen: kitchen._id })
        .populate('items.product', 'name unit thumbnail category')
        .populate('kitchen', 'name location')
        .sort({ createdAt: -1 })
        .lean(),
      Order.find({ kitchen: kitchen._id })
        .populate('items.product', 'name unit thumbnail category')
        .populate('customer', 'name mobile email')
        .populate('kitchen', 'name location')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    const merged = [
      ...bills.map(b => ({ ...b, type: 'BILL' })),
      ...onlineOrders.map(o => ({ ...o, type: 'ORDER' }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`Kitchen data found: Bills(${bills.length}), Orders(${onlineOrders.length})`);
    res.json({ success: true, bills: merged });
  } catch (error) {
    console.error('getKitchenOrders error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateBillStatus = async (req, res) => {
  try {
    const { status } = req.body;
    console.log('Updating bill status:', req.params.id, 'to:', status);

    let bill = await Billing.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate('kitchen', 'name location')
      .populate('items.product', 'name unit');

    if (!bill) {
      // Try Order collection
      bill = await Order.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      )
        .populate('kitchen', 'name location')
        .populate('items.product', 'name unit');
    }

    if (!bill) {
      return res.status(404).json({ message: 'Bill status update failed: Record not found' });
    }

    // NEW: Handle Stock Deduction when assigning to kitchen
    if (status === 'Assigned_to_Kitchen' && bill.kitchen && bill.items) {
      console.log('Order Assigned to Kitchen - Deducting Stock...');
      const kitchen = await Kitchen.findById(bill.kitchen);

      if (kitchen) {
        for (const item of bill.items) {
          if (item.product) {
            // 1. Update Kitchen Assigned Products - increment USED count
            const assignment = kitchen.assignedProducts.find(
              ap => (ap.product._id || ap.product).toString() === (item.product._id || item.product).toString()
            );

            if (assignment) {
              const qtyToDeduct = Number(item.quantity || 0);
              const oldUsed = assignment.used || 0;
              assignment.used = oldUsed + qtyToDeduct;
              console.log(`Stock update on assign: ${assignment.assigned} assigned, ${assignment.used} used, ${assignment.assigned - assignment.used} remaining`);

              // 2. Create Stock Log for the consumption
              await StockLog.create({
                product: item.product._id || item.product,
                type: 'REMOVE',
                quantity: qtyToDeduct,
                previousQuantity: oldUsed,
                newQuantity: assignment.used,
                notes: `[KITCHEN CONSUMPTION] Order: ${bill.billNumber || bill.orderNumber} (Kitchen: ${kitchen.name})`,
                user: req.user ? req.user._id : null
              });
            }
          }
        }
        kitchen.markModified('assignedProducts');
        await kitchen.save();
        console.log('Kitchen stock updated for order:', bill._id);
      }
    }

    const io = getIO();
    if (io) {
      io.emit('billing-status-updated', {
        bill,
        timestamp: new Date()
      });
    }

    res.json({ success: true, bill });
  } catch (error) {
    console.error('updateBillStatus error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteBill = async (req, res) => {
  try {
    let bill = await Billing.findByIdAndDelete(req.params.id);

    if (!bill) {
      bill = await Order.findByIdAndDelete(req.params.id);
    }

    if (!bill) {
      return res.status(404).json({ message: 'Bill deletion failed: Record not found' });
    }

    res.json({ success: true, message: 'Bill deleted successfully' });
  } catch (error) {
    console.error('deleteBill error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getPrintBill = async (req, res) => {
  try {
    let bill = await Billing.findById(req.params.id)
      .populate('kitchen', 'name location')
      .populate('items.product', 'name unit price')
      .populate('customer');

    if (!bill) {
      // Try Order collection
      bill = await Order.findById(req.params.id)
        .populate('kitchen', 'name location')
        .populate('items.product', 'name unit price')
        .populate('customer', 'name mobile email');

      if (bill) {
        const orderObj = bill.toObject();
        return res.json({
          success: true,
          bill: {
            ...orderObj,
            type: 'ORDER',
            billNumber: orderObj.orderNumber
          }
        });
      }
    }

    if (!bill) {
      return res.status(404).json({ message: 'Record not found' });
    }

    res.json({ success: true, bill: { ...bill.toObject(), type: 'BILL' } });
  } catch (error) {
    console.error('getPrintBill error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const testKitchenAssignment = async (req, res) => {
  try {
    const userRole = req.user?.role || 'unknown';
    const userId = req.user?._id || 'unknown';

    let result = {
      userRole,
      userId,
      assignedKitchen: null
    };

    if (userRole === 'billing_admin') {
      const userKitchen = await Kitchen.findOne({ billingAdmin: userId });
      result.assignedKitchen = userKitchen;
    }

    const allKitchens = await Kitchen.find();
    result.allKitchens = allKitchens;

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
