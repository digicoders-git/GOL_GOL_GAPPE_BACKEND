import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const cleanup = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Delete from stocktransfers
    const transferResult = await mongoose.connection.collection('stocktransfers').deleteMany({ product: null });
    console.log(`Deleted ${transferResult.deletedCount} records from stocktransfers`);

    // Delete from kitchens assignedProducts
    const kitchenResult = await mongoose.connection.collection('kitchens').updateMany(
      {},
      { $pull: { assignedProducts: { product: null } } }
    );
    console.log(`Updated ${kitchenResult.modifiedCount} kitchens`);

    // Delete from userinventories
    const inventoryResult = await mongoose.connection.collection('userinventories').deleteMany({ product: null });
    console.log(`Deleted ${inventoryResult.deletedCount} records from userinventories`);

    console.log('Cleanup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Cleanup error:', error);
    process.exit(1);
  }
};

cleanup();
