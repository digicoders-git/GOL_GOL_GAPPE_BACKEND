import express from 'express';
import Product from '../models/Product.js';

const router = express.Router();

// Simple test endpoint to check products
router.get('/test-products', async (req, res) => {
  try {
    console.log('🔄 Testing direct product fetch...');
    
    const products = await Product.find().lean();
    console.log(`📦 Found ${products.length} products in database`);
    
    if (products.length > 0) {
      console.log('🍽️ Sample product:', products[0]);
    }
    
    res.json({
      success: true,
      count: products.length,
      products: products.slice(0, 5), // Return first 5 for testing
      message: `Found ${products.length} products in MongoDB`
    });
  } catch (error) {
    console.error('❌ Test products error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch products from database'
    });
  }
});

export default router;