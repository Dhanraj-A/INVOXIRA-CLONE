import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="container">
      <h1>Invoxira</h1>
      <p>Welcome to Invoxira - Invoice Management System</p>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  )
}

export default App
