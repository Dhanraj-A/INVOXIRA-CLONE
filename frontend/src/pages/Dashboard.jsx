import { useState, useEffect } from 'react'
import { getInvoices, getPurchases, getExpenses, getProducts, getActivityLogs, createActivityLog } from '../api'
import { getActiveFY, getFYRange, getFYLabel } from '../utils/fy'

function isOwner(){const u=JSON.parse(localStorage.getItem('inv_user')||'{}');return (u.role||'').toLowerCase() === 'owner'}
const fmt = n => '₹'+(n||0).toLocaleString('en-IN')

// ── Activity logger helpers ──────────────────────────────────
async function logActivity(action, detail, user) {
  try {
    const userObj = JSON.parse(localStorage.getItem('inv_user') || '{}')
    await createActivityLog({
      action,
      detail,
      user: user || userObj.name || 'Unknown',
      role: userObj.role || ''
    })
  } catch (err) { console.error('Log activity error:', err) }
}
// Export so other pages can import it
export { logActivity }

const ACTION_ICONS = {
  'Sale Created':    { icon:'🧾', color:'#1565C0', bg:'#E3F2FD' },
  'Sale Updated':    { icon:'✏️',  color:'#1976D2', bg:'#E3F2FD' },
  'Sale Deleted':    { icon:'🗑️', color:'#C62828', bg:'#FFEBEE' },
  'Purchase Created':{ icon:'🛒', color:'#2E7D32', bg:'#E8F5E9' },
  'Purchase Updated':{ icon:'✏️',  color:'#388E3C', bg:'#E8F5E9' },
  'Purchase Deleted':{ icon:'🗑️', color:'#C62828', bg:'#FFEBEE' },
  'Expense Added':   { icon:'💸', color:'#9C27B0', bg:'#F3E5F5' },
  'Expense Deleted': { icon:'🗑️', color:'#C62828', bg:'#FFEBEE' },
  'Product Added':   { icon:'📦', color:'#E65100', bg:'#FFF3E0' },
  'Product Updated': { icon:'✏️',  color:'#E65100', bg:'#FFF3E0' },
  'Product Deleted': { icon:'🗑️', color:'#C62828', bg:'#FFEBEE' },
  'Party Added':     { icon:'👥', color:'#00695C', bg:'#E0F2F1' },
  'Staff Marked':    { icon:'📅', color:'#6A1B9A', bg:'#F3E5F5' },
  'Login':           { icon:'🔑', color:'#1565C0', bg:'#E3F2FD' },
  'Settings Saved':  { icon:'⚙️',  color:'#455A64', bg:'#ECEFF1' },
  'default':         { icon:'📌', color:'#616161', bg:'#F5F5F5' },
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff/60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins/60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs/24)
  if (days < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN')
}

function lsGet(k){try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}}

