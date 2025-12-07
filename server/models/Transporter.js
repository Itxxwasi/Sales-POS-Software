import mongoose from 'mongoose';

const TransporterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    contact: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Transporter = mongoose.model('Transporter', TransporterSchema);

