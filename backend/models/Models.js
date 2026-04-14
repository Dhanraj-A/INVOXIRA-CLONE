const mongoose = require('mongoose')

const ItemSch = new mongoose.Schema({ name:String, hsn:String, qty:{type:Number,default:1}, unit:{type:String,default:'Nos'}, price:{type:Number,default:0}, discount:{type:Number,default:0}, gstRate:{type:Number,default:18}, amount:{type:Number,default:0} })

const InvoiceSchema = new mongoose.Schema({
  invoiceNo:String, date:String, dueDate:String, paymentType:{type:String,default:'Cash'},
  status:{type:String,default:'pending'}, custSearch:String,
  customer:{ _id:String, name:String, mobile:String, gstin:String, address:String },
  items:[ItemSch], transport:{type:Number,default:0}, roundOff:{type:Number,default:0},
  grandTotal:{type:Number,default:0}, received:{type:Number,default:0}, stateOfSupply:String, shipTo:String,
  poNo:String, eWayBill:String, vehicleNo:String, notes:String, termsConditions:String,
  user:{ type:mongoose.Schema.Types.ObjectId, ref:'User' },
  fy:String
}, { timestamps:true })

const PurchaseSchema = new mongoose.Schema({
  purchaseNo:String, date:String, dueDate:String, paymentType:{type:String,default:'Cash'},
  status:{type:String,default:'pending'}, suppSearch:String,
  supplier:{ _id:String, name:String, mobile:String, gstin:String, address:String },
  items:[ItemSch], transport:{type:Number,default:0}, roundOff:{type:Number,default:0},
  grandTotal:{type:Number,default:0}, received:{type:Number,default:0}, stateOfSupply:String, notes:String, termsConditions:String,
  user:{ type:mongoose.Schema.Types.ObjectId, ref:'User' },
  fy:String
}, { timestamps:true })

const ProductSchema = new mongoose.Schema({
  name:String, sku:String, cat:{type:String,default:'General'}, hsn:String,
  unit:{type:String,default:'Nos'}, stock:{type:Number,default:0}, addStock:{type:Number,default:0}, min:{type:Number,default:5},
  price:{type:Number,default:0}, cost:{type:Number,default:0}, gst:{type:Number,default:18},
  bar:String, user:{ type:mongoose.Schema.Types.ObjectId, ref:'User' }
}, { timestamps:true })

const CustomerSchema = new mongoose.Schema({
  name:String, mobile:String, email:String, gstin:String, address:String,
  city:String, state:String, balance:{type:Number,default:0},
  user:{ type:mongoose.Schema.Types.ObjectId, ref:'User' }
}, { timestamps:true })

const SupplierSchema = new mongoose.Schema({
  name:String, mobile:String, email:String, gstin:String, address:String,
  city:String, state:String, balance:{type:Number,default:0},
  user:{ type:mongoose.Schema.Types.ObjectId, ref:'User' }
}, { timestamps:true })

const ExpenseSchema = new mongoose.Schema({
  name:String, cat:{type:String,default:'General'}, amount:{type:Number,default:0},
  date:String, note:String, payMode:{type:String,default:'Cash'},
  user:{ type:mongoose.Schema.Types.ObjectId, ref:'User' },
  fy:String
}, { timestamps:true })

const StaffSchema = new mongoose.Schema({
  name:String, role:{type:String,default:'Staff'}, dept:{type:String,default:'General'},
  mobile:String, email:String, password:String, salary:{type:Number,default:0}, joinDate:String,
  address:String, active:{type:Boolean,default:true},
  attendance:[{ date:String, status:{type:String,default:'P'} }],
  user:{ type:mongoose.Schema.Types.ObjectId, ref:'User' },
  fy:String
}, { timestamps:true })

const SettingsSchema = new mongoose.Schema({
  user:{ type:mongoose.Schema.Types.ObjectId, ref:'User', unique:true },
  businessName:{type:String,default:'Invoxira Cloud'}, ownerName:String,
  gstin:String, mobile:String, email:String, address:String, city:String,
  state:String, pincode:String, logo:String, signature:String,
  bankName:String, accountNo:String, ifsc:String, upi:String,
  printTheme:{type:String,default:'classic'},
  inventoryCategories:{type:[String], default:['Electronics', 'Clothing', 'Furniture', 'Accessories', 'Hardware', 'Stationery', 'Food & Beverage', 'General']},
  expenseCategories:{type:[String], default:['Rent', 'Salary', 'Electricity', 'Internet', 'Transport', 'Stationery', 'Maintenance', 'Marketing', 'Food', 'Miscellaneous']}
}, { timestamps:true })

const ActivityLogSchema = new mongoose.Schema({
  action: String,
  detail: String,
  user: String,
  role: String,
  time: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

const CDNSchema = new mongoose.Schema({
  type:{type:String,default:'Credit Note'}, number:String, date:String,
  partyName:String, reason:String, refInvoice:String, amount:{type:Number,default:0}, notes:String,
  user:{ type:mongoose.Schema.Types.ObjectId, ref:'User' },
  fy:String
}, { timestamps:true })

module.exports = {
  Invoice:  mongoose.model('Invoice',  InvoiceSchema),
  Purchase: mongoose.model('Purchase', PurchaseSchema),
  Product:  mongoose.model('Product',  ProductSchema),
  Customer: mongoose.model('Customer', CustomerSchema),
  Supplier: mongoose.model('Supplier', SupplierSchema),
  Expense:  mongoose.model('Expense',  ExpenseSchema),
  Staff:    mongoose.model('Staff',    StaffSchema),
  Settings: mongoose.model('Settings', SettingsSchema),
  CDN:      mongoose.model('CDN',      CDNSchema),
  ActivityLog: mongoose.model('ActivityLog', ActivityLogSchema),
}
