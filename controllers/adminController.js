import User from '../models/User.js';
import Product from '../models/Product.js';
import Kitchen from '../models/Kitchen.js';
import Billing from '../models/Billing.js';

export const getAdminDashboard = async (req, res) => {
    try {
        console.log('Admin dashboard API called - fetching dynamic data');
        
        // Fast database queries with real data
        const [userCount, productCount, kitchenCount, billCount] = await Promise.all([
            User.countDocuments(),
            Product.countDocuments(), 
            Kitchen.countDocuments(),
            Billing.countDocuments()
        ]);

        // Get real data from database
        const [users, products, kitchens, bills] = await Promise.all([
            User.find().select('name email role createdAt').limit(10).lean(),
            Product.find().select('name price quantity category').limit(10).lean(),
            Kitchen.find().select('name location manager').limit(10).lean(),
            Billing.find().select('billNumber totalAmount status createdAt customer').limit(10).sort({ createdAt: -1 }).lean()
        ]);

        console.log(`Fetched: ${users.length} users, ${products.length} products, ${kitchens.length} kitchens, ${bills.length} bills`);
        
        res.json({
            users,
            products,
            kitchens,
            bills,
            stats: {
                totalUsers: userCount,
                totalProducts: productCount,
                totalKitchens: kitchenCount,
                totalBills: billCount
            }
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({ message: error.message });
    }
};