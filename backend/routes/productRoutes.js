const router = require('express').Router()
const auth   = require('../middleware/auth')
const { Product } = require('../models/Models')
router.get('/', auth, async (req,res) => {
  try { res.json(await Product.find({ user:req.user.id }).sort({ name:1 })) }
  catch(e) { res.status(500).json({ message:e.message }) }
})
router.post('/', auth, async (req,res) => {
  try { res.status(201).json(await Product.create({ ...req.body, user:req.user.id })) }
  catch(e) { res.status(500).json({ message:e.message }) }
})
router.put('/:id', auth, async (req,res) => {
  try { res.json(await Product.findOneAndUpdate({ _id:req.params.id, user:req.user.id }, req.body, { new:true })) }
  catch(e) { res.status(500).json({ message:e.message }) }
})
router.delete('/:id', auth, async (req,res) => {
  try { await Product.findOneAndDelete({ _id:req.params.id, user:req.user.id }); res.json({ message:'Deleted' }) }
  catch(e) { res.status(500).json({ message:e.message }) }
})
module.exports = router
