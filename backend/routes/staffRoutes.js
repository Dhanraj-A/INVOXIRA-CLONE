const express = require('express')
const auth    = require('../middleware/auth')
const { Staff } = require('../models/Models')
const r = express.Router()
r.get('/', auth, async (req,res) => { try { res.json(await Staff.find({ user:req.user.id })) } catch(e) { res.status(500).json({ message:e.message }) } })
r.post('/', auth, async (req,res) => { try { res.status(201).json(await Staff.create({ ...req.body, user:req.user.id })) } catch(e) { res.status(500).json({ message:e.message }) } })
r.put('/:id', auth, async (req,res) => { try { res.json(await Staff.findOneAndUpdate({ _id:req.params.id, user:req.user.id }, req.body, { new:true })) } catch(e) { res.status(500).json({ message:e.message }) } })
r.post('/:id/attendance', auth, async (req,res) => {
  try {
    const { date, status } = req.body
    const s = await Staff.findOne({ _id:req.params.id, user:req.user.id })
    if (!s) return res.status(404).json({ message:'Not found' })
    const i = s.attendance.findIndex(a => a.date === date)
    if (i >= 0) s.attendance[i].status = status
    else s.attendance.push({ date, status })
    await s.save(); res.json(s)
  } catch(e) { res.status(500).json({ message:e.message }) }
})
r.delete('/:id', auth, async (req,res) => { try { await Staff.findOneAndDelete({ _id:req.params.id, user:req.user.id }); res.json({ message:'Deleted' }) } catch(e) { res.status(500).json({ message:e.message }) } })
module.exports = r
