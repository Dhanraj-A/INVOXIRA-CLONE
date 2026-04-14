import { useState, useEffect } from 'react'
import {
  getFinancialYear, getFYLabel, getFYRange, getAllStoredYears,
  isFYClosed, closeFinancialYear, getArchive, getActiveFY,
  setActiveFY, migrateOldData, fyGet, isOwnerOrManager
} from '../utils/fy'

// ═══════════════════════════════════════════════════════════════
// FINANCIAL YEAR MANAGER COMPONENT
// Place this in Settings page or Layout header
// ═══════════════════════════════════════════════════════════════
export default function FinancialYearManager({ compact = false }) {
  const [activeFY,    setActiveFYState] = useState(getActiveFY())
  const [allYears,    setAllYears]      = useState([])
  const [showModal,   setShowModal]     = useState(false)
  const [msg,         setMsg]           = useState('')
  const [msgType,     setMsgType]       = useState('success')
  const [closing,     setClosing]       = useState(false)
  const [showArchive, setShowArchive]   = useState(null)

  const currentFY = getFinancialYear()

  useEffect(() => {
    migrateOldData()
    setAllYears(getAllStoredYears())
    // Listen for FY changes from other components
    const handler = (e) => {
      setActiveFYState(e.detail.fy)
      setAllYears(getAllStoredYears())
    }
    window.addEventListener('fy_changed', handler)
    return () => window.removeEventListener('fy_changed', handler)
  }, [])

  function switchFY(fy) {
    setActiveFY(fy)
    setActiveFYState(fy)
    setAllYears(getAllStoredYears())
    showMsg(`Switched to FY ${getFYLabel(fy)}`, 'success')
  }

  function showMsg(text, type = 'success') {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 4000)
  }

  function getStats(fy) {
    const sales     = fyGet('sales',     fy)
    const purchases = fyGet('purchases', fy)
    const expenses  = fyGet('expenses',  fy)
    const totalSale = sales.reduce((s,i)=>s+(i.grandTotal||0),0)
    const totalPur  = purchases.reduce((s,p)=>s+(p.grandTotal||0),0)
    const totalExp  = expenses.reduce((s,e)=>s+(e.amount||0),0)
    return { sales: sales.length, purchases: purchases.length, expenses: expenses.length, totalSale, totalPur, totalExp }
  }

  const stats   = getStats(activeFY)
  const { from, to } = getFYRange(activeFY)

  // ── COMPACT MODE (for topbar/header) ─────────────────────
  if (compact) return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>FY:</span>
      <select value={activeFY} onChange={e=>switchFY(e.target.value)}
        style={{ padding:'3px 8px', borderRadius:4, border:'1px solid rgba(255,255,255,0.3)', background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:12, cursor:'pointer' }}>
        {allYears.map(fy => (
          <option key={fy} value={fy} style={{ color:'#212121', background:'#fff' }}>
            {getFYLabel(fy)} {isFYClosed(fy)?'🔒':''} {fy===currentFY?'(Current)':''}
          </option>
        ))}
      </select>
    </div>
  )

  // ── FULL MODE (for Settings page) ────────────────────────
  return (
    <div>
      {msg && (
        <div style={{ padding:'10px 14px', background:msgType==='success'?'#E8F5E9':'#FFEBEE', color:msgType==='success'?'#2E7D32':'#C62828', borderRadius:6, marginBottom:14, fontWeight:600, fontSize:13 }}>
          {msg}
        </div>
      )}

      <div className="card" style={{ padding:20 }}>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:16, color:'#1565C0' }}>📅 Financial Year Manager</div>

        {/* Current FY Info */}
        <div style={{ background:'#E3F2FD', borderRadius:8, padding:'14px 16px', marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
            <div>
              <div style={{ fontSize:11, color:'#1565C0', fontWeight:600, marginBottom:2 }}>ACTIVE FINANCIAL YEAR</div>
              <div style={{ fontSize:22, fontWeight:800, color:'#1565C0' }}>
                FY {getFYLabel(activeFY)}
                {activeFY === currentFY && <span style={{ marginLeft:10, fontSize:12, background:'#2E7D32', color:'#fff', padding:'3px 10px', borderRadius:12 }}>✅ Current</span>}
              </div>
              <div style={{ fontSize:12, color:'#1565C0', marginTop:4 }}>{from} to {to}</div>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <select value={activeFY} onChange={e=>switchFY(e.target.value)}
                style={{ padding:'8px 12px', borderRadius:6, border:'1px solid #90CAF9', background:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                {allYears.map(fy => (
                  <option key={fy} value={fy}>
                    FY {getFYLabel(fy)} {fy===currentFY?'(Current)':''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats for active FY */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
          {[
            ['🧾 Sales',    stats.sales,     `₹${stats.totalSale.toLocaleString()}`,  '#1565C0','#E3F2FD'],
            ['🛒 Purchases',stats.purchases,  `₹${stats.totalPur.toLocaleString()}`,   '#2E7D32','#E8F5E9'],
            ['💸 Expenses', stats.expenses,   `₹${stats.totalExp.toLocaleString()}`,   '#9C27B0','#F3E5F5'],
          ].map(([label, count, amount, color, bg]) => (
            <div key={label} style={{ background:bg, borderRadius:6, padding:'12px 14px' }}>
              <div style={{ fontSize:12, fontWeight:600, color, marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:18, fontWeight:700, color }}>{count} records</div>
              <div style={{ fontSize:12, color }}>{amount}</div>
            </div>
          ))}
        </div>

        {/* All Years List */}
        <div style={{ fontWeight:700, fontSize:14, marginBottom:10, color:'#424242' }}>All Financial Years</div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {allYears.map(fy => {
            const active = fy === activeFY
            const archive = getArchive(fy)
            return (
              <div key={fy} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderRadius:6, border:`1px solid ${active?'#1565C0':'#E0E0E0'}`, background:active?'#F3F8FE':'#fff', flexWrap:'wrap', gap:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:active?'#1565C0':'#424242' }}>FY {getFYLabel(fy)}</span>
                  {fy===currentFY && <span style={{ fontSize:11, background:'#E8F5E9', color:'#2E7D32', padding:'2px 8px', borderRadius:10, fontWeight:700 }}>Current</span>}
                  {active && <span style={{ fontSize:11, background:'#E3F2FD', color:'#1565C0', padding:'2px 8px', borderRadius:10, fontWeight:700 }}>Active</span>}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  {!active && <button onClick={()=>switchFY(fy)} className="btn btn-sm btn-outline">Select</button>}
                  {archive && (
                    <button onClick={()=>setShowArchive(showArchive===fy?null:fy)} className="btn btn-sm btn-gray">
                      {showArchive===fy?'▲':'▼'} Archive
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Archive Preview */}
        {showArchive && (()=>{
          const arch = getArchive(showArchive)
          if (!arch) return null
          const closedAt = new Date(arch.closedAt).toLocaleString('en-IN')
          return (
            <div style={{ marginTop:12, padding:'14px 16px', background:'#F3E5F5', borderRadius:6 }}>
              <div style={{ fontWeight:700, fontSize:13, color:'#6A1B9A', marginBottom:8 }}>
                📦 Archive — FY {getFYLabel(showArchive)} · Closed on {closedAt}
              </div>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:12, color:'#6A1B9A' }}>
                {Object.entries(arch.modules).map(([mod, data]) => (
                  Array.isArray(data) && data.length > 0 && (
                    <span key={mod} style={{ padding:'3px 10px', background:'#CE93D8', color:'#fff', borderRadius:12, fontWeight:600 }}>
                      {mod}: {data.length} records
                    </span>
                  )
                ))}
              </div>
            </div>
          )
        })()}
      </div>

    </div>
  )
}