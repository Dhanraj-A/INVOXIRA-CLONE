const router = require('express').Router()
const auth   = require('../middleware/auth')
const { Purchase } = require('../models/Models')

router.get('/', auth, async (req,res) => {
  try {
    const { from, to } = req.query; let q = { user:req.user.id }
    const fy = req.headers['x-financial-year']
    if (fy) q.fy = fy
    if (from && to) q.date = { $gte:from, $lte:to }
    res.json(await Purchase.find(q).sort({ createdAt:-1 }))
  } catch(e) { res.status(500).json({ message:e.message }) }
})
router.get('/next/number', auth, async (req,res) => {
  try {
    const fy = req.headers['x-financial-year']
    const q = { user:req.user.id }
    if (fy) q.fy = fy
    const last = await Purchase.findOne(q).sort({ createdAt:-1 })
    res.json({ next: String((last ? parseInt(last.purchaseNo)||0 : 0) + 1) })
  } catch(e) { res.status(500).json({ message:e.message }) }
})
router.post('/', auth, async (req,res) => {
  try {
    const fy = req.headers['x-financial-year']
    res.status(201).json(await Purchase.create({ ...req.body, user:req.user.id, fy }))
  } catch(e) { res.status(500).json({ message:e.message }) }
})
router.put('/:id', auth, async (req,res) => {
  try { res.json(await Purchase.findOneAndUpdate({ _id:req.params.id, user:req.user.id }, req.body, { new:true })) }
  catch(e) { res.status(500).json({ message:e.message }) }
})
router.delete('/:id', auth, async (req,res) => {
  try { await Purchase.findOneAndDelete({ _id:req.params.id, user:req.user.id }); res.json({ message:'Deleted' }) }
  catch(e) { res.status(500).json({ message:e.message }) }
})
module.exports = router
