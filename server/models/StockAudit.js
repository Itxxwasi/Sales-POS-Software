import mongoose from 'mongoose';

const StockAuditSchema = new mongoose.Schema(
  {
    auditNo: { type: String, required: true, unique: true, index: true },
    date: { type: Date, required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    items: [
      {
        store: String,
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
        code: String,
        name: String,
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
        prePack: { type: Number, default: 0 },
        newPack: { type: Number, required: true, default: 0 },
        difference: { type: Number, default: 0 },
        costPrice: { type: Number, default: 0 },
        salePrice: { type: Number, default: 0 },
        remarks: { type: String, default: '' }
      }
    ],
    status: { type: String, default: 'un-audit', enum: ['un-audit', 'posted'] },
    remarks: { type: String, default: '' }
  },
  { timestamps: true }
);

StockAuditSchema.index({ auditNo: 1 });
StockAuditSchema.index({ date: -1 });
StockAuditSchema.index({ branchId: 1 });
StockAuditSchema.index({ status: 1 });

export const StockAudit = mongoose.model('StockAudit', StockAuditSchema);

