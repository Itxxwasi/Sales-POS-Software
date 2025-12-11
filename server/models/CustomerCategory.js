import mongoose from 'mongoose';

const CustomerCategorySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
        description: { type: String, default: '' },
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

export const CustomerCategory = mongoose.model('CustomerCategory', CustomerCategorySchema);