export default function Dashboard() {
  const [invoices,   setInvoices]   = useState([])
  const [purchases,  setPurchases]  = useState([])
  const [expenses,   setExpenses]   = useState([])
  const [products,   setProducts]   = useState([])
  const [activities, setActivities] = useState([])
  const [filter,     setFilter]     = useState('month')
  const [expanded,   setExpanded]   = useState(null)
  const [actFilter,  setActFilter]  = useState('all')
  const [loading,    setLoading]    = useState(true)

  const [activeFY, setActiveFY] = useState(getActiveFY())
  useEffect(() => {
    const h = (e) => setActiveFY(e.detail.fy)
    window.addEventListener('fy_changed', h)
    return () => window.removeEventListener('fy_changed', h)
  }, [])
  useEffect(() => {
    loadData()
    loadActivities()
    // Auto-refresh activities every 30s
    const interval = setInterval(loadActivities, 30000)
    return () => clearInterval(interval)
  }, [activeFY])

  async function loadActivities() {
    try {
      const { data } = await getActivityLogs()
      setActivities(data || [])
      
      // Log login activity if not logged recently
      const user = JSON.parse(localStorage.getItem('inv_user') || '{}')
      if (user.name && data) {
        const lastLogin = data.find(a => a.action === 'Login' && a.user === user.name)
        const lastTime = lastLogin ? (Date.now() - new Date(lastLogin.time).getTime()) : Infinity
        if (lastTime > 5 * 60 * 1000) { // only log if > 5 mins since last login
          await logActivity('Login', `Logged into Invoxira Cloud`, user.name)
          const updated = await getActivityLogs()
          setActivities(updated.data || [])
        }
      }
    } catch (err) { console.error('Load activities error:', err) }
  }

  async function loadData() {
    setLoading(true)
    try {
      const [invRes, purRes, expRes, prodRes] = await Promise.all([
        getInvoices().catch(() => ({ data: [] })),
        getPurchases().catch(() => ({ data: [] })),
        getExpenses().catch(() => ({ data: [] })),
        getProducts().catch(() => ({ data: [] })),
      ])
      setInvoices(invRes.data || [])
      setPurchases(purRes.data || [])
      setExpenses(expRes.data || [])
      setProducts(prodRes.data || [])
      setActivities(lsGet('inv_activity'))
    } catch (err) {
      console.error('Dashboard load error:', err)
    }
    setLoading(false)
  }

  const now    = new Date()
  const today  = now.toISOString().split('T')[0]
  const fy     = now.getMonth() < 3 ? now.getFullYear()-1 : now.getFullYear()

  function inRange(date) {
    if (!date) return false
    if (filter==='today') return date === today
    if (filter==='week')  { const d=new Date(); d.setDate(d.getDate()-7); return date >= d.toISOString().split('T')[0] }
    if (filter==='month') return date.startsWith(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
    if (filter==='year')  { const r = getFYRange(activeFY); return date >= r.from && date <= r.to }
    return true
  }

  const filtInv  = invoices.filter(i  => inRange(i.date))
  const filtPur  = purchases.filter(p => inRange(p.date))
  const filtExp  = expenses.filter(e  => inRange(e.date))

  const totalSale  = filtInv.reduce((s,i) => s+(i.grandTotal||0), 0)
  const totalPaid  = filtInv.filter(i=>i.status==='paid').reduce((s,i)=>s+(i.grandTotal||0),0)
  const totalPend  = filtInv.filter(i=>i.status==='pending').reduce((s,i)=>s+(i.grandTotal||0),0)
  const totalPur   = filtPur.reduce((s,p) => s+(p.grandTotal||0), 0)
  const totalExp   = filtExp.reduce((s,e) => s+(e.amount||0), 0)
  const profit     = totalSale - totalPur - totalExp
  const lowStock   = products.filter(p => (p.stock||0) <= (p.min||5))

  const months = Array.from({length:6}, (_,i) => {
    const d = new Date(); d.setMonth(d.getMonth()-5+i)
    const key   = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const label = d.toLocaleString('default', {month:'short'})
    const sale  = invoices.filter(inv=>inv.date?.startsWith(key)).reduce((s,inv)=>s+(inv.grandTotal||0),0)
    const pur   = purchases.filter(p=>p.date?.startsWith(key)).reduce((s,p)=>s+(p.grandTotal||0),0)
    return { label, sale, pur, key }
  })
  const maxVal = Math.max(...months.map(m=>Math.max(m.sale,m.pur)), 1)

  const FILTERS = [['today','Today'],['week','This Week'],['month','This Month'],['year','This Year']]

  // Filter activities
  const filtActs = activities.filter(a => {
    if (actFilter === 'all')      return true
    if (actFilter === 'sale')     return a.action.includes('Sale')
    if (actFilter === 'purchase') return a.action.includes('Purchase')
    if (actFilter === 'expense')  return a.action.includes('Expense')
    if (actFilter === 'inventory')return a.action.includes('Product')
    if (actFilter === 'login')    return a.action === 'Login'
    return true
  }).slice(0, 20)

  function clearActivities() {
    if (!isOwner()) { alert('Only Owner can clear activity history'); return }
    if (confirm('Clear all activity history?')) {
      localStorage.setItem('inv_activity', JSON.stringify([]))
      setActivities([])
    }
  }

  if (loading) return (
    <div className="page-wrap" style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:12}}>⏳</div>
        <div style={{fontSize:16,fontWeight:600,color:'#1565C0'}}>Loading Dashboard...</div>
        <div style={{fontSize:12,color:'#9E9E9E',marginTop:4}}>Fetching data from server</div>
      </div>
    </div>
  )

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="page-head">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Welcome back! Here's your business overview.</div>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {FILTERS.map(([v,l]) => (
            <button key={v} className={`filter-btn ${filter===v?'active':''}`} onClick={()=>setFilter(v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stat-row" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        {[
          ['💰','Total Sales',  fmt(totalSale), '#1565C0','#E3F2FD'],
          ['✅','Received',     fmt(totalPaid), '#2E7D32','#E8F5E9'],
          ['⏳','Pending',      fmt(totalPend), '#E65100','#FFF3E0'],
          ['📈','Net Profit',   fmt(profit),    profit>=0?'#2E7D32':'#C62828', profit>=0?'#E8F5E9':'#FFEBEE'],
        ].map(([icon,label,val,color,bg]) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{background:bg,fontSize:22}}>{icon}</div>
            <div>
              <div className="stat-val" style={{color}}>{val}</div>
              <div className="stat-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
        {/* Bar Chart */}
        <div className="card" style={{padding:16}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>Sale vs Purchase (Last 6 Months)</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:10,height:140}}>
            {months.map(m => (
              <div key={m.key} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                <div style={{display:'flex',gap:3,alignItems:'flex-end',height:110}}>
                  <div style={{width:14,height:Math.max(4,(m.sale/maxVal)*110),background:'linear-gradient(to top,#1565C0,#42A5F5)',borderRadius:'3px 3px 0 0'}} title={fmt(m.sale)}/>
                  <div style={{width:14,height:Math.max(4,(m.pur/maxVal)*110),background:'linear-gradient(to top,#E65100,#FF8A65)',borderRadius:'3px 3px 0 0'}} title={fmt(m.pur)}/>
                </div>
                <div style={{fontSize:10,color:'#9E9E9E'}}>{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:16,marginTop:8}}>
            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11}}><div style={{width:10,height:10,borderRadius:2,background:'#1976D2'}}/> Sale</div>
            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11}}><div style={{width:10,height:10,borderRadius:2,background:'#E65100'}}/> Purchase</div>
          </div>
        </div>

        {/* P&L */}
        <div className="card" style={{padding:16}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>Profit & Loss</div>
          {[
            ['Total Sales',    totalSale,'#1976D2'],
            ['Total Purchases',totalPur, '#E65100'],
            ['Total Expenses', totalExp, '#9C27B0'],
            ['Net Profit',     profit,   profit>=0?'#2E7D32':'#C62828'],
          ].map(([label,val,color]) => (
            <div key={label} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid #F5F5F5',fontSize:13}}>
              <span style={{color:'#616161'}}>{label}</span>
              <span style={{fontWeight:700,color}}>{fmt(val)}</span>
            </div>
          ))}
          <div style={{marginTop:10,padding:'8px 12px',background:'#E3F2FD',borderRadius:4,fontSize:11,color:'#1565C0',fontWeight:600}}>
            {filter==='today'?'Today':filter==='week'?'This Week':filter==='month'?'This Month':`FY ${getFYLabel(activeFY)}`} · {filtInv.length} sales · {filtPur.length} purchases
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Sales + Low Stock */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
        {/* Recent Sales */}
        <div className="card">
          <div style={{padding:'12px 14px',borderBottom:'1px solid #F5F5F5',fontWeight:700,fontSize:13}}>
            Recent Sales
          </div>
          {invoices.length === 0
            ? <div className="empty-state"><div className="icon">🧾</div><p>No invoices yet</p></div>
            : invoices.slice(0,6).map((inv,i) => (
              <div key={inv._id||i} style={{padding:'10px 14px',borderBottom:'1px solid #F5F5F5',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:600,fontSize:13}}>#{inv.invoiceNo} · {inv.customer?.name||inv.custSearch||'—'}</div>
                  <div style={{fontSize:11,color:'#9E9E9E'}}>{inv.date} · {inv.paymentType}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontWeight:700,color:'#1565C0'}}>{fmt(inv.grandTotal)}</div>
                  <span className={`badge badge-${inv.status==='paid'?'green':inv.status==='overdue'?'red':'orange'}`} style={{fontSize:10}}>{inv.status}</span>
                </div>
              </div>
            ))
          }
        </div>

        {/* Low Stock */}
        <div className="card">
          <div style={{padding:'12px 14px',borderBottom:'1px solid #F5F5F5',fontWeight:700,fontSize:13,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            ⚠️ Low Stock Alert
            {lowStock.length > 0 && <span className="badge badge-red">{lowStock.length} items</span>}
          </div>
          <div style={{maxHeight:280,overflowY:'auto'}}>
            {lowStock.length === 0
              ? <div className="empty-state"><div className="icon">✅</div><p>All stock levels OK</p></div>
              : lowStock.map((p,i) => (
                <div key={p._id||i} style={{padding:'10px 14px',borderBottom:'1px solid #F5F5F5',cursor:'pointer'}}
                  onClick={() => setExpanded(expanded===i ? null : i)}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:13}}>{p.name}</div>
                      <div style={{fontSize:11,color:'#9E9E9E'}}>{p.cat} · {p.sku}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontWeight:700,color:p.stock===0?'#C62828':'#E65100'}}>{p.stock||0} {p.unit}</div>
                      <div style={{fontSize:10,color:'#9E9E9E'}}>Min: {p.min||5}</div>
                    </div>
                  </div>
                  {expanded===i && (
                    <div style={{marginTop:8,padding:8,background:'#FFF3E0',borderRadius:4,fontSize:12}}>
                      <div>Sale Price: <b>₹{p.price?.toLocaleString()}</b> · Cost: <b>₹{p.cost?.toLocaleString()}</b></div>
                      <div style={{marginTop:4,color:'#E65100'}}>Need to buy: <b>{Math.max(0,(p.min||5)-(p.stock||0))} {p.unit}</b></div>
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* ── RECENT ACTIVITIES ─────────────────────────────── */}
      <div className="card">
        <div style={{padding:'12px 14px',borderBottom:'1px solid #F5F5F5',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
          <div style={{fontWeight:700,fontSize:13}}>🕐 Recent Activities</div>
          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            {[['all','All'],['sale','Sale'],['purchase','Purchase'],['expense','Expense'],['inventory','Inventory'],['login','Login']].map(([v,l]) => (
              <button key={v} className={`filter-btn ${actFilter===v?'active':''}`}
                style={{padding:'3px 10px',fontSize:11}} onClick={()=>setActFilter(v)}>{l}</button>
            ))}
            {isOwner() && (
              <>
                {activities.length > 0 && (
                  <button onClick={clearActivities}
                    style={{padding:'3px 10px',fontSize:11,background:'#FFEBEE',color:'#C62828',border:'1px solid #EF9A9A',borderRadius:4,cursor:'pointer',fontWeight:600}}>
                    🗑️ Clear
                  </button>
                )}
                <button onClick={() => setActivities(lsGet('inv_activity'))}
                  style={{padding:'3px 10px',fontSize:11,background:'#E3F2FD',color:'#1565C0',border:'1px solid #90CAF9',borderRadius:4,cursor:'pointer',fontWeight:600}}>
                  🔄 Refresh
                </button>
              </>
            )}
          </div>
        </div>

        {filtActs.length === 0 ? (
          <div className="empty-state" style={{padding:'32px 20px'}}>
            <div className="icon">📋</div>
            <p>No activity yet. Start creating invoices and purchases!</p>
          </div>
        ) : (
          <div style={{maxHeight:380,overflowY:'auto'}}>
            {filtActs.map((act, i) => {
              const style = ACTION_ICONS[act.action] || ACTION_ICONS['default']
              const timeStr = new Date(act.time).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true})
              return (
                <div key={act.id||i} style={{padding:'10px 16px',borderBottom:'1px solid #F5F5F5',display:'flex',alignItems:'flex-start',gap:12,transition:'background 0.15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#FAFAFA'}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  {/* Icon */}
                  <div style={{width:34,height:34,borderRadius:'50%',background:style.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                    {style.icon}
                  </div>
                  {/* Content */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                      <div>
                        <span style={{fontWeight:600,fontSize:13,color:style.color}}>{act.action}</span>
                        {act.detail && <span style={{fontSize:12,color:'#616161',marginLeft:6}}>{act.detail}</span>}
                      </div>
                      <span style={{fontSize:10,color:'#9E9E9E',whiteSpace:'nowrap',flexShrink:0}}>{timeAgo(act.time)}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:3}}>
                      <span style={{fontSize:11,color:'#757575'}}>👤 <b>{act.user}</b></span>
                      {act.role && <span style={{fontSize:10,padding:'1px 6px',borderRadius:8,background:'#F5F5F5',color:'#616161',fontWeight:600}}>{act.role}</span>}
                      <span style={{fontSize:10,color:'#BDBDBD'}}>{timeStr}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activities.length > 20 && (
          <div style={{padding:'8px 16px',borderTop:'1px solid #F5F5F5',fontSize:12,color:'#9E9E9E',textAlign:'center'}}>
            Showing last 20 of {activities.length} activities
          </div>
        )}
      </div>
    </div>
  )
}