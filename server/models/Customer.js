import mongoose from 'mongoose';

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, unique: true }, // Added code
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }, // Added branch
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'City' }, // Added city
    address: { type: String, default: '' },
    phoneNo: { type: String, default: '' }, // Renamed from contactNo but keeping contactNo as alias maybe? No, let's use phoneNo and mobileNo as requested
    mobileNo: { type: String, default: '' },
    cnic: { type: String, default: '' },
    ntn: { type: String, default: '' },
    strn: { type: String, default: '' },
    openingBalance: { type: Number, default: 0 },
    creditLimit: { type: Number, default: 0 },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerCategory' }, // Added category
    type: { type: String, default: '' }, // e.g. Distributor, Retailer
    isActive: { type: Boolean, default: true },
    isCash: { type: Boolean, default: false }, // Cash checkbox
    balance: { type: Number, default: 0 } // Current balance
  },
  { timestamps: true }
);

CustomerSchema.index({ name: 1 });
CustomerSchema.index({ code: 1 });
CustomerSchema.index({ phoneNo: 1 });
CustomerSchema.index({ mobileNo: 1 });

export const Customer = mongoose.model('Customer', CustomerSchema);

