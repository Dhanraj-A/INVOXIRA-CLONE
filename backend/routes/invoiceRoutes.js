const router  = require('express').Router()
const auth    = require('../middleware/auth')
const { Invoice } = require('../models/Models')

router.get('/', auth, async (req,res) => {
  try {
    const { from, to, status } = req.query
    const fy = req.headers['x-financial-year']
    let q = { user:req.user.id }
    if (fy) q.fy = fy
    if (from && to) q.date = { $gte:from, $lte:to }
    if (status) q.status = status
    res.json(await Invoice.find(q).sort({ createdAt:-1 }))
  } catch(e) { res.status(500).json({ message:e.message }) }
})

router.get('/next/number', auth, async (req,res) => {
  try {
    const fy = req.headers['x-financial-year']
    const q = { user:req.user.id }
    if (fy) q.fy = fy
    const last = await Invoice.findOne(q).sort({ createdAt:-1 })
    res.json({ next: String((last ? parseInt(last.invoiceNo)||0 : 0) + 1) })
  } catch(e) { res.status(500).json({ message:e.message }) }
})

router.post('/', auth, async (req,res) => {
  try {
    const fy = req.headers['x-financial-year']
    const dup = await Invoice.findOne({ invoiceNo:req.body.invoiceNo, user:req.user.id, ...(fy ? {fy} : {}) })
    if (dup) return res.status(400).json({ message:`Invoice ${req.body.invoiceNo} already exists` })
    res.status(201).json(await Invoice.create({ ...req.body, user:req.user.id, fy }))
  } catch(e) { res.status(500).json({ message:e.message }) }
})

router.put('/:id', auth, async (req,res) => {
  try { res.json(await Invoice.findOneAndUpdate({ _id:req.params.id, user:req.user.id }, req.body, { new:true })) }
  catch(e) { res.status(500).json({ message:e.message }) }
})

router.delete('/:id', auth, async (req,res) => {
  try { await Invoice.findOneAndDelete({ _id:req.params.id, user:req.user.id }); res.json({ message:'Deleted' }) }
  catch(e) { res.status(500).json({ message:e.message }) }
})

module.exports = router
