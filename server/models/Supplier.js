import mongoose from 'mongoose';

const SupplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    contact: { type: String, default: '' },
    phone: { type: String, default: '' },
    mobileNo: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    strn: { type: String, default: '' },
    ntn: { type: String, default: '' },
    whtType: { type: String, default: '' },
    whtPercent: { type: Number, default: 0 },
    advTaxPercent: { type: Number, default: 0 },
    category: { type: String, default: '' },
    subCategory: { type: String, default: '' },
    opening: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    finished: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Supplier = mongoose.model('Supplier', SupplierSchema);
