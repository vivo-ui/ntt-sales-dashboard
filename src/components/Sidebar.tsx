'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function Sidebar() {
  const router = useRouter()

  const logout = () => {
    localStorage.removeItem('pic')
    router.push('/login')
  }

  return (
    <div
      style={{
        width: 220,
        height: '100vh',
        background: '#020617',
        color: 'white',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <h2>🚀 NTT Sales</h2>

      <Link href="/dashboard">📊 Dashboard</Link>
      <Link href="/input">📝 Input</Link>

      <button
        onClick={logout}
        style={{
          marginTop: 'auto',
          background: 'red',
          color: 'white',
          padding: 10,
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        Logout
      </button>
    </div>
  )
}