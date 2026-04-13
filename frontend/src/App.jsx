import { useState, useEffect } from 'react'

function App() {
  const [count, setCount] = useState(0)
  const [backendStatus, setBackendStatus] = useState('Checking...')

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    fetch(`${apiUrl}/api/health`)
      .then(res => res.json())
      .then(data => setBackendStatus(data.status === 'ok' ? 'Online' : 'Error'))
      .catch(() => setBackendStatus('Offline'))
  }, [])

  return (
    <div className="container">
      <h1>Invoxira</h1>
      <p>Welcome to Invoxira - Invoice Management System</p>
      <div className="status-badge">
        Backend Status: <span className={`status ${backendStatus.toLowerCase()}`}>{backendStatus}</span>
      </div>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  )
}

export default App
