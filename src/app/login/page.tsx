'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    setLoading(true)

    // 🔐 login ke supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert('Login gagal: ' + error.message)
      setLoading(false)
      return
    }

    const user = data.user

    // 🔥 ambil profile user
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    console.log('PROFILE:', profile)

    if (profileError || !profile) {
      alert('Profile tidak ditemukan. Pastikan user sudah ada di table profiles!')
      setLoading(false)
      return
    }

    // 💾 simpan ke localStorage
    localStorage.setItem('role', profile.role)
    localStorage.setItem('email', profile.email)

    // 🚀 redirect sesuai role
    if (profile.role === 'manager') {
      router.push('/dashboard-manager')
    } else {
      router.push('/dashboard')
    }

    setLoading(false)
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Login Nubia NTT</h1>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <br /><br />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <br /><br />

      <button onClick={handleLogin} disabled={loading}>
        {loading ? 'Loading...' : 'Login'}
      </button>
    </div>
  )
}