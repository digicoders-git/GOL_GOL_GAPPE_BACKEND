import mongoose from 'mongoose';
import Order from './models/Order.js';

const updateOrderStatus = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/GolGolGappa');
    console.log('Connected to MongoDB');

    const result = await Order.updateOne(
      { _id: '69d3b138d4ea43e25423d1db' },
      { 
        $set: { 
          paymentStatus: 'Completed'
        } 
      }
    );

    console.log('Update result:', result);
    
    const updatedOrder = await Order.findById('69d3b138d4ea43e25423d1db');
    console.log('Updated order:', updatedOrder);

    await mongoose.connection.close();
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

updateOrderStatus();
