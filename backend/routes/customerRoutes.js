// customerRoutes.js
const express = require('express')
const auth    = require('../middleware/auth')
const { Customer } = require('../models/Models')
const r = express.Router()
r.get('/', auth, async (req,res) => { try { res.json(await Customer.find({ user:req.user.id }).sort({ name:1 })) } catch(e) { res.status(500).json({ message:e.message }) } })
r.post('/', auth, async (req,res) => { try { res.status(201).json(await Customer.create({ ...req.body, user:req.user.id })) } catch(e) { res.status(500).json({ message:e.message }) } })
r.put('/:id', auth, async (req,res) => { try { res.json(await Customer.findOneAndUpdate({ _id:req.params.id, user:req.user.id }, req.body, { new:true })) } catch(e) { res.status(500).json({ message:e.message }) } })
r.delete('/:id', auth, async (req,res) => { try { await Customer.findOneAndDelete({ _id:req.params.id, user:req.user.id }); res.json({ message:'Deleted' }) } catch(e) { res.status(500).json({ message:e.message }) } })
module.exports = r
