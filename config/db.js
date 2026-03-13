import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        });
        
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        
        // Create indexes for better performance
        try {
            await mongoose.connection.db.collection('products').createIndex({ name: 1 });
            await mongoose.connection.db.collection('products').createIndex({ category: 1 });
            await mongoose.connection.db.collection('products').createIndex({ inStock: 1, quantity: 1 });
        } catch (e) {
            console.log('Indexes already exist or failed to create');
        }

    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;