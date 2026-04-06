import mongoose from 'mongoose';

const stockTransferSchema = new mongoose.Schema({
    fromUser: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'fromUserModel',
        required: true
    },
    fromUserModel: {
        type: String,
        enum: ['User', 'Admin'],
        default: 'Admin'
    },
    toUser: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'toUserModel',
        required: true
    },
    toUserModel: {
        type: String,
        enum: ['User', 'Admin'],
        default: 'Admin'
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    notes: String
}, {
    timestamps: true
});

export default mongoose.model('StockTransfer', stockTransferSchema);
