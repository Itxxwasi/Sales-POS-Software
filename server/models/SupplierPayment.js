import mongoose from 'mongoose';

const SupplierPaymentSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    type: { type: String, required: true, enum: ['Pay', 'Received'], default: 'Pay' },
    amount: { type: Number, required: true, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountRs: { type: Number, default: 0 },
    preBalance: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    paymentMode: { type: String, default: 'Cash' },
    cashAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    bankName: { type: String, default: '' },
    cashInHand: { type: Number, default: 0 },
    remarks: { type: String, default: '' }
  },
  { timestamps: true }
);

SupplierPaymentSchema.index({ date: -1 });
SupplierPaymentSchema.index({ supplierId: 1 });
SupplierPaymentSchema.index({ branchId: 1 });

export const SupplierPayment = mongoose.model('SupplierPayment', SupplierPaymentSchema);

