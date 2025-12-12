import mongoose from 'mongoose';

const ItemSchema = new mongoose.Schema(
  {
    itemCode: { type: String, required: true, unique: true, index: true },
    itemName: { type: String, required: true },
    givenPcsBarCode: { type: String, default: '' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    subclassId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubClass' },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    costPrice: { type: Number, default: 0 },
    salePrice: { type: Number, default: 0 },
    retailPrice: { type: Number, default: 0 },
    incentive: { type: Number, default: 0 },
    stock: [
      {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
        storeName: { type: String },
        stockInHand: { type: Number, default: 0 },
        opening: { type: Number, default: 0 }
      }
    ],
    isActive: { type: Boolean, default: true },
    sequence: { type: Number, default: 0 }
  },
  { timestamps: true }
);

ItemSchema.index({ givenPcsBarCode: 1 });

export const Item = mongoose.model('Item', ItemSchema);

