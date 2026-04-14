const express = require('express')
const auth    = require('../middleware/auth')
const { ActivityLog } = require('../models/Models')
const r = express.Router()

// GET all logs for the current user
r.get('/', auth, async (req,res) => {
  try {
    const logs = await ActivityLog.find({ createdBy: req.user.id })
      .sort({ time: -1 })
      .limit(100)
    res.json(logs)
  } catch(e) { res.status(500).json({ message: e.message }) }
})

// POST a new log entry
r.post('/', auth, async (req,res) => {
  try {
    const log = await ActivityLog.create({
      ...req.body,
      createdBy: req.user.id
    })
    res.status(201).json(log)
  } catch(e) { res.status(500).json({ message: e.message }) }
})

// DELETE clear all logs for the user
r.delete('/', auth, async (req,res) => {
  try {
    await ActivityLog.deleteMany({ createdBy: req.user.id })
    res.json({ message: 'Logs cleared' })
  } catch(e) { res.status(500).json({ message: e.message }) }
})

module.exports = r
