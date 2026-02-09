import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
    mobile: {
        type: String,
        required: true,
        trim: true
    },
    otp: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300 // OTP expires in 5 minutes (300 seconds)
    }
});

export default mongoose.model('Otp', otpSchema);
