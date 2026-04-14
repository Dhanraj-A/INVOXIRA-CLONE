const mongoose = require('mongoose')
require('dotenv').config()
const User = require('./models/User')
const { Invoice, Purchase, Product, Customer, Supplier, Expense, Staff, Settings, CDN, ActivityLog } = require('./models/Models')

async function clear() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('✅ Connected to MongoDB')
  
  const models = [User, Invoice, Purchase, Product, Customer, Supplier, Expense, Staff, Settings, CDN, ActivityLog]
  await Promise.all(models.map(M => M.deleteMany({})))
  
  console.log('🗑️  All database collections cleared!')
  
  // Create Admin User
  const admin = await User.create({
    name: 'Admin User',
    mobile: '9999999999',
    password: 'admin123',
    role: 'owner'
  })
  
  console.log('👤 Admin account created:')
  console.log('   Mobile: 9999999999')
  console.log('   Pass:   admin123')
  console.log('💡 You can now log in with these credentials.')
  
  await mongoose.disconnect()
  process.exit(0)
}

clear().catch(e => {
  console.error('❌ Error clearing database:', e.message)
  process.exit(1)
})
