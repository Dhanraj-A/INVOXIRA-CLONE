const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')
const S = new mongoose.Schema({
  name:     { type: String, required: true },
  mobile:   { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role:     { type: String, default: 'owner' }
}, { timestamps: true })
S.pre('save', async function(n) {
  if (!this.isModified('password')) return n()
  this.password = await bcrypt.hash(this.password, 10); n()
})
S.methods.matchPassword = function(p) { return bcrypt.compare(p, this.password) }
module.exports = mongoose.model('User', S)
