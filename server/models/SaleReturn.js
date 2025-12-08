import mongoose from 'mongoose';

const SaleReturnSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true, index: true },
    date: { type: Date, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    dcNo: { type: String, default: '' },
    biltyNo: { type: String, default: '' },
    transporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transporter' },
    items: [
      {
        code: String,
        name: String,
        pack: Number,
        quantity: Number,
        price: Number,
        discountPercent: Number,
        discountRs: Number,
        taxPercent: Number,
        taxRs: Number,
        subtotal: Number,
        netTotal: Number,
        store: String,
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
        remarks: String
      }
    ],
    total: { type: Number, required: true, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountRs: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    taxRs: { type: Number, default: 0 },
    misc: { type: Number, default: 0 },
    freight: { type: Number, default: 0 },
    netTotal: { type: Number, required: true, default: 0 },
    paid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    paymentMode: { type: String, default: 'Credit' },
    remarks: { type: String, default: '' }
  },
  { timestamps: true }
);

SaleReturnSchema.index({ date: -1 });
SaleReturnSchema.index({ customerId: 1 });

export const SaleReturn = mongoose.model('SaleReturn', SaleReturnSchema);

