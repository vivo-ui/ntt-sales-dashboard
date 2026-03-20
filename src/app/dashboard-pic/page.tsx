'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const router = useRouter()

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    const userId = user?.id

    if (!userId) {
      router.push('/login')
      return
    }

    const email = user?.email || ''
    setUserName(email.split('@')[0].toUpperCase())

    // CRITICAL FILTER: Only show reports submitted by THIS user
    const { data, error } = await supabase
      .from('sales_reports')
      .select(`
        id,
        imei,
        created_at,
        qty,
        stores!sales_reports_store_id_fkey (name),
        products!sales_reports_product_id_fkey (name, price)
      `)
      .eq('user_id', userId) 
      .order('created_at', { ascending: false })

    if (!error) {
      setReports(data || [])
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const totalSalesCount = reports.reduce((sum, item) => sum + (Number(item.qty) || 1), 0)
  const totalRevenue = reports.reduce((sum, item) => {
    const price = item.products?.price || 0
    const qty = Number(item.qty) || 1
    return sum + (price * qty)
  }, 0)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="min-h-screen bg-[#0b1326] font-manrope text-[#dae2fd] pb-32">
      {/* Top App Bar */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-20 bg-[#0b1326]/70 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#b8c3ff] to-[#2e5bff] border-2 border-white/10 flex items-center justify-center shadow-lg">
             <span className="material-icons text-white">person</span>
          </div>
          <span className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-[#b8c3ff] to-[#2e5bff]">
            {userName}'S COMMAND
          </span>
        </div>
        <button className="w-12 h-12 rounded-full bg-[#131b2e] flex items-center justify-center text-[#dae2fd]/60 hover:text-[#dae2fd] transition-colors shadow-inner">
          <span className="material-icons">notifications</span>
        </button>
      </header>

      <main className="pt-28 px-6 space-y-10 max-w-lg mx-auto">
        {/* Summary Metrics */}
        <section className="space-y-6">
          <div className="bg-[#131b2e]/60 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#2e5bff]/10 blur-[60px] rounded-full -mr-10 -mt-10"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#1e2a4a] flex items-center justify-center text-[#2e5bff]">
                <span className="material-icons">shopping_cart</span>
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#dae2fd]/40">My Sales (Units)</p>
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter">{totalSalesCount.toLocaleString()}</h2>
          </div>

          <div className="bg-gradient-to-br from-[#131b2e] to-[#0b1326] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#2e5bff]/5 blur-[80px] rounded-full -ml-20 -mb-20"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#1e2a4a] flex items-center justify-center text-[#2e5bff]">
                <span className="material-icons text-xl">payments</span>
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#dae2fd]/40">Estimated Revenue</p>
            </div>
            <h2 className="text-4xl font-black text-white tracking-tighter">
              {formatCurrency(totalRevenue).replace('Rp', 'Rp ')}
            </h2>
          </div>
        </section>

        {/* Recent Reports List */}
        <section className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-xl font-bold text-white tracking-tight">Recent Reports</h3>
            <button className="text-xs font-bold text-[#dae2fd]/40 hover:text-[#2e5bff] transition-colors uppercase tracking-widest">View All</button>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-4 border-[#2e5bff] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-bold text-[#dae2fd]/20 animate-pulse uppercase tracking-[0.3em]">Syncing...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="bg-[#131b2e]/40 p-12 rounded-[2.5rem] border border-dashed border-white/10 flex flex-col items-center justify-center text-center">
                <p className="text-[#dae2fd]/20 font-bold uppercase tracking-widest text-xs">No reports yet</p>
              </div>
            ) : (
              reports.map((item) => (
                <div key={item.id} className="group relative bg-[#131b2e]/80 p-6 rounded-[2rem] border border-white/5 hover:border-[#2e5bff]/30 transition-all shadow-lg">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-[10px] font-bold text-[#dae2fd]/40 mb-1">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                      <h4 className="text-base font-black text-white leading-tight">
                        {item.stores?.name || 'Unknown Store'}
                      </h4>
                    </div>
                    <div className="bg-[#1e2a4a] px-3 py-1.5 rounded-xl border border-white/5">
                       <p className="text-[10px] font-mono font-bold text-[#dae2fd]/60 tracking-tighter">{item.imei || '-'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white leading-none mb-1">{item.products?.name || '-'}</p>
                      <p className="text-sm font-black text-[#2e5bff]">{formatCurrency(item.products?.price || 0)}</p>
                    </div>
                    <span className="material-icons text-[#4edea3]">check_circle</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 w-full h-24 bg-[#131b2e]/80 backdrop-blur-2xl border-t border-white/5 flex justify-around items-center px-6 pb-6 z-50">
          {/* LINK FIX: Absolute Path */}
          <a href="/dashboard-pic" className="flex flex-col items-center justify-center text-[#2e5bff] bg-[#222a3d] rounded-2xl px-5 py-2.5 shadow-lg">
            <span className="material-icons text-xl mb-0.5">grid_view</span>
            <span className="text-[8px] font-black uppercase tracking-widest">Dashboard</span>
          </a>
          <a href="/dashboard-pic/input" className="flex flex-col items-center justify-center text-[#dae2fd]/40 hover:text-[#dae2fd] transition-colors">
            <span className="material-icons text-xl mb-0.5">edit_square</span>
            <span className="text-[8px] font-black uppercase tracking-widest">Input</span>
          </a>
          <button onClick={handleLogout} className="flex flex-col items-center justify-center text-red-400">
            <span className="material-icons text-xl mb-0.5">logout</span>
            <span className="text-[8px] font-black uppercase tracking-widest">Logout</span>
          </button>
        </nav>
      </main>
    </div>
  )
}
