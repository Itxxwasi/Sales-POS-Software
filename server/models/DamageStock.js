import mongoose from 'mongoose';

const DamageStockSchema = new mongoose.Schema(
  {
    damageNo: { type: String, required: true, unique: true, index: true },
    date: { type: Date, required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    items: [
      {
        store: String,
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
        code: String,
        name: String,
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
        preQty: { type: Number, default: 0 },
        damageQty: { type: Number, required: true, default: 0 },
        difference: { type: Number, default: 0 },
        remarks: { type: String, default: '' }
      }
    ],
    remarks: { type: String, default: '' }
  },
  { timestamps: true }
);

DamageStockSchema.index({ damageNo: 1 });
DamageStockSchema.index({ date: -1 });
DamageStockSchema.index({ branchId: 1 });

export const DamageStock = mongoose.model('DamageStock', DamageStockSchema);

