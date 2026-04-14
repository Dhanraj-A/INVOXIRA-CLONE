const express = require('express')
const auth    = require('../middleware/auth')
const { Expense } = require('../models/Models')
const r = express.Router()
r.get('/', auth, async (req,res) => {
  try {
    const { from, to } = req.query; let q = { user:req.user.id }
    const fy = req.headers['x-financial-year']
    if (fy) q.fy = fy
    if (from && to) q.date = { $gte:from, $lte:to }
    res.json(await Expense.find(q).sort({ date:-1 }))
  } catch(e) { res.status(500).json({ message:e.message }) }
})
r.post('/', auth, async (req,res) => {
  try {
    const fy = req.headers['x-financial-year']
    res.status(201).json(await Expense.create({ ...req.body, user:req.user.id, fy }))
  } catch(e) { res.status(500).json({ message:e.message }) }
})
r.put('/:id', auth, async (req,res) => { try { res.json(await Expense.findOneAndUpdate({ _id:req.params.id, user:req.user.id }, req.body, { new:true })) } catch(e) { res.status(500).json({ message:e.message }) } })
r.delete('/:id', auth, async (req,res) => { try { await Expense.findOneAndDelete({ _id:req.params.id, user:req.user.id }); res.json({ message:'Deleted' }) } catch(e) { res.status(500).json({ message:e.message }) } })
module.exports = r
