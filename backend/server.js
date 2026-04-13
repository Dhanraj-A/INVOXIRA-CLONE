import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())

// Basic Routes
app.get('/api', (req, res) => {
  res.json({ message: 'Invoxira API Server', status: 'running' })
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
