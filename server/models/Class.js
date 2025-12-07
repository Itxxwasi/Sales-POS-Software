import mongoose from 'mongoose';

const ClassSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    sequence: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const Class = mongoose.model('Class', ClassSchema);

