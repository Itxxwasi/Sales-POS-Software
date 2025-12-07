import mongoose from 'mongoose';

const SubClassSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    sequence: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const SubClass = mongoose.model('SubClass', SubClassSchema);

