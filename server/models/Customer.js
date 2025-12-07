import mongoose from 'mongoose';

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    contactNo: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    balance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

CustomerSchema.index({ name: 1 });
CustomerSchema.index({ contactNo: 1 });

export const Customer = mongoose.model('Customer', CustomerSchema);

