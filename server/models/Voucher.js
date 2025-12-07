import mongoose from 'mongoose';

const VoucherSchema = new mongoose.Schema(
  {
    voucherSr: { type: Number, required: true },
    voucherNo: { type: String, required: true, unique: true, index: true },
    date: { type: Date, required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    type: { type: String, default: '' },
    detail: { type: String, default: '' },
    entries: [
      {
        accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
        detail: { type: String, default: '' },
        debit: { type: Number, default: 0 },
        credit: { type: Number, default: 0 }
      }
    ],
    totalDebit: { type: Number, required: true, default: 0 },
    totalCredit: { type: Number, required: true, default: 0 }
  },
  { timestamps: true }
);

VoucherSchema.index({ voucherNo: 1 });
VoucherSchema.index({ date: -1 });
VoucherSchema.index({ branchId: 1 });

export const Voucher = mongoose.model('Voucher', VoucherSchema);

