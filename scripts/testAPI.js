import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

const testAPI = async () => {
  console.log('🚀 Starting API Tests...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    const health = await axios.get('http://localhost:5000');
    console.log('✅ Health Check:', health.data.message);

    // Test 2: Register Admin
    console.log('\n2. Testing Admin Registration...');
    const registerData = {
      username: 'admin',
      password: 'admin123',
      role: 'admin'
    };
    
    try {
      const register = await axios.post(`${BASE_URL}/auth/register`, registerData);
      console.log('✅ Admin Registered:', register.data.user.username);
    } catch (error) {
      if (error.response?.data?.message === 'User already exists') {
        console.log('ℹ️  Admin already exists, continuing...');
      } else {
        throw error;
      }
    }

    // Test 3: Login
    console.log('\n3. Testing Login...');
    const login = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    console.log('✅ Login Success:', login.data.user.username);
    
    const token = login.data.token;
    const headers = { Authorization: `Bearer ${token}` };

    // Test 4: Get Profile
    console.log('\n4. Testing Get Profile...');
    const profile = await axios.get(`${BASE_URL}/auth/profile`, { headers });
    console.log('✅ Profile:', profile.data.user.username);

    // Test 5: Add Product Quantity
    console.log('\n5. Testing Add Quantity...');
    const quantityData = {
      productName: 'Gol Gappe',
      category: 'ingredients',
      quantity: 50,
      unit: 'pcs',
      notes: 'Initial stock'
    };
    const addQuantity = await axios.post(`${BASE_URL}/products/add-quantity`, quantityData, { headers });
    console.log('✅ Quantity Added:', addQuantity.data.product.name);

    // Test 6: Get All Products
    console.log('\n6. Testing Get Products...');
    const products = await axios.get(`${BASE_URL}/products`, { headers });
    console.log('✅ Products Count:', products.data.products.length);

    // Test 7: Create Kitchen
    console.log('\n7. Testing Create Kitchen...');
    const kitchenData = {
      name: 'Main Kitchen',
      location: 'Ground Floor',
      manager: 'Chef Ram',
      phone: '9876543210'
    };
    const kitchen = await axios.post(`${BASE_URL}/kitchens`, kitchenData, { headers });
    console.log('✅ Kitchen Created:', kitchen.data.kitchen.name);

    // Test 8: Get All Kitchens
    console.log('\n8. Testing Get Kitchens...');
    const kitchens = await axios.get(`${BASE_URL}/kitchens`, { headers });
    console.log('✅ Kitchens Count:', kitchens.data.kitchens.length);

    // Test 9: Create Bill
    console.log('\n9. Testing Create Bill...');
    const billData = {
      customer: {
        name: 'John Doe',
        phone: '9876543210'
      },
      kitchen: kitchen.data.kitchen._id,
      items: [{
        product: addQuantity.data.product._id,
        quantity: 5,
        price: 10
      }],
      totalAmount: 50,
      paymentMethod: 'Cash'
    };
    const bill = await axios.post(`${BASE_URL}/billing`, billData, { headers });
    console.log('✅ Bill Created:', bill.data.bill.billNumber);

    // Test 10: Get All Bills
    console.log('\n10. Testing Get Bills...');
    const bills = await axios.get(`${BASE_URL}/billing`, { headers });
    console.log('✅ Bills Count:', bills.data.bills.length);

    console.log('\n🎉 All API Tests Passed Successfully!');

  } catch (error) {
    console.error('❌ Test Failed:', error.response?.data?.message || error.message);
    process.exit(1);
  }
};

testAPI();