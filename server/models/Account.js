import mongoose from 'mongoose';

const AccountSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, default: '' },
    description: { type: String, default: '' },
    balance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

AccountSchema.index({ name: 1 });

export const Account = mongoose.model('Account', AccountSchema);

