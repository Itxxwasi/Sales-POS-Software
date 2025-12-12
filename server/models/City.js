import mongoose from 'mongoose';

const CitySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

export const City = mongoose.model('City', CitySchema);
