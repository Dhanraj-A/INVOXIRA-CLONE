import { useState, useEffect } from 'react'

function App() {
  const [count, setCount] = useState(0)
  const [backendStatus, setBackendStatus] = useState('Checking...')

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    let attempt = 0;
    const maxAttempts = 3;

    const checkHealth = () => {
      attempt++;
      fetch(`${apiUrl}/api/health`, { signal: AbortSignal.timeout(15000) })
        .then(res => res.json())
        .then(data => {
          setBackendStatus(data.status === 'ok' ? 'Online' : 'Error')
        })
        .catch(() => {
          if (attempt < maxAttempts) {
            setBackendStatus(`Waking up server... (attempt ${attempt}/${maxAttempts})`)
            setTimeout(checkHealth, 5000)
          } else {
            setBackendStatus('Offline')
          }
        })
    }

    checkHealth()
  }, [])

  return (
    <div className="container">
      <h1>Invoxira</h1>
      <p>Welcome to Invoxira - Invoice Management System</p>
      <div className="status-badge">
        Backend Status: <span className={`status ${backendStatus.toLowerCase().includes('online') ? 'online' : backendStatus.toLowerCase().includes('offline') ? 'offline' : 'checking'}`}>{backendStatus}</span>
      </div>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  )
}

export default App

