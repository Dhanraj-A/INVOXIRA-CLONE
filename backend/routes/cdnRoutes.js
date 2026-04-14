const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const { CDN } = require('../models/Models')

router.use(auth)

router.get('/', async (req, res) => {
  try {
    const fy = req.headers['x-financial-year']
    const q = { user: req.user.id }
    if (fy) q.fy = fy
    const notes = await CDN.find(q).sort('-createdAt')
    res.json(notes)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.post('/', async (req, res) => {
  try {
    const fy = req.headers['x-financial-year']
    const note = await CDN.create({ ...req.body, user: req.user.id, fy })
    res.status(201).json(note)
  } catch (err) { res.status(400).json({ message: err.message }) }
})

router.put('/:id', async (req, res) => {
  try {
    const note = await CDN.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, req.body, { new: true })
    if (!note) return res.status(404).json({ message: 'Note not found' })
    res.json(note)
  } catch (err) { res.status(400).json({ message: err.message }) }
})

router.delete('/:id', async (req, res) => {
  try {
    const note = await CDN.findOneAndDelete({ _id: req.params.id, user: req.user.id })
    if (!note) return res.status(404).json({ message: 'Note not found' })
    res.json({ message: 'Deleted' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
