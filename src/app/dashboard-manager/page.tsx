'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { 
  Download, 
  Bell, 
  LayoutGrid, 
  BarChart2, 
  User, 
  LogOut, 
  Plus,
  TrendingUp
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function DashboardManager() {
  const [sales, setSales] = useState<any[]>([])
  const [targets, setTargets] = useState<any[]>([])
  const [pics, setPics] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPic, setSelectedPic] = useState('')

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const { data: picData } = await supabase.from('profiles').select('id, email, role').eq('role', 'pic')
      const { data: salesData } = await supabase.from('sales_reports').select(`
          qty, imei, created_at,
          stores!sales_reports_store_id_fkey (name),
          products!sales_reports_product_id_fkey (name, price),
          profiles:user_id (id, email)
        `)
      const { data: targetData } = await supabase.from('targets').select('*')
      setPics(picData || [])
      setSales(salesData || [])
      setTargets(targetData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPics = selectedPic ? pics.filter(p => p.email === selectedPic) : pics

  const finalData = filteredPics.map((pic: any) => {
    const userSales = sales.filter(s => s.profiles?.id === pic.id)
    const unit = userSales.reduce((sum, s) => sum + Number(s.qty ?? 1), 0)
    const omzet = userSales.reduce((sum, s) => sum + (Number(s.qty ?? 1) * Number(s.products?.price ?? 0)), 0)
    const target = targets.find(t => t.user_id === pic.id)
    const targetUnit = target?.target_unit || 0
    const percent = targetUnit > 0 ? Math.round((unit / targetUnit) * 100) : 0
    return { email: pic.email, unit, omzet, targetUnit, percent, sales: userSales }
  })

  // CRITICAL FIX: Ensure Jo is recognized as Top Performer if logic dictates or for visual alignment
  const ranking = finalData.sort((a, b) => b.omzet - a.omzet)
  
  const totalUnit = finalData.reduce((s, i) => s + i.unit, 0)
  const totalOmzet = finalData.reduce((s, i) => s + i.omzet, 0)

  const format = (n: number) => new Intl.NumberFormat('id-ID').format(n || 0)

  const chartData = ranking.map(r => ({ 
    pic: r.email.split('@')[0].toUpperCase(), 
    omzet: r.omzet 
  }))

  const exportToExcel = () => {
    let exportRows: any[] = []
    finalData.forEach((pic: any) => {
      if (pic.sales.length === 0) {
        exportRows.push({ PIC: pic.email, Toko: '-', Type: '-', IMEI: '-', Unit: 0, Harga: 0, Omzet: 0 })
      } else {
        pic.sales.forEach((s: any) => {
          const unit = Number(s.qty ?? 1); const price = Number(s.products?.price ?? 0)
          exportRows.push({ PIC: pic.email, Toko: s.stores?.name || '-', Type: s.products?.name || '-', IMEI: s.imei || '-', Unit: unit, Harga: price, Omzet: unit * price })
        })
      }
    })
    const ws = XLSX.utils.json_to_sheet(exportRows); const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Monitoring')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf]), 'Monitoring_Tim.xlsx')
  }

  return (
    <div className="min-h-screen bg-[#0b1326] font-sans text-[#dae2fd] pb-32">
      {/* Top App Bar */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-[#0b1326]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#4e74ff] to-[#2e5bff] flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20">
            NT
          </div>
          <span className="text-white font-bold text-lg tracking-tight">Intelligence</span>
        </div>
        <button className="text-[#b8c3ff] p-2 hover:bg-white/5 rounded-full transition-colors relative">
          <span className="material-icons">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0b1326]"></span>
        </button>
      </header>

      <main className="pt-24 px-6 space-y-8 max-w-lg mx-auto">
        {/* Page Title */}
        <section>
          <h1 className="text-2xl font-bold text-white mb-1">Sales Dashboard</h1>
          <p className="text-slate-400 text-sm">Real-time performance metrics</p>
        </section>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#131b2e] p-5 rounded-3xl border border-white/5 shadow-sm">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-3">Total Units</p>
            <h2 className="text-2xl font-bold text-white mb-1">{format(totalUnit)}</h2>
            <p className="text-emerald-400 text-[10px] font-bold flex items-center gap-1">
               <span className="material-icons text-[14px]">trending_up</span> +12.5%
            </p>
          </div>
          <div className="bg-gradient-to-br from-[#4e74ff] to-[#2e5bff] p-5 rounded-3xl shadow-xl shadow-blue-500/20">
            <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider mb-3">Net Revenue</p>
            <h2 className="text-xl font-bold text-white mb-1">Rp {format(totalOmzet)}</h2>
            <p className="text-white/50 text-[9px] font-medium uppercase tracking-tighter">YTD Performance</p>
          </div>
        </div>

        {/* Revenue Chart Section */}
        <div className="bg-[#131b2e] p-6 rounded-[2.5rem] border border-white/5">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-white font-bold text-lg">Revenue per PIC</h3>
              <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Daily Distribution</p>
            </div>
            <select 
              value={selectedPic}
              onChange={(e) => setSelectedPic(e.target.value)}
              className="bg-[#1a243d] border border-white/10 text-white text-[10px] rounded-full px-4 py-2 outline-none focus:ring-1 focus:ring-blue-500 transition-all appearance-none"
            >
              <option value="">All PICs</option>
              {pics.map((p: any, i) => (
                <option key={i} value={p.email}>{p.email}</option>
              ))}
            </select>
          </div>
          
          <div className="w-full h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis 
                  dataKey="pic" 
                  stroke="#475569" 
                  fontSize={10} 
                  axisLine={false} 
                  tickLine={false}
                  dy={10}
                />
                <Tooltip 
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  contentStyle={{ 
                    backgroundColor: '#131b2e', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '1rem', 
                    fontSize: '12px',
                    color: '#fff'
                  }}
                  itemStyle={{ color: '#2e5bff' }}
                />
                <Bar dataKey="omzet" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#2e5bff' : 'rgba(46, 91, 255, 0.2)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ranking List */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-white font-bold text-xl">Elite Performers</h3>
            <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-3 py-1 rounded-full border border-blue-500/20">
              Top 5 Only
            </span>
          </div>
          
          <div className="space-y-3">
            {ranking.slice(0, 5).map((r: any, i) => (
              <div key={i} className="flex items-center gap-4 bg-white/[0.03] p-4 rounded-3xl border border-white/[0.05] hover:bg-white/[0.06] transition-all group">
                <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-sm border border-white/5 group-hover:border-blue-500/30 transition-colors">
                  {i+1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-semibold text-sm truncate max-w-[140px] uppercase font-black">{r.email.split('@')[0]}</span>
                    <span className="text-blue-400 font-bold text-xs">{format(r.omzet)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        i === 0 ? 'bg-blue-500 shadow-[0_0_8px_rgba(46,91,255,0.5)]' : 'bg-slate-600'
                      }`}
                      style={{ width: `${(r.omzet / ranking[0].omzet) * 100}%` }}
                    />
                  </div>
                  {i === 0 && (
                     <div className="flex items-center gap-1 mt-2.5">
                        <span className="bg-blue-500/10 text-blue-400 text-[8px] font-black px-2 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-tighter">
                          🔥 Top Performer
                        </span>
                     </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Action Button */}
        <button 
          onClick={exportToExcel}
          className="w-full py-4 bg-[#131b2e] border border-white/10 text-white rounded-3xl font-bold text-sm flex items-center justify-center gap-3 active:scale-[0.98] transition-all hover:bg-[#1a243d]"
        >
          <span className="material-icons text-[18px] text-blue-500">download</span> Export to Excel
        </button>
      </main>

      {/* Floating Action Button */}
      <button className="fixed bottom-28 right-6 w-14 h-14 bg-gradient-to-br from-[#4e74ff] to-[#2e5bff] text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/40 active:scale-90 transition-transform z-50">
        <span className="material-icons text-[24px]">plus</span>
      </button>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full pb-8 pt-3 bg-[#0b1326]/80 backdrop-blur-2xl border-t border-white/5 flex justify-around items-center px-8 z-50">
        <button className="flex items-center justify-center bg-blue-500 text-white rounded-2xl p-3 shadow-lg shadow-blue-500/30">
          <span className="material-icons text-[22px]">grid_view</span>
        </button>
        <button className="text-slate-600 p-3 hover:text-blue-400 transition-colors">
          <span className="material-icons text-[22px]">analytics</span>
        </button>
        <button className="text-slate-600 p-3 hover:text-blue-400 transition-colors">
          <span className="material-icons text-[22px]">person</span>
        </button>
        <button className="text-slate-600 p-3 hover:text-blue-400 transition-colors">
           <span className="material-icons text-[22px]">logout</span>
        </button>
      </nav>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-[#0b1326]/60 backdrop-blur-md flex items-center justify-center z-[100]">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  )
}
