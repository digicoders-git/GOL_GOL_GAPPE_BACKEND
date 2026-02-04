import mongoose from 'mongoose';
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);

        // Cleanup: Remove legacy unique username index if it exists
        try {
            const collections = await mongoose.connection.db.listCollections({ name: 'users' }).toArray();
            if (collections.length > 0) {
                await mongoose.connection.db.collection('users').dropIndex('username_1');
                console.log('Legacy username index dropped successfully');
            }
        } catch (e) {
            // Index doesn't exist, ignore
        }

    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;