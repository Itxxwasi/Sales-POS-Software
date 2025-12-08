import mongoose from 'mongoose';

const WholeSaleSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true, index: true },
    date: { type: Date, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    items: [
      {
        code: String,
        name: String,
        pack: Number,
        quantity: Number,
        unitPrice: Number,
        price: Number,
        discountPercent: Number,
        discountRs: Number,
        taxPercent: Number,
        taxRs: Number,
        incentive: Number,
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
    balance: { type: Number, default: 0 },
    paymentMode: { type: String, default: 'Cash' },
    remarks: { type: String, default: '' },
    status: { type: String, default: 'active' }
  },
  { timestamps: true }
);

WholeSaleSchema.index({ date: -1 });
WholeSaleSchema.index({ customerId: 1 });
WholeSaleSchema.index({ branchId: 1 });

export const WholeSale = mongoose.model('WholeSale', WholeSaleSchema);

