const express  = require('express')
const mongoose = require('mongoose')
const cors     = require('cors')
require('dotenv').config()

const app = express()

// Dynamic CORS to allow any subdomain of Vercel or the configured FRONTEND_URL
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === process.env.FRONTEND_URL || origin.endsWith('.vercel.app')) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))

app.use(express.json({ limit: '10mb' }))

// DB Connection & Auto-Seed Middleware
let isSeeded = false
const initDB = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log('🔄 Connecting to MongoDB Atlas...')
      if (!process.env.MONGO_URI) {
        console.error('❌ MONGO_URI environment variable is not set!')
        return res.status(503).json({ message: 'Database not configured. MONGO_URI is missing.' })
      }
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000
      })
      console.log('✅ Connected.')
    }
  } catch (dbErr) {
    console.error('❌ MongoDB connection failed:', dbErr.message)
    return res.status(503).json({ message: 'Cannot connect to database. Please check MongoDB Atlas IP whitelist and connection string.' })
  }
  
  if (!isSeeded) {
    try {
      const User = require('./models/User')
      const adminExists = await User.findOne({ mobile: '9999999999' })
      if (!adminExists) {
        console.log('🌱 Admin user not found. Creating default admin for Invoxira...')
        await User.create({
          name: 'Admin User',
          mobile: '9999999999',
          password: 'admin123',
          role: 'owner'
        })
        console.log('✅ Admin account created: 9999999999 / admin123')
      }
      isSeeded = true
    } catch (err) {
      console.error('❌ Auto-seed error:', err.message)
    }
  }
  next()
}

app.use(initDB)

app.use('/api/auth',      require('./routes/authRoutes'))
app.use('/api/invoices',  require('./routes/invoiceRoutes'))
app.use('/api/purchases', require('./routes/purchaseRoutes'))
app.use('/api/products',  require('./routes/productRoutes'))
app.use('/api/customers', require('./routes/customerRoutes'))
app.use('/api/suppliers', require('./routes/supplierRoutes'))
app.use('/api/expenses',  require('./routes/expenseRoutes'))
app.use('/api/staff',     require('./routes/staffRoutes'))
app.use('/api/settings',  require('./routes/settingsRoutes'))
app.use('/api/cdn',       require('./routes/cdnRoutes'))
app.use('/api/activity',  require('./routes/activityRoutes'))

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'Invoxira Cloud' }))
app.use((req, res) => res.status(404).json({ message: 'Not found' }))

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const port = process.env.PORT || 5000
  app.listen(port, () => console.log(`🚀 Server running on port ${port}`))
}

module.exports = app
