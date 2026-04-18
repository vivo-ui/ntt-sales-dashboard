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
  Cell,
  AreaChart,
  Area,
  PieChart,
  Pie
} from 'recharts'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function DashboardManager() {
  const [sales, setSales] = useState<any[]>([])
  const [targets, setTargets] = useState<any[]>([])
  const [pics, setPics] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  // State Filter Rentang Tanggal
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  
  const [activeTab, setActiveTab] = useState('dashboard') // 'dashboard' | 'reports' | 'analytics'
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchAll()
  }, [startDate, endDate])

  const fetchAll = async () => {
    setLoading(true)
    try {
      // 1. Ambil Profil PIC
      const { data: picData } = await supabase.from('profiles').select('id, email, role').eq('role', 'pic')
      
      // 2. Ambil Laporan Penjualan (Sell-Out) dalam rentang tanggal
      const startRange = `${startDate}T00:00:00Z`
      const endRange = `${endDate}T23:59:59Z`
      const { data: salesData } = await supabase.from('sales_reports')
        .select(`
          id, qty, imei, created_at, staff_role, staff_name, product_id,
          stores!sales_reports_store_id_fkey (name),
          products!sales_reports_product_id_fkey (name, price),
          profiles:user_id (id, email)
        `)
        .gte('created_at', startRange)
        .lte('created_at', endRange)

      // 3. Ambil Target Unit
      const { data: targetData } = await supabase.from('targets').select('*')

      // 4. Ambil Data Produk (Stock & Value)
      const { data: productData } = await supabase.from('products').select('*')
      
      setPics(picData || [])
      setSales(salesData || [])
      setTargets(targetData || [])
      setInventory(productData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // --- LOGIKA PENGOLAHAN DATA ---
  
  const totalUnitSold = sales.reduce((sum, s) => sum + Number(s.qty ?? 1), 0)
  const totalOmzetSold = sales.reduce((sum, s) => sum + (Number(s.qty ?? 1) * Number(s.products?.price ?? 0)), 0)

  // Metrik Stok Gudang
  const totalStockUnits = inventory.reduce((sum, p) => sum + Number(p.current_stock || 0), 0)
  const totalStockValue = inventory.reduce((sum, p) => sum + (Number(p.current_stock || 0) * Number(p.price || 0)), 0)

  // Grafik: Pendapatan per Toko
  const storeSales: { [key: string]: number } = {}
  sales.forEach(s => {
    const storeName = s.stores?.name || 'Unknown'
    const revenue = Number(s.qty ?? 1) * Number(s.products?.price ?? 0)
    storeSales[storeName] = (storeSales[storeName] || 0) + revenue
  })

  const storeChartData = Object.keys(storeSales).map(store => ({
    name: store.length > 12 ? store.substring(0, 12) + '...' : store,
    omzet: storeSales[store]
  })).sort((a, b) => b.omzet - a.omzet)

  // Grafik: Tren Penjualan Harian
  const dailyData: { [key: string]: number } = {}
  sales.forEach(s => {
    const dateStr = new Date(s.created_at).toISOString().split('T')[0]
    dailyData[dateStr] = (dailyData[dateStr] || 0) + (Number(s.qty ?? 1) * Number(s.products?.price ?? 0))
  })

  const getDatesInRange = (start: string, end: string) => {
    const date = new Date(start); const dates = []
    while (date <= new Date(end)) {
      dates.push(new Date(date).toISOString().split('T')[0])
      date.setDate(date.getDate() + 1)
    }
    return dates
  }

  const dateLabels = getDatesInRange(startDate, endDate)
  const trendChartData = dateLabels.map(d => ({
    day: d.split('-')[2],
    fullDate: d,
    omzet: dailyData[d] || 0
  }))

  // Peringkat PIC Berdasarkan Real Omzet
  const picRanking = pics.map((pic: any) => {
    const userSales = sales.filter(s => s.profiles?.id === pic.id)
    const omzet = userSales.reduce((sum, s) => sum + (Number(s.qty ?? 1) * Number(s.products?.price ?? 0)), 0)
    const units = userSales.reduce((sum, s) => sum + Number(s.qty ?? 1), 0)
    const target = targets.find(t => t.user_id === pic.id)
    const targetUnit = target?.target_unit || 0
    const percent = targetUnit > 0 ? Math.round((units / targetUnit) * 100) : 0
    return { email: pic.email, omzet, percent, units }
  }).sort((a, b) => b.omzet - a.omzet)

  // Analisis Kesehatan Stok vs Sell-out
  const stockAnalysisData = inventory.map(product => {
    const productSales = sales.filter(s => s.product_id === product.id)
    const sold = productSales.reduce((sum, s) => sum + Number(s.qty || 1), 0)
    return {
      name: product.name,
      stock: product.current_stock || 0,
      sold: sold,
      health: product.current_stock > sold * 2 ? 'HEALTHY' : (product.current_stock > sold ? 'LOW' : 'CRITICAL')
    }
  })

  const format = (n: number) => new Intl.NumberFormat('id-ID').format(n || 0)

  const exportToExcel = () => {
    const exportRows = sales.map(s => ({
      Date: new Date(s.created_at).toLocaleString(),
      PIC: s.profiles?.email || '-',
      Store: s.stores?.name || '-',
      Staff_Role: s.staff_role || '-',
      Staff_Name: s.staff_name || '-',
      Product: s.products?.name || '-',
      IMEI: s.imei || '-',
      Qty: s.qty,
      Revenue: Number(s.qty) * Number(s.products?.price || 0)
    }))
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sales_Report')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf]), `NTT_Sales_Final_${startDate}_to_${endDate}.xlsx`)
  }

  const filteredSales = sales.filter(s => 
    s.stores?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.staff_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.imei?.includes(searchQuery)
  )

  return (
    <div className="min-h-screen bg-[#0b1326] font-manrope text-[#dae2fd] pb-32">
      {/* Header dengan Filter Tanggal */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-24 bg-[#0b1326]/70 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4e74ff] to-[#2e5bff] border-2 border-white/10 flex items-center justify-center shadow-lg">
             <span className="material-icons text-white">analytics</span>
          </div>
          <span className="text-xl font-black tracking-tight text-white uppercase italic">NTT COMMAND CENTER (东努)</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-bold text-[#8c9bbd] uppercase tracking-widest ml-1">Start</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[#131b2e] border border-white/10 text-white text-[10px] font-bold rounded-xl px-4 py-2 outline-none focus:border-[#2e5bff] transition-all"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-bold text-[#8c9bbd] uppercase tracking-widest ml-1">End</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-[#131b2e] border border-white/10 text-white text-[10px] font-bold rounded-xl px-4 py-2 outline-none focus:border-[#2e5bff] transition-all"
            />
          </div>
        </div>
      </header>

      <main className="pt-32 px-6 space-y-8 max-w-7xl mx-auto">
        
        {/* VIEW: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <>
            {/* Kartu Metrik Utama */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Units Sold', val: format(totalUnitSold), icon: 'shopping_basket', color: 'text-[#2e5bff]' },
                { label: 'Sales Revenue', val: `Rp ${format(totalOmzetSold)}`, icon: 'payments', color: 'text-emerald-400' },
                { label: 'Total Stock', val: `${format(totalStockUnits)} units`, icon: 'inventory_2', color: 'text-blue-400' },
                { label: 'Stock Valuation', val: `Rp ${format(totalStockValue)}`, icon: 'account_balance', color: 'text-emerald-400' }
              ].map((m, i) => (
                <div key={i} className="bg-[#131b2e] p-6 rounded-[2.5rem] border border-white/5 shadow-xl group hover:border-[#2e5bff]/30 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-[#8c9bbd] text-[10px] font-bold uppercase tracking-widest">{m.label}</p>
                    <span className={`material-icons ${m.color} opacity-40 group-hover:opacity-100 transition-opacity`}>{m.icon}</span>
                  </div>
                  <h2 className="text-2xl font-black text-white mb-2">{m.val}</h2>
                  <div className="h-1 w-12 bg-white/5 rounded-full overflow-hidden">
                     <div className={`h-full ${m.color.replace('text-', 'bg-')} transition-all`} style={{ width: '40%' }}></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Grafik Tren Harian */}
              <div className="lg:col-span-2 bg-[#131b2e] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <h3 className="text-white font-black text-xl italic uppercase mb-8">Daily Sales Trend</h3>
                <div className="w-full h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendChartData}>
                      <defs>
                        <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2e5bff" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#2e5bff" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#8c9bbd', fontSize: 10}} />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1326', border: 'none', borderRadius: '1rem' }} />
                      <Area type="monotone" dataKey="omzet" stroke="#2e5bff" strokeWidth={4} fillOpacity={1} fill="url(#colorTrend)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Analisis Kesehatan Stok */}
              <div className="bg-[#131b2e] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8">
                <h3 className="text-white font-black text-xl italic uppercase">Stock Analysis</h3>
                <div className="space-y-6 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                   {stockAnalysisData.map((item, i) => (
                     <div key={i} className="flex justify-between items-center group">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[#2e5bff] group-hover:bg-[#2e5bff] group-hover:text-white transition-all">
                              <span className="material-icons text-sm">phone_iphone</span>
                           </div>
                           <div>
                              <p className="text-xs font-bold text-white truncate max-w-[120px]">{item.name}</p>
                              <p className="text-[9px] font-black text-[#8c9bbd] uppercase">{item.stock} in stock</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-black text-white">{item.sold} sold</p>
                           <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${item.health === 'HEALTHY' ? 'bg-[#4edea3]/10 text-[#4edea3]' : item.health === 'LOW' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}`}>
                              {item.health}
                           </span>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            </div>

            {/* Grafik Per Toko */}
            <div className="bg-[#131b2e] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
              <h3 className="text-white font-black text-xl italic uppercase mb-8">Revenue per Store</h3>
              <div className="w-full h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={storeChartData}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#8c9bbd', fontSize: 10}} dy={10} />
                    <Tooltip cursor={{fill: 'rgba(255,255,255,0.03)'}} contentStyle={{ backgroundColor: '#0b1326', border: 'none', borderRadius: '1rem' }} />
                    <Bar dataKey="omzet" radius={[8, 8, 0, 0]}>
                      {storeChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#2e5bff' : 'rgba(46, 91, 255, 0.2)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
        
        {/* VIEW: REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="w-full md:max-w-md relative">
                  <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-[#8c9bbd]">search</span>
                  <input 
                    type="text" 
                    placeholder="Search store, staff, or IMEI..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#131b2e] border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm outline-none focus:border-blue-500 transition-all"
                  />
               </div>
               <button onClick={exportToExcel} className="flex items-center gap-3 px-8 py-4 bg-[#2e5bff] text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
                  <span className="material-icons text-sm">download</span> Export Final Report
               </button>
            </div>
            <div className="bg-[#131b2e] rounded-[2.5rem] border border-white/5 overflow-hidden overflow-x-auto">
               <table className="w-full text-left min-w-[1000px]">
                  <thead>
                     <tr className="bg-white/5 text-[#8c9bbd] text-[10px] font-black uppercase tracking-widest">
                        <th className="px-8 py-6">Date</th>
                        <th className="px-8 py-6">Store</th>
                        <th className="px-8 py-6">PIC</th>
                        <th className="px-8 py-6">Staff Name</th>
                        <th className="px-8 py-6">Product</th>
                        <th className="px-8 py-6">IMEI</th>
                        <th className="px-8 py-6">Revenue</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                     {filteredSales.map((s) => (
                        <tr key={s.id} className="hover:bg-white/5 transition-colors group text-xs text-white">
                           <td className="px-8 py-6">{new Date(s.created_at).toLocaleDateString()}</td>
                           <td className="px-8 py-6 font-bold">{s.stores?.name}</td>
                           <td className="px-8 py-6 text-blue-400">{s.profiles?.email.split('@')[0].toUpperCase()}</td>
                           <td className="px-8 py-6">{s.staff_name || '-'}</td>
                           <td className="px-8 py-6">{s.products?.name}</td>
                           <td className="px-8 py-6 font-mono text-blue-300">{s.imei}</td>
                           <td className="px-8 py-6 font-black text-emerald-400">Rp {format(s.qty * s.products?.price)}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}
      </main>

      {/* Navigasi Tab */}
      <nav className="fixed bottom-0 w-full h-24 bg-[#131b2e]/80 backdrop-blur-2xl border-t border-white/5 flex justify-around items-center px-10 pb-6 z-50">
        {[
          { id: 'dashboard', label: 'Command', icon: 'grid_view' },
          { id: 'reports', label: 'Reports', icon: 'receipt_long' },
          { id: 'analytics', label: 'Analytics', icon: 'query_stats' }
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center transition-all ${activeTab === tab.id ? 'text-[#2e5bff] scale-110' : 'text-[#8c9bbd] hover:text-white'}`}
          >
            <span className={`material-icons text-2xl mb-1 ${activeTab === tab.id ? 'bg-[#2e5bff]/10 p-3 rounded-2xl shadow-lg' : ''}`}>{tab.icon}</span>
            <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </nav>
      {loading && (
        <div className="fixed inset-0 bg-[#0b1326]/60 backdrop-blur-md flex items-center justify-center z-[100]">
          <div className="w-12 h-12 border-4 border-[#2e5bff] border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  )
}