const express = require('express')
const auth    = require('../middleware/auth')
const { Settings } = require('../models/Models')
const r = express.Router()
r.get('/', auth, async (req,res) => {
  try {
    let s = await Settings.findOne({ user:req.user.id })
    if (!s) s = await Settings.create({ user:req.user.id })
    res.json(s)
  } catch(e) { res.status(500).json({ message:e.message }) }
})
r.put('/', auth, async (req,res) => {
  try {
    const s = await Settings.findOneAndUpdate({ user:req.user.id }, { ...req.body, user:req.user.id }, { new:true, upsert:true })
    res.json(s)
  } catch(e) { res.status(500).json({ message:e.message }) }
})
module.exports = r
