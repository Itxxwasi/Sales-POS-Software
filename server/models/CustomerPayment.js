import mongoose from 'mongoose';

const CustomerPaymentSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    type: { type: String, required: true, enum: ['Received', 'Pay'], default: 'Received' },
    amount: { type: Number, required: true, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountRs: { type: Number, default: 0 },
    preBalance: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    paymentMode: { type: String, default: 'Cash' },
    cashAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    cashInHand: { type: Number, default: 0 },
    remarks: { type: String, default: '' }
  },
  { timestamps: true }
);

CustomerPaymentSchema.index({ date: -1 });
CustomerPaymentSchema.index({ customerId: 1 });
CustomerPaymentSchema.index({ branchId: 1 });

export const CustomerPayment = mongoose.model('CustomerPayment', CustomerPaymentSchema);

