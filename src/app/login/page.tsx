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

    // 🔐 1. Authenticate with Supabase Auth
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

    // 🔥 2. Fetch profile to determine ROLE
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      alert('Profil tidak ditemukan di database. Hubungi Developer!')
      setLoading(false)
      return
    }

    // 🚀 3. Routing based on Role
    if (profile.role === 'manager') {
      router.push('/dashboard-manager')
    } 
    else if (profile.role === 'admin') {
      // REDIRECT TO ADMIN INVENTORY SYSTEM
      router.push('/dashboard-admin')
    } 
    else {
      // REDIRECT TO PIC DASHBOARD (RAHMAN, EGI, JERY, JO)
      router.push('/dashboard-pic')
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0b1326] flex items-center justify-center p-6 font-manrope text-[#dae2fd]">
      <div className="w-full max-w-md space-y-12">
        {/* Branding */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-[#2e5bff]/20 to-transparent border border-[#2e5bff]/30 shadow-2xl mb-4">
            <span className="material-icons text-4xl text-[#2e5bff]">security</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Command Center</h1>
          <p className="text-[#8c9bbd] font-bold text-xs uppercase tracking-[0.2em]">Unified Intelligence Access</p>
        </div>

        {/* Login Card */}
        <form onSubmit={handleLogin} className="bg-[#131b2e]/60 p-10 rounded-[3rem] border border-white/5 shadow-2xl backdrop-blur-xl space-y-8 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#2e5bff]/10 blur-[50px] rounded-full"></div>
          
          <div className="space-y-6 relative z-10">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#8c9bbd] ml-1">Secure Email</label>
              <div className="relative group">
                <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-[#2e5bff] text-xl transition-transform group-focus-within:scale-110">alternate_email</span>
                <input 
                  type="email"
                  placeholder="admin@nubiantt.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0b1326] border border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 transition-all"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#8c9bbd]">Access Key</label>
              </div>
              <div className="relative group">
                <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-[#2e5bff] text-xl transition-transform group-focus-within:scale-110">vpn_key</span>
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

          {/* Submit */}
          <button 
            type="submit"
            disabled={loading}
            className="w-full py-6 bg-gradient-to-br from-[#4e74ff] to-[#2e5bff] text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em]"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Authenticate</span>
                <span className="material-icons">arrow_forward</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center">
           <p className="text-[10px] font-bold text-[#8c9bbd]/30 uppercase tracking-[0.3em]">Authorized Personnel Only</p>
        </div>
      </div>
    </div>
  )
}
