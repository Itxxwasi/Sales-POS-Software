import mongoose from 'mongoose';

const PurchaseReturnSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true, index: true },
    date: { type: Date, required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    items: [
      {
        code: String,
        name: String,
        pack: Number,
        quantity: Number,
        costPrice: Number,
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
    remarks: { type: String, default: '' }
  },
  { timestamps: true }
);

PurchaseReturnSchema.index({ invoiceNo: 1 });
PurchaseReturnSchema.index({ date: -1 });
PurchaseReturnSchema.index({ supplierId: 1 });

export const PurchaseReturn = mongoose.model('PurchaseReturn', PurchaseReturnSchema);

