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
  const [sellIn, setSellIn] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  // Date Range Filters
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [targetMonth, setTargetMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  
  const [activeTab, setActiveTab] = useState('dashboard')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchAll()

    // Real-time listener for live updates
    const channel = supabase
      .channel('manager-dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_reports' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_transactions' }, () => fetchAll())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [startDate, endDate])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const startRange = `${startDate}T00:00:00Z`
      const endRange = `${endDate}T23:59:59Z`
      
      const { data: storeData } = await supabase.from('stores').select('*')
      const { data: picData } = await supabase.from('profiles').select('id, email, role').eq('role', 'pic')
      
      const { data: salesData } = await supabase.from('sales_reports')
        .select(`
          id, qty, imei, created_at, staff_role, staff_name, product_id,
          stores!sales_reports_store_id_fkey (name),
          products!sales_reports_product_id_fkey (name, price),
          profiles:user_id (id, email)
        `)
        .gte('created_at', startRange)
        .lte('created_at', endRange)
      const { data: targetData } = await supabase.from('targets').select('*')
      const { data: productData } = await supabase.from('products').select('*')
      const { data: sellInData } = await supabase.from('inventory_transactions')
        .select(`
          quantity, product_id, created_at, source_destination,
          products (name, price)
        `)
        .eq('type', 'STOCK_OUT')
        .gte('created_at', startRange)
        .lte('created_at', endRange)
      
      setStores(storeData || [])
      setPics(picData || [])
      setSales(salesData || [])
      setTargets(targetData || [])
      setInventory(productData || [])
      setSellIn(sellInData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const totalUnitSold = sales.reduce((sum, s) => sum + Number(s.qty ?? 1), 0)
  const totalOmzetSold = sales.reduce((sum, s) => sum + (Number(s.qty ?? 1) * Number(s.products?.price ?? 0)), 0)
  const totalSellInUnits = sellIn.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  const totalSellInValue = sellIn.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.products?.price || 0)), 0)
  
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
  
  const dailyData: { [key: string]: number } = {}
  sales.forEach(s => {
    const dateStr = new Date(s.created_at).toISOString().split('T')[0]
    dailyData[dateStr] = (dailyData[dateStr] || 0) + (Number(s.qty ?? 1) * Number(s.products?.price ?? 0))
  })
  const dateLabels = Array.from({ length: Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 }, (_, i) => {
    const d = new Date(startDate); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0]
  })
  const trendChartData = dateLabels.map(d => {
     const formattedDate = new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
     return { day: d.split('-')[2], fullDate: formattedDate, omzet: dailyData[d] || 0 }
  })
  
  const picRanking = pics.map((pic: any) => {
    // Sell Out Data
    const userSales = sales.filter(s => s.profiles?.id === pic.id)
    const omzet = userSales.reduce((sum, s) => sum + (Number(s.qty ?? 1) * Number(s.products?.price ?? 0)), 0)
    const units = userSales.reduce((sum, s) => sum + Number(s.qty ?? 1), 0)
    const analyticsMonth = endDate.substring(0, 7)
    const target = targets.find(t => t.user_id === pic.id && t.period_month === analyticsMonth) || targets.find(t => t.user_id === pic.id)
    const targetUnit = target?.target_unit || 0
    const percent = targetUnit > 0 ? Math.round((units / targetUnit) * 100) : 0
    
    // Sell In Data - Improve store matching mapping
    const picPrefix = pic.email.split('@')[0].toLowerCase()
    
    // Normalizer for common typos (e.g. JERY vs JERRY, EGI vs EGY)
    const normalizeName = (name: string) => {
       return (name || '').toLowerCase().replace(/y/g, 'i').replace(/rr/g, 'r').trim()
    }
    
    const normalizedPrefix = normalizeName(picPrefix)
    
    // 1. Stores assigned via 'pic' column in DB
    const myStores = stores.filter(s => {
       const sPic = normalizeName(s.pic)
       return sPic && (sPic === normalizedPrefix || sPic.includes(normalizedPrefix) || normalizedPrefix.includes(sPic))
    }).map(s => (s.name || '').toLowerCase())
    
    // 2. Stores where this PIC has historically made a sale
    const userSalesStores = Array.from(new Set(
      userSales.filter(s => s.stores?.name).map(s => (s.stores.name || '').toLowerCase())
    ))
    
    // 3. Combine both mappings to ensure we catch all of Jerry's (and others) stores
    const allPicStores = Array.from(new Set([...myStores, ...userSalesStores]))
    
    const userSellIn = sellIn.filter(tx => {
       const dest = (tx.source_destination || '').toLowerCase()
       return allPicStores.some(storeName => dest.includes(storeName) || storeName.includes(dest))
    })
    
    const sellInUnits = userSellIn.reduce((sum, tx) => sum + Number(tx.quantity || 0), 0)
    const sellInOmzet = userSellIn.reduce((sum, tx) => sum + (Number(tx.quantity || 0) * Number(tx.products?.price || 0)), 0)
    
    const targetSellIn = target?.target_sell_in || 0
    const sellInPercent = targetSellIn > 0 ? Math.round((sellInUnits / targetSellIn) * 100) : 0
    
    return { email: pic.email, omzet, percent, units, id: pic.id, sellInUnits, sellInOmzet, sellInPercent }
  })
  
  const picRankingOut = [...picRanking].sort((a, b) => b.omzet - a.omzet)
  const picRankingIn = [...picRanking].sort((a, b) => b.sellInUnits - a.sellInUnits)
  
  const format = (n: number) => new Intl.NumberFormat('id-ID').format(n || 0)
  
  const exportToExcel = () => {
    const exportRows = filteredSales.map(s => ({
      Date: new Date(s.created_at).toLocaleString(),
      Store: s.stores?.name || '-',
      PIC: s.profiles?.email || '-',
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
    saveAs(new Blob([buf]), `NTT_Sales_Report_${startDate}_to_${endDate}.xlsx`)
  }
  
  const filteredSales = sales.filter(s => 
    s.stores?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.staff_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.imei?.includes(searchQuery)
  )
  
  const stockAnalysisData = inventory.map(product => {
    const sold = sales.filter(s => s.product_id === product.id).reduce((sum, s) => sum + Number(s.qty || 1), 0)
    return { name: product.name, stock: product.current_stock || 0, sold, health: product.current_stock > sold * 2 ? 'HEALTHY' : (product.current_stock > sold ? 'LOW' : 'CRITICAL') }
  })
  
  return (
    <div className="min-h-screen bg-[#0b1326] font-manrope text-[#dae2fd] pb-32">
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-8 h-24 bg-[#0b1326]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4e74ff] to-[#2e5bff] border-2 border-white/10 flex items-center justify-center shadow-[0_0_20px_rgba(46,91,255,0.4)]">
                <span className="material-icons text-white">analytics</span>
             </div>
             <span className="text-xl font-black text-white uppercase italic tracking-tight">NUBIA NTT</span>
          </div>
          {/* Live Sync Badge */}
          <div className="hidden md:flex bg-[#131b2e] px-4 py-2 rounded-full border border-white/5 items-center gap-2 shadow-lg">
             <span className="w-2 h-2 bg-[#4edea3] rounded-full animate-pulse shadow-[0_0_10px_#4edea3]"></span>
             <p className="text-[9px] font-black text-white uppercase tracking-widest">Live Sync</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest">
          <div className="relative group">
             <p className="absolute -top-2 left-3 bg-[#0b1326] px-1 text-[8px] font-black text-[#8c9bbd] z-10">START</p>
             <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-[#131b2e] border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-[#2e5bff] transition-all cursor-pointer" />
          </div>
          <div className="relative group">
             <p className="absolute -top-2 left-3 bg-[#0b1326] px-1 text-[8px] font-black text-[#8c9bbd] z-10">END</p>
             <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-[#131b2e] border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-[#2e5bff] transition-all cursor-pointer" />
          </div>
        </div>
      </header>
      
      <main className="pt-32 px-8 space-y-10 max-w-[1400px] mx-auto">
        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {[
                { label: 'Units Sold', val: format(totalUnitSold), icon: 'shopping_basket', color: 'text-[#2e5bff]', bg: 'bg-[#2e5bff]' },
                { label: 'Sales Revenue', val: `Rp ${format(totalOmzetSold)}`, icon: 'payments', color: 'text-emerald-400', bg: 'bg-emerald-500' },
                { label: 'Total Sell In', val: `${format(totalSellInUnits)} units`, sub: `Rp ${format(totalSellInValue)}`, icon: 'local_shipping', color: 'text-blue-400', bg: 'bg-blue-500' },
                { label: 'Warehouse Stock', val: `${format(inventory.reduce((sum, p) => sum + Number(p.current_stock || 0), 0))} units`, icon: 'inventory_2', color: 'text-indigo-400', bg: 'bg-indigo-500' },
                { label: 'Stock Valuation', val: `Rp ${format(inventory.reduce((sum, p) => sum + (Number(p.current_stock || 0) * Number(p.price || 0)), 0))}`, icon: 'account_balance', color: 'text-[#4edea3]', bg: 'bg-[#4edea3]' }
              ].map((m, i) => (
                <div key={i} className="bg-[#131b2e] p-6 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group hover:border-white/10 transition-colors">
                  <div className={`absolute top-0 right-0 w-24 h-24 blur-[60px] rounded-full -mr-8 -mt-8 opacity-20 group-hover:opacity-40 transition-all ${m.bg}`}></div>
                  <p className="text-[#8c9bbd] text-[10px] font-bold uppercase tracking-widest mb-4">{m.label}</p>
                  {loading ? (
                     <div className="h-8 w-1/2 bg-white/5 animate-pulse rounded-lg mb-2"></div>
                  ) : (
                     <h2 className="text-2xl font-black text-white mb-2">{m.val}</h2>
                  )}
                  {m.sub && <p className="text-[10px] font-bold text-[#4edea3] mb-1">{m.sub}</p>}
                  <span className={`material-icons ${m.color} opacity-20 group-hover:opacity-100 transition-all absolute bottom-6 right-6 text-4xl group-hover:scale-110`}>{m.icon}</span>
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-[#131b2e] p-10 rounded-[3rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                <h3 className="text-white font-black text-xl italic uppercase mb-8">Daily Sales Trend</h3>
                <div className="w-full h-[350px]">
                  {loading ? (
                     <div className="w-full h-full bg-white/5 animate-pulse rounded-2xl"></div>
                  ) : trendChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendChartData}>
                        <defs>
                           <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2e5bff" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#2e5bff" stopOpacity={0}/>
                           </linearGradient>
                        </defs>
                        <XAxis dataKey="fullDate" axisLine={false} tickLine={false} tick={{fill: '#8c9bbd', fontSize: 10}} minTickGap={20} />
                        <Tooltip contentStyle={{ backgroundColor: '#0b1326', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', color: '#fff' }} itemStyle={{ color: '#4edea3', fontWeight: 'bold' }} />
                        <Area type="monotone" dataKey="omzet" stroke="#2e5bff" strokeWidth={4} fillOpacity={1} fill="url(#colorTrend)" activeDot={{ r: 8, fill: '#4edea3', stroke: '#0b1326', strokeWidth: 3 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center opacity-20"><p className="font-bold">No Data Found</p></div>}
                </div>
              </div>
              
              <div className="bg-[#131b2e] p-10 rounded-[3rem] border border-white/5 shadow-2xl space-y-8">
                <h3 className="text-white font-black text-xl italic uppercase">Stock Analysis</h3>
                <div className="space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar pr-4">
                  {loading ? (
                     Array.from({length: 5}).map((_, i) => (
                        <div key={i} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl animate-pulse">
                           <div className="w-8 h-8 rounded-lg bg-white/10"></div>
                           <div className="w-24 h-4 bg-white/10 rounded"></div>
                        </div>
                     ))
                  ) : stockAnalysisData.map((item, i) => (
                    <div key={i} className="flex justify-between items-center group bg-[#0b1326] p-4 rounded-2xl border border-white/5 hover:border-[#2e5bff]/30 transition-all shadow-md">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#2e5bff]/10 flex items-center justify-center text-[#2e5bff] group-hover:bg-[#2e5bff] group-hover:text-white transition-all shadow-inner">
                           <span className="material-icons text-sm">phone_iphone</span>
                        </div>
                        <div>
                           <p className="text-xs font-black text-white truncate max-w-[120px]">{item.name}</p>
                           <p className="text-[10px] font-bold text-[#8c9bbd] uppercase tracking-tighter">{item.stock} in stock</p>
                        </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] font-black text-white mb-1">{item.sold} sold</p>
                         <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest border ${
                            item.health === 'HEALTHY' ? 'bg-[#4edea3]/10 text-[#4edea3] border-[#4edea3]/20' : 
                            item.health === 'LOW' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                            'bg-rose-500/10 text-rose-500 border-rose-500/20'
                         }`}>
                            {item.health}
                         </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
        
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
                    className="w-full bg-[#131b2e] border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm outline-none focus:border-[#2e5bff] transition-all"
                  />
               </div>
               <button onClick={exportToExcel} className="flex items-center gap-3 px-8 py-4 bg-[#2e5bff] text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
                  <span className="material-icons text-sm">download</span> Export Excel
               </button>
            </div>
            <div className="bg-[#131b2e] rounded-[2.5rem] border border-white/5 overflow-hidden overflow-x-auto shadow-2xl">
               <table className="w-full text-left min-w-[1000px]">
                  <thead className="bg-[#0b1326]">
                     <tr className="text-[#8c9bbd] text-[10px] font-black uppercase tracking-widest">
                        <th className="px-8 py-6">Date</th>
                        <th className="px-8 py-6">Store</th>
                        <th className="px-8 py-6">Staff Role</th>
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
                           <td className="px-8 py-6">
                              <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${s.staff_role === 'Promotor vivo' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                 {s.staff_role || '-'}
                              </span>
                           </td>
                           <td className="px-8 py-6">{s.staff_name || '-'}</td>
                           <td className="px-8 py-6 font-bold text-white">{s.products?.name}</td>
                           <td className="px-8 py-6 font-mono text-[#8c9bbd]">{s.imei}</td>
                           <td className="px-8 py-6 font-black text-[#4edea3]">Rp {format(s.qty * s.products?.price)}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}
        
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 lg:grid-cols-2 gap-8">
             <div className="bg-[#131b2e] p-10 rounded-[3rem] border border-white/5 shadow-2xl relative">
                <h3 className="text-white font-black text-xl mb-8 uppercase italic">Sell Out Share</h3>
                <div className="w-full h-[400px]">
                   {loading ? (
                      <div className="w-full h-full flex items-center justify-center">
                         <div className="w-48 h-48 rounded-full border-8 border-white/5 border-t-[#2e5bff] animate-spin"></div>
                      </div>
                   ) : storeChartData.length > 0 ? (
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={storeChartData}
                            innerRadius={100}
                            outerRadius={140}
                            paddingAngle={5}
                            dataKey="omzet"
                            stroke="none"
                          >
                            {storeChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? '#2e5bff' : index === 1 ? '#4e74ff' : index === 2 ? '#4edea3' : '#1e2a4a'} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0b1326', border: 'none', borderRadius: '1rem', color: '#fff' }} />
                        </PieChart>
                     </ResponsiveContainer>
                   ) : <div className="h-full flex items-center justify-center opacity-20"><p className="font-bold">No Data Found</p></div>}
                </div>
             </div>
             
             <div className="bg-[#131b2e] p-10 rounded-[3rem] border border-white/5 shadow-2xl">
                <h3 className="text-white font-black text-xl mb-8 uppercase italic">Team Ranking (Out)</h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                   {loading ? (
                      Array.from({length: 5}).map((_, i) => (
                         <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse"></div>
                      ))
                   ) : picRankingOut.map((r, i) => (
                      <div key={i} className="flex justify-between items-center p-5 rounded-2xl bg-[#0b1326] border border-white/5 hover:border-[#2e5bff]/30 transition-all shadow-md group">
                         <div className="flex items-center gap-4">
                            <span className={`text-sm font-black w-8 text-center ${i === 0 ? 'text-[#4edea3]' : i === 1 ? 'text-blue-400' : 'text-[#8c9bbd]'}`}>#{i+1}</span>
                            <div>
                               <span className="text-sm font-bold text-white block">{r.email.split('@')[0].toUpperCase()}</span>
                               <span className="text-[10px] font-black text-[#8c9bbd] uppercase">{r.percent}% Target</span>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-sm font-black text-[#2e5bff] group-hover:text-[#4e74ff] transition-colors">Rp {format(r.omzet)}</p>
                            <p className="text-[10px] font-bold text-[#8c9bbd] uppercase">{r.units} Units Sold</p>
                         </div>
                      </div>
                   ))}
                </div>
             </div>

             <div className="bg-[#131b2e] p-10 rounded-[3rem] border border-white/5 shadow-2xl">
                <h3 className="text-white font-black text-xl mb-8 uppercase italic text-[#4edea3]">Sell In Progress</h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                   {loading ? (
                      Array.from({length: 5}).map((_, i) => (
                         <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse"></div>
                      ))
                   ) : picRankingIn.map((r, i) => (
                      <div key={i} className="flex justify-between items-center p-5 rounded-2xl bg-[#0b1326] border border-[#4edea3]/10 hover:border-[#4edea3]/30 transition-all shadow-md group">
                         <div className="flex items-center gap-4">
                            <span className={`text-sm font-black w-8 text-center ${i === 0 ? 'text-[#4edea3]' : i === 1 ? 'text-blue-400' : 'text-[#8c9bbd]'}`}>#{i+1}</span>
                            <div>
                               <span className="text-sm font-bold text-white block">{r.email.split('@')[0].toUpperCase()}</span>
                               <span className="text-[10px] font-black text-[#4edea3] uppercase">{r.sellInPercent}% Target</span>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-sm font-black text-[#4edea3] group-hover:text-emerald-400 transition-colors">{r.sellInUnits} Units In</p>
                            <p className="text-[10px] font-bold text-[#8c9bbd] uppercase">Sell In Vol</p>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </div>
        )}
        
        {activeTab === 'targets' && (
          <div className="bg-[#131b2e] p-10 rounded-[3rem] border border-white/5 shadow-2xl max-w-4xl mx-auto space-y-8">
             <div className="flex justify-between items-center">
                <div>
                   <h3 className="text-white font-black text-2xl mb-2 uppercase italic text-[#4e74ff]">Target Management</h3>
                   <p className="text-[#8c9bbd] text-sm">Atur target penjualan per PIC berdasarkan bulan.</p>
                </div>
                <div className="flex flex-col items-end">
                   <label className="text-[10px] font-black text-[#8c9bbd] uppercase tracking-widest mb-2">Periode Bulan</label>
                   <input 
                      type="month" 
                      value={targetMonth}
                      onChange={(e) => setTargetMonth(e.target.value)}
                      className="bg-[#0b1326] border border-white/10 text-white rounded-xl px-4 py-2 outline-none focus:border-[#2e5bff] font-bold"
                   />
                </div>
             </div>
             
             <div className="space-y-4">
                {pics.map(pic => {
                   const target = targets.find(t => t.user_id === pic.id && t.period_month === targetMonth)
                   const currentTarget = target?.target_unit || 0
                   const currentSellIn = target?.target_sell_in || 0
                   return (
                      <div key={pic.id} className="flex justify-between items-center bg-[#0b1326] p-6 rounded-2xl border border-white/5 hover:border-[#2e5bff]/30 transition-all shadow-md group">
                         <div className="flex items-center gap-6">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#4e74ff] to-[#2e5bff] flex items-center justify-center shadow-[0_0_15px_rgba(46,91,255,0.4)]">
                               <span className="material-icons text-white">person</span>
                            </div>
                            <div>
                               <p className="text-white font-bold text-lg">{pic.email.split('@')[0].toUpperCase()}</p>
                               <p className="text-[#8c9bbd] text-[10px] font-black uppercase tracking-widest">{pic.email}</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-6">
                            <div className="flex gap-4">
                               <div className="flex flex-col text-center">
                                  <label className="text-[9px] font-black text-[#8c9bbd] uppercase tracking-widest mb-2">Target Sell Out</label>
                                  <div className="flex items-center gap-2 bg-[#131b2e] border border-white/10 rounded-xl px-3 py-2">
                                     <input 
                                        type="number" 
                                        defaultValue={currentTarget}
                                        id={`target-out-${pic.id}`}
                                        className="w-16 bg-transparent text-white font-black text-lg text-center outline-none"
                                     />
                                     <span className="text-[#8c9bbd] text-[10px] font-bold">Unit</span>
                                  </div>
                               </div>
                               <div className="flex flex-col text-center">
                                  <label className="text-[9px] font-black text-[#4edea3] uppercase tracking-widest mb-2">Target Sell In</label>
                                  <div className="flex items-center gap-2 bg-[#131b2e] border border-[#4edea3]/20 rounded-xl px-3 py-2">
                                     <input 
                                        type="number" 
                                        defaultValue={currentSellIn}
                                        id={`target-in-${pic.id}`}
                                        className="w-16 bg-transparent text-white font-black text-lg text-center outline-none"
                                     />
                                     <span className="text-[#8c9bbd] text-[10px] font-bold">Unit</span>
                                  </div>
                               </div>
                            </div>
                            <button 
                               onClick={async () => {
                                  const valOut = parseInt((document.getElementById(`target-out-${pic.id}`) as HTMLInputElement).value) || 0
                                  const valIn = parseInt((document.getElementById(`target-in-${pic.id}`) as HTMLInputElement).value) || 0
                                  
                                  const { error } = target ? 
                                     await supabase.from('targets').update({ target_unit: valOut, target_sell_in: valIn }).eq('id', target.id) :
                                     await supabase.from('targets').insert({ user_id: pic.id, target_unit: valOut, target_sell_in: valIn, period_month: targetMonth })
                                     
                                  if (error) {
                                     alert('Error: ' + error.message)
                                  } else {
                                     alert('Target berhasil diperbarui!')
                                     const { data: targetData } = await supabase.from('targets').select('*')
                                     setTargets(targetData || [])
                                  }
                               }}
                               className="h-full px-6 py-4 bg-[#2e5bff] text-white hover:bg-[#4e74ff] rounded-xl font-black uppercase text-xs transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95"
                            >
                               <span className="material-icons text-sm">save</span>
                            </button>
                         </div>
                      </div>
                   )
                })}
             </div>
          </div>
        )}
      </main>
      
      <nav className="fixed bottom-0 w-full h-24 bg-[#131b2e]/80 backdrop-blur-2xl border-t border-white/5 flex justify-around items-center px-10 pb-6 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        {[
          { id: 'dashboard', icon: 'dashboard', label: 'Overview' },
          { id: 'analytics', icon: 'monitoring', label: 'Analytics' },
          { id: 'targets', icon: 'track_changes', label: 'Targets' },
          { id: 'reports', icon: 'receipt_long', label: 'Reports' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)} 
            className={`flex flex-col items-center justify-center transition-all group ${activeTab === tab.id ? 'text-[#2e5bff] scale-110' : 'text-[#dae2fd]/40 hover:text-[#dae2fd]'}`}
          >
            <div className={`relative flex items-center justify-center w-12 h-12 mb-1 rounded-2xl ${activeTab === tab.id ? 'bg-[#2e5bff]/10 border border-[#2e5bff]/20 shadow-[0_0_15px_rgba(46,91,255,0.2)]' : 'bg-transparent'}`}>
              <span className="material-icons text-2xl group-active:scale-90 transition-transform">{tab.icon}</span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
        <button onClick={handleLogout} className="flex flex-col items-center justify-center text-rose-500/60 hover:text-rose-500 transition-colors group">
          <div className="relative flex items-center justify-center w-12 h-12 mb-1 rounded-2xl bg-transparent">
            <span className="material-icons text-2xl group-active:scale-90 transition-transform">logout</span>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest">Logout</span>
        </button>
      </nav>
    </div>
  )
}
