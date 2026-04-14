const router = require('express').Router()
const jwt    = require('jsonwebtoken')
const User   = require('../models/User')
const sign   = u => jwt.sign({ id:u._id, name:u.name, mobile:u.mobile, role:u.role }, process.env.JWT_SECRET, { expiresIn:'30d' })

router.post('/register', async (req,res) => {
  try {
    const { name, mobile, password } = req.body
    if (await User.findOne({ mobile })) return res.status(400).json({ message:'Mobile already registered' })
    const user = await User.create({ name, mobile, password })
    res.status(201).json({ token:sign(user), user:{ id:user._id, name:user.name, mobile:user.mobile, role:user.role } })
  } catch(e) { res.status(500).json({ message:e.message }) }
})

router.post('/login', async (req,res) => {
  try {
    const { mobile, password } = req.body
    const user = await User.findOne({ mobile })
    
    if (!user) {
      // Check Staff
      const { Staff } = require('../models/Models')
      const staffMem = await Staff.findOne({ mobile, password, active: true })
      if (!staffMem) return res.status(401).json({ message:'Invalid mobile or password' })
      
      const token = jwt.sign({ id:staffMem.user, isStaff:true, staffId:staffMem._id, name:staffMem.name, mobile:staffMem.mobile, role:staffMem.role }, process.env.JWT_SECRET, { expiresIn:'30d' })
      return res.json({ token, user:{ id:staffMem.user, name:staffMem.name, mobile:staffMem.mobile, role:staffMem.role } })
    }

    if (!(await user.matchPassword(password))) return res.status(401).json({ message:'Invalid mobile or password' })
    res.json({ token:sign(user), user:{ id:user._id, name:user.name, mobile:user.mobile, role:user.role } })
  } catch(e) { res.status(500).json({ message:e.message }) }
})

router.post('/reset-password', async (req,res) => {
  try {
    const user = await User.findOne({ mobile:req.body.mobile })
    if (!user) return res.status(404).json({ message:'Mobile not found' })
    user.password = req.body.newPassword; await user.save()
    res.json({ message:'Password reset successful' })
  } catch(e) { res.status(500).json({ message:e.message }) }
})

module.exports = router
