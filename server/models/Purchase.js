import mongoose from 'mongoose';

const PurchaseSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true, index: true },
    date: { type: Date, required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    refNo: { type: String, default: '' },
    biltyNo: { type: String, default: '' },
    items: [
      {
        code: String,
        name: String,
        pack: Number,
        quantity: Number,
        costPrice: Number,
        salePrice: Number,
        unitPrice: Number,
        discountPercent: Number,
        discountRs: Number,
        taxPercent: Number,
        taxRs: Number,
        subtotal: Number,
        netTotal: Number,
        store: String,
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }
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
    invBalance: { type: Number, default: 0 },
    preBalance: { type: Number, default: 0 },
    newBalance: { type: Number, default: 0 },
    paymentMode: { type: String, default: 'Credit' },
    status: { type: String, default: 'unposted', enum: ['unposted', 'posted'] },
    remarks: { type: String, default: '' }
  },
  { timestamps: true }
);

PurchaseSchema.index({ invoiceNo: 1 });
PurchaseSchema.index({ date: -1 });
PurchaseSchema.index({ supplierId: 1 });
PurchaseSchema.index({ status: 1 });

export const Purchase = mongoose.model('Purchase', PurchaseSchema);

