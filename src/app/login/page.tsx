'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
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

    if (profileError || !profile) {
      alert('Profile tidak ditemukan. Pastikan user sudah ada di table profiles!')
      setLoading(false)
      return
    }

    // 💾 simpan ke localStorage (Opsional, Supabase Auth sudah mengelola session)
    localStorage.setItem('role', profile.role)
    localStorage.setItem('email', profile.email)

    // 🚀 redirect sesuai role
    if (profile.role === 'manager') {
      router.push('/dashboard-manager')
    } else {
      // FIX PATH: Diarahkan ke /dashboard-pic sesuai struktur baru
      router.push('/dashboard-pic')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0b1326] flex items-center justify-center p-6 font-manrope">
      <div className="w-full max-w-md space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-[#131b2e] to-[#0b1326] border border-white/10 shadow-2xl mb-4">
            <span className="material-icons text-4xl text-[#2e5bff]">shield</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            PUSAT CONTROL
          </h1>
          <p className="text-[#dae2fd]/40 font-bold text-xs uppercase tracking-[0.2em]">
            Akses Penjualan Harian
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="bg-[#131b2e]/60 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-xl space-y-8">
          <div className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#dae2fd]/40 ml-1">Email Address</label>
              <div className="relative">
                <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-[#2e5bff] text-xl">alternate_email</span>
                <input 
                  type="email"
                  placeholder="name@company.ntt"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0b1326] border border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 transition-all"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#dae2fd]/40">Password</label>
                <button type="button" className="text-[10px] font-bold text-[#2e5bff] uppercase tracking-widest">Forgot?</button>
              </div>
              <div className="relative">
                <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-[#2e5bff] text-xl">lock</span>
                <input 
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0b1326] border border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-gradient-to-br from-[#4e74ff] to-[#2e5bff] text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Authenticating...</span>
              </>
            ) : (
              'Authenticate'
            )}
          </button>
        </form>

        {/* Secure Access Footer */}
        <div className="text-center space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-white/5"></div>
            <p className="text-[10px] font-bold text-[#dae2fd]/20 uppercase tracking-widest">Secure Access</p>
            <div className="h-px flex-1 bg-white/5"></div>
          </div>
          
          <div className="flex gap-4">
            <button className="flex-1 bg-[#131b2e] border border-white/5 py-4 rounded-2xl flex items-center justify-center gap-2 text-[#dae2fd]/60 font-bold text-xs hover:text-[#2e5bff] transition-colors">
              <span className="material-icons text-lg">fingerprint</span> Biometric
            </button>
            <button className="flex-1 bg-[#131b2e] border border-white/5 py-4 rounded-2xl flex items-center justify-center gap-2 text-[#dae2fd]/60 font-bold text-xs hover:text-[#2e5bff] transition-colors">
              <span className="material-icons text-lg">vpn_key</span> SSO
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}