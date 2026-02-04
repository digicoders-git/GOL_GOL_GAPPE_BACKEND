import mongoose from 'mongoose';

const userInventorySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    }
}, {
    timestamps: true
});

// Index for faster lookups
userInventorySchema.index({ user: 1, product: 1 }, { unique: true });

export default mongoose.model('UserInventory', userInventorySchema);
