import User from '../models/User.js';
import Admin from '../models/Admin.js';
import Product from '../models/Product.js';
import Kitchen from '../models/Kitchen.js';
import Billing from '../models/Billing.js';
import Order from '../models/Order.js';
import UserInventory from '../models/UserInventory.js';

export const getAdminDashboard = async (req, res) => {
    try {
        const { role, _id: userId } = req.user;
        let kitchenId = null;

        if (role === 'kitchen_admin') {
            const k = await Kitchen.findOne({ admin: userId }).select('_id').lean();
            if (k) kitchenId = k._id;
        } else if (role === 'billing_admin') {
            const k = await Kitchen.findOne({ billingAdmin: userId }).select('_id').lean();
            if (k) kitchenId = k._id;
        }

        const billQuery = kitchenId ? { kitchen: kitchenId } : {};

        const promises = [
            User.countDocuments().lean(),
            Admin.countDocuments().lean(),
            Product.countDocuments().lean(),
            Kitchen.countDocuments().lean(),
            Billing.countDocuments(billQuery).lean(),
            Order.countDocuments(billQuery).lean() // Count Orders too
        ];

        // Products logic - For billing_admin, get from Kitchen's assignedProducts
        let dashboardProducts = [];
        if (role === 'super_admin' || role === 'admin') {
            dashboardProducts = await Product.find()
                .select('name price quantity category status minStock thumbnail')
                .limit(10)
                .sort({ updatedAt: -1 })
                .lean();
        } else if (role === 'billing_admin') {
            // For billing admin, get products from Kitchen's assignedProducts
            const kitchen = await Kitchen.findOne({ billingAdmin: userId })
                .populate({
                    path: 'assignedProducts.product',
                    select: 'name price category status minStock thumbnail unit'
                })
                .lean();
            
            if (kitchen && kitchen.assignedProducts) {
                dashboardProducts = kitchen.assignedProducts
                    .filter(ap => ap.product && ap.product.name)
                    .map(ap => ({
                        ...ap.product,
                        quantity: ap.assigned - ap.used, // remaining quantity
                        assigned: ap.assigned,
                        used: ap.used,
                        remaining: ap.assigned - ap.used
                    }));
            }
            console.log('Billing admin dashboard products:', dashboardProducts.length);
        } else if (role === 'kitchen_admin') {
            // For kitchen admin, get products from Kitchen's assignedProducts
            const kitchen = await Kitchen.findOne({ admin: userId })
                .populate({
                    path: 'assignedProducts.product',
                    select: 'name price category status minStock thumbnail unit'
                })
                .lean();
            
            if (kitchen && kitchen.assignedProducts) {
                dashboardProducts = kitchen.assignedProducts
                    .filter(ap => ap.product && ap.product.name)
                    .map(ap => ({
                        ...ap.product,
                        quantity: ap.assigned - ap.used,
                        assigned: ap.assigned,
                        used: ap.used,
                        remaining: ap.assigned - ap.used
                    }));
            }
        }
        promises.push(Promise.resolve(dashboardProducts));

        // Transactions (Bills + Orders)
        promises.push(
            Billing.find(billQuery)
                .select('billNumber totalAmount status createdAt customer')
                .limit(5)
                .sort({ createdAt: -1 })
                .lean()
        );
        promises.push(
            Order.find(billQuery)
                .select('orderNumber totalAmount status createdAt customer')
                .populate('customer', 'name')
                .limit(5)
                .sort({ createdAt: -1 })
                .lean()
        );

        // Kitchens
        promises.push(
            Kitchen.find(kitchenId ? { _id: kitchenId } : {})
                .select('name location status')
                .limit(5)
                .lean()
        );

        const results = await Promise.all(promises);

        const [userCount, adminCount, productCount, kitchenCount, billingCount, orderCount, products, latestBills, latestOrders, kitchens] = results;

        // Merge and sort recent transactions
        const mergedTransactions = [
            ...latestBills.map(b => ({ ...b, type: 'BILL', id: b.billNumber })),
            ...latestOrders.map(o => ({ 
                ...o, 
                type: 'ORDER', 
                id: o.orderNumber, 
                customer: { name: o.customer?.name || 'Online Customer' } 
            }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

        // Calculate combined today revenue accurately using a separate query or result sum
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const [todayBills, todayOrders] = await Promise.all([
            Billing.find({ 
                ...billQuery, 
                createdAt: { $gte: todayStart },
                status: 'Completed' // Only count completed bills for revenue
            }).select('totalAmount').lean(),
            Order.find({ 
                ...billQuery, 
                createdAt: { $gte: todayStart },
                status: 'Completed' // Only count completed orders for revenue
            }).select('totalAmount').lean()
        ]);

        const combinedRevenue = [...todayBills, ...todayOrders]
            .reduce((sum, t) => sum + (t.totalAmount || 0), 0);

        // Calculate weekly revenue (last 7 days, day-by-day) from real data
        const weeklyRevenue = [];
        for (let i = 6; i >= 0; i--) {
            const dayStart = new Date();
            dayStart.setDate(dayStart.getDate() - i);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);

            const dateFilter = { 
                ...billQuery, 
                createdAt: { $gte: dayStart, $lte: dayEnd },
                status: 'Completed' // Only count completed
            };
            const [dayBills, dayOrders] = await Promise.all([
                Billing.find(dateFilter).select('totalAmount').lean(),
                Order.find(dateFilter).select('totalAmount').lean()
            ]);
            const dayTotal = [...dayBills, ...dayOrders].reduce((sum, t) => sum + (t.totalAmount || 0), 0);
            weeklyRevenue.push({
                date: dayStart.toLocaleDateString('en-IN', { weekday: 'short' }),
                revenue: dayTotal
            });
        }

        // Calculate low stock count accurately
        // For super_admin, we need a separate count if we limit the products list
        let actualLowStockCount = 0;
        let outOfStockCount = 0;
        if (role === 'super_admin' || role === 'admin') {
            actualLowStockCount = await Product.countDocuments({ status: 'Low Stock' });
            outOfStockCount = await Product.countDocuments({ quantity: 0 });
        } else {
            actualLowStockCount = products.filter(p => (p.quantity || 0) <= (p.minStock || 10) && (p.quantity || 0) > 0).length;
            outOfStockCount = products.filter(p => (p.quantity || 0) === 0).length;
        }
        res.json({
            success: true,
            stats: {
                totalUsers: userCount,
                totalAdmins: adminCount,
                totalProducts: (role === 'super_admin' || role === 'admin') ? productCount : products.length,
                totalKitchens: kitchenCount,
                totalBills: billingCount + orderCount,
                todayRevenue: combinedRevenue,
                weeklyRevenue,
                lowStockCount: actualLowStockCount,
                outOfStockCount
            },
            recentBills: mergedTransactions, // Frontend uses this key for the list
            products: products.slice(0, 5),
            kitchens
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({ success: false, message: 'Failed to load dashboard' });
    }
};