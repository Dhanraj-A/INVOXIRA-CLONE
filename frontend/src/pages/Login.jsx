import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../api'

export default function Login() {
  const nav = useNavigate()
  const [mobile,  setMobile]  = useState('')
  const [pass,    setPass]    = useState('')
  const [showPw,  setShowPw]  = useState(false)
  const [err,     setErr]     = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName]       = useState('')

  const biz = JSON.parse(localStorage.getItem('inv_biz') || '{}')

  async function submit(e) {
    e.preventDefault()
    setErr(''); setLoading(true)
    try {
      if (isRegister) {
        if (!name) return setErr('Name is required')
        const { data } = await authAPI.register({ name, mobile, password: pass })
        localStorage.setItem('inv_token', data.token)
        localStorage.setItem('inv_user', JSON.stringify(data.user))
        window.location.href = '/dashboard'
      } else {
        const { data } = await authAPI.login({ mobile, password: pass })
        localStorage.setItem('inv_token', data.token)
        localStorage.setItem('inv_user',  JSON.stringify(data.user))
        window.location.href = '/dashboard'
      }
    } catch (e) {
      if (!e.response) {
        setErr('Cannot connect to server. Make sure the backend is running!');
      } else if (typeof e.response.data === 'string' && e.response.data.includes('<html')) {
        setErr('Vercel Server Error (500 or 504). Please go to MongoDB Atlas -> Network Access -> Add IP Address 0.0.0.0/0 so Vercel can connect to the database!');
      } else {
        setErr(e.response?.data?.message || 'Invalid mobile or password');
      }
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#1565C0 0%,#1976D2 50%,#42A5F5 100%)', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:12, padding:36, width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          {biz.logo
            ? <img src={biz.logo} alt="logo" style={{ height:56, borderRadius:10, marginBottom:10 }} />
            : <div style={{ width:60, height:60, background:'linear-gradient(135deg,#1565C0,#42A5F5)', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, fontWeight:800, color:'#fff', margin:'0 auto 12px' }}>I</div>
          }
          <div style={{ fontSize:24, fontWeight:800, color:'#1565C0' }}>{biz.businessName || 'Invoxira Cloud'}</div>
          {biz.ownerName && <div style={{ fontSize:13, color:'#757575', marginTop:2 }}>{biz.ownerName}</div>}
          <div style={{ fontSize:12, color:'#9E9E9E', marginTop:4 }}>Business Management Suite</div>
        </div>

        {err && <div style={{ padding:'10px 14px', background:'#FFEBEE', color:'#C62828', borderRadius:6, marginBottom:14, fontSize:13, fontWeight:600 }}>{err}</div>}

        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {isRegister && (
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#757575', display:'block', marginBottom:5 }}>Your Name</label>
              <input type="text" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} required={isRegister}
                style={{ width:'100%', padding:'11px 14px', border:'1px solid #E0E0E0', borderRadius:6, fontSize:14, outline:'none' }} />
            </div>
          )}
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#757575', display:'block', marginBottom:5 }}>Mobile Number</label>
            <input type="tel" placeholder="10-digit mobile number" value={mobile} onChange={e=>setMobile(e.target.value)} required maxLength={10}
              style={{ width:'100%', padding:'11px 14px', border:'1px solid #E0E0E0', borderRadius:6, fontSize:14, outline:'none' }} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#757575', display:'block', marginBottom:5 }}>Password</label>
            <div style={{ position:'relative' }}>
              <input type={showPw?'text':'password'} placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} required
                style={{ width:'100%', padding:'11px 44px 11px 14px', border:'1px solid #E0E0E0', borderRadius:6, fontSize:14, outline:'none' }} />
              <button type="button" onClick={()=>setShowPw(!showPw)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', fontSize:18, color:'#9E9E9E', cursor:'pointer' }}>
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            style={{ padding:13, background:'#1976D2', color:'#fff', border:'none', borderRadius:6, fontWeight:700, fontSize:15, cursor:'pointer', marginTop:4 }}>
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Login →'}
          </button>
        </form>
        
        <div style={{ textAlign:'center', marginTop:16 }}>
          <button type="button" onClick={() => { setIsRegister(!isRegister); setErr('') }} style={{ background:'none', border:'none', color:'#1976D2', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            {isRegister ? 'Already have an account? Login' : 'Need an account? Register'}
          </button>
        </div>
        <div style={{ textAlign:'center', marginTop:20, fontSize:11, color:'#BDBDBD' }}>© 2026 Invoxira Cloud · All rights reserved</div>
      </div>
    </div>
  )
}
