'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function AdminOverview() {
  const [metrics, setMetrics] = useState({
    totalValue: 0,
    itemsInTransit: 0,
    criticalAlerts: 0,
    storageOccupancy: 82
  })
  
  const [inventoryAnalysis, setInventoryAnalysis] = useState<any[]>([])
  const [volumeChartData, setVolumeChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL')

  useEffect(() => {
    fetchData()

    // Real-time listener for live inventory updates
    const channel = supabase
      .channel('inventory-dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_transactions' }, () => fetchData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedWarehouse])

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Fetch Warehouses for dropdown
      const { data: wData } = await supabase.from('warehouses').select('id, name')
      setWarehouses(wData || [])

      // 2. Fetch Products for Stock & Pricing
      const { data: products } = await supabase.from('products').select('*')
      
      // 3. Fetch branch specific stock if needed
      let branchStocks: { [key: string]: number } = {}
      if (selectedWarehouse !== 'ALL') {
         const { data: items } = await supabase.from('inventory_items')
           .select('product_id')
           .eq('status', 'IN_WAREHOUSE')
           .eq('location_id', selectedWarehouse)
         
         items?.forEach(item => {
            branchStocks[item.product_id] = (branchStocks[item.product_id] || 0) + 1
         })
      }

      // 4. Fetch Sales for DOS calculation (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const { data: sales } = await supabase.from('sales_reports')
        .select('product_id, qty, stores (name)')
        .gte('created_at', thirtyDaysAgo.toISOString())

      // 5. Fetch Transactions for Volume Chart (Last 7 Days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const { data: transactions } = await supabase.from('inventory_transactions')
        .select('type, quantity, created_at, status')
        .gte('created_at', sevenDaysAgo.toISOString())

      // Process Metrics
      const totalVal = products?.reduce((sum, p) => {
         const stock = selectedWarehouse === 'ALL' ? Number(p.current_stock || 0) : (branchStocks[p.id] || 0)
         return sum + (stock * Number(p.price || 0))
      }, 0) || 0

      const lowStockCount = products?.filter(p => {
         const stock = selectedWarehouse === 'ALL' ? Number(p.current_stock || 0) : (branchStocks[p.id] || 0)
         return stock < (p.min_stock_level || 10)
      }).length || 0
      
      const transitCount = transactions?.filter(t => t.status === 'PENDING')
        .reduce((sum, t) => sum + Number(t.quantity || 0), 0) || 0

      // Storage Capacity Logic (Units vs max 5000 units capacity per warehouse)
      const totalUnits = products?.reduce((sum, p) => sum + (selectedWarehouse === 'ALL' ? Number(p.current_stock || 0) : (branchStocks[p.id] || 0)), 0) || 0
      const maxCapacity = selectedWarehouse === 'ALL' ? (warehouses.length > 0 ? warehouses.length * 5000 : 5000) : 5000
      const occupancyPercent = Math.min(Math.round((totalUnits / maxCapacity) * 100), 100)

      // Volume Chart Data (Last 7 Days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - i)
        return d.toISOString().split('T')[0]
      }).reverse()

      const chartData = last7Days.map(date => {
        const dayTxs = transactions?.filter(t => t.created_at.startsWith(date)) || []
        return {
          name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          in: dayTxs.filter(t => t.type === 'STOCK_IN').reduce((s, t) => s + Number(t.quantity), 0),
          out: dayTxs.filter(t => t.type === 'STOCK_OUT').reduce((s, t) => s + Number(t.quantity), 0)
        }
      })
      setVolumeChartData(chartData)

      // Process DOS Analysis
      const analysis = products?.map(product => {
        const selectedWName = wData?.find(w => w.id === selectedWarehouse)?.name || ''
        const productSales = sales?.filter(s => {
           if (s.product_id !== product.id) return false
           if (selectedWarehouse !== 'ALL') {
              // Try to match store with warehouse name loosely
              return s.stores?.name?.toLowerCase().includes(selectedWName.split(' ')[0].toLowerCase())
           }
           return true
        })
        const totalQtySold = productSales?.reduce((sum, s) => sum + Number(s.qty || 0), 0) || 0
        const avgDailySales = totalQtySold / 30
        
        const currentStock = selectedWarehouse === 'ALL' ? Number(product.current_stock || 0) : (branchStocks[product.id] || 0)
        const dos = avgDailySales > 0 ? Math.round(currentStock / avgDailySales) : (currentStock > 0 ? 99 : 0)
        
        let status = 'HEALTHY'
        let recommendation = 'No action required'
        
        if (dos < 7) {
          status = 'CRITICAL'
          recommendation = `Restock ${Math.max(20, Math.round(avgDailySales * 30) - currentStock)} units immediately`
        } else if (dos < 15) {
          status = 'LOW'
          recommendation = 'Plan restock within 5 days'
        } else if (dos > 60) {
          status = 'OVERSTOCK'
          recommendation = 'Reduce inbound shipments'
        }
        return {
          id: product.id,
          name: product.name,
          stock: currentStock,
          dailyAvg: avgDailySales.toFixed(2),
          dos,
          status,
          recommendation
        }
      }).sort((a, b) => a.dos - b.dos) || []

      setMetrics({
        totalValue: totalVal,
        itemsInTransit: transitCount || 0,
        criticalAlerts: lowStockCount,
        storageOccupancy: occupancyPercent || 0
      })
      setInventoryAnalysis(analysis)
    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportDOSExcel = () => {
    if (inventoryAnalysis.length === 0) {
       alert('Tidak ada data DOS untuk diexport.')
       return
    }
    const exportRows = inventoryAnalysis.map(item => ({
      'Product Name': item.name,
      'SKU': `SKU-${item.id.substring(0,8).toUpperCase()}`,
      'Current Stock': item.stock,
      'Daily Sell-In': item.dailyAvg,
      'DOS (Days)': item.dos,
      'Status': item.status,
      'Recommendation': item.recommendation
    }))
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'DOS_Analysis')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const warehouseName = selectedWarehouse === 'ALL' ? 'Semua_Cabang' : warehouses.find(w => w.id === selectedWarehouse)?.name.replace(/ /g, '_')
    saveAs(new Blob([buf]), `DOS_Analysis_${warehouseName}_${new Date().getTime()}.xlsx`)
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-manrope pb-24">
      <main className="pt-20 p-8 max-w-7xl mx-auto space-y-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
           <div className="space-y-1">
             <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic">Inventory Dashboard (库存看板)</h1>
             <p className="text-[#8c9bbd] text-sm font-medium uppercase tracking-[0.2em]">Monitoring Operasional & Analisis Prediktif Persediaan</p>
           </div>
           <div className="flex items-center gap-4">
              {/* Branch Filter */}
              <div className="relative group">
                 <select 
                   value={selectedWarehouse}
                   onChange={(e) => setSelectedWarehouse(e.target.value)}
                   className="bg-[#131b2e] border border-white/10 text-white text-xs font-bold uppercase tracking-widest rounded-2xl px-6 py-3 outline-none focus:border-[#2e5bff] appearance-none cursor-pointer pr-10 transition-all hover:bg-white/5"
                 >
                    <option value="ALL">📍 Semua Cabang / Global</option>
                    {warehouses.map(w => (
                       <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                 </select>
                 <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-[#8c9bbd] pointer-events-none text-sm">expand_more</span>
              </div>

              <div className="bg-[#131b2e] px-6 py-3 rounded-2xl border border-white/5 flex items-center gap-3 shadow-lg">
                 <span className="w-2 h-2 bg-[#4edea3] rounded-full animate-pulse shadow-[0_0_10px_#4edea3]"></span>
                 <p className="text-[10px] font-black text-white uppercase tracking-widest">Live Sync</p>
              </div>
           </div>
        </header>

        {/* Primary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="bg-[#131b2e] p-6 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group hover:border-[#2e5bff]/30 transition-colors">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#2e5bff]/5 blur-[60px] rounded-full -mr-10 -mt-10 group-hover:bg-[#2e5bff]/20 transition-all duration-500"></div>
              <p className="text-[#8c9bbd] text-[8px] font-bold uppercase tracking-widest mb-8">TOTAL VALUE STOCK (berdasarkan harga SRP)</p>
              {loading ? (
                 <div className="h-10 w-3/4 bg-white/5 rounded-lg animate-pulse mb-1"></div>
              ) : (
                 <h2 className="text-3xl font-black text-white mb-1">{formatCurrency(metrics.totalValue)}</h2>
              )}
              <div className="flex items-center gap-2 text-[#4edea3] text-xs font-bold uppercase mt-2">
                 <span className="material-icons text-sm">trending_up</span> +12.4% vs last month
              </div>
           </div>
           <div className="bg-[#131b2e] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl group hover:border-white/20 transition-colors">
              <p className="text-[#8c9bbd] text-[10px] font-bold uppercase tracking-widest mb-6">Items In-Transit</p>
              {loading ? (
                 <div className="h-12 w-1/2 bg-white/5 rounded-lg animate-pulse mb-2"></div>
              ) : (
                 <h2 className="text-4xl font-black text-white mb-2">{metrics.itemsInTransit.toLocaleString()} <span className="text-lg font-medium text-[#8c9bbd]">units</span></h2>
              )}
              <p className="text-[#8c9bbd] text-xs font-bold uppercase tracking-tighter italic">48 scheduled for delivery today</p>
           </div>
           <div className="bg-gradient-to-br from-[#1a243d] to-[#0b1326] p-8 rounded-[2.5rem] border border-rose-500/20 shadow-2xl relative group hover:border-rose-500/40 transition-colors">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-[60px] rounded-full -mr-10 -mt-10 group-hover:bg-rose-500/20 transition-all duration-500"></div>
              <p className="text-rose-400 text-[10px] font-bold uppercase tracking-widest mb-6">Critical SKU Alerts</p>
              {loading ? (
                 <div className="h-12 w-1/2 bg-rose-400/20 rounded-lg animate-pulse mb-2"></div>
              ) : (
                 <h2 className="text-4xl font-black text-white mb-2">{metrics.criticalAlerts} <span className="text-lg font-medium text-rose-400/60">SKUs</span></h2>
              )}
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase">
                 <span className="material-icons text-sm">warning</span> Butuh restock secepatnya
              </div>
           </div>
        </div>

        {/* DOS Analysis Section */}
        <section className="space-y-6">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-end px-3 gap-4">
              <div>
                 <h3 className="text-2xl font-black text-white uppercase italic">Analisis Persediaan Produk</h3>
                 <p className="text-[#8c9bbd] text-xs font-bold uppercase tracking-widest">Estimasi jumlah hari stok akan bertahan berdasarkan rata-rata penjualan 30 hari terakhir</p>
              </div>
              <div className="flex gap-3">
                 <button onClick={exportDOSExcel} className="px-5 py-2.5 bg-[#2e5bff]/10 text-[#2e5bff] hover:bg-[#2e5bff] hover:text-white border border-[#2e5bff]/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                    <span className="material-icons text-sm">file_download</span> Export Excel
                 </button>
                 <button onClick={fetchData} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                    <span className={`material-icons text-sm ${loading ? 'animate-spin' : ''}`}>refresh</span> Refresh Audit
                 </button>
              </div>
           </div>
           <div className="bg-[#131b2e] rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl relative">
              {loading && (
                 <div className="absolute inset-0 bg-[#0b1326]/50 backdrop-blur-sm z-10 flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-[#2e5bff] border-t-transparent rounded-full animate-spin"></div>
                 </div>
              )}
              <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                 <table className="w-full text-left min-w-[900px]">
                    <thead className="sticky top-0 bg-[#131b2e] z-20 shadow-md">
                       <tr className="bg-white/5 text-[#8c9bbd] text-[10px] font-black uppercase tracking-[0.2em]">
                          <th className="px-10 py-6">Product Type</th>
                          <th className="px-10 py-6 text-center">Current Stock</th>
                          <th className="px-10 py-6 text-center">Daily Sell-In</th>
                          <th className="px-10 py-6 text-center">DOS (Days)</th>
                          <th className="px-10 py-6">Recommendation</th>
                          <th className="px-10 py-6 text-right">Status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                       {inventoryAnalysis.length === 0 && !loading ? (
                          <tr>
                             <td colSpan={6} className="px-10 py-16 text-center text-[#8c9bbd] text-sm font-bold uppercase tracking-widest opacity-50">Belum ada data stok</td>
                          </tr>
                       ) : (
                          inventoryAnalysis.map((item, i) => (
                             <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-10 py-7">
                                   <p className="text-sm font-black text-white group-hover:text-[#2e5bff] transition-colors">{item.name}</p>
                                   <p className="text-[10px] font-bold text-[#8c9bbd] uppercase tracking-tighter">SKU-{item.id.substring(0,8).toUpperCase()}</p>
                                </td>
                                <td className="px-10 py-7 text-center">
                                   <span className="text-lg font-black text-white">{item.stock}</span>
                                </td>
                                <td className="px-10 py-7 text-center">
                                   <span className="text-sm font-bold text-[#8c9bbd]">{item.dailyAvg} /day</span>
                                </td>
                                <td className="px-10 py-7 text-center">
                                   <div className="flex flex-col items-center gap-1">
                                      <span className={`text-xl font-black ${item.dos < 7 ? 'text-rose-400' : item.dos < 15 ? 'text-amber-400' : 'text-[#4edea3]'}`}>
                                         {item.dos}
                                      </span>
                                      <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                         <div 
                                            className={`h-full ${item.dos < 7 ? 'bg-rose-400' : item.dos < 15 ? 'bg-amber-400' : 'bg-[#4edea3]'} transition-all`} 
                                            style={{ width: `${Math.min(item.dos * 2, 100)}%` }}
                                         ></div>
                                      </div>
                                   </div>
                                </td>
                                <td className="px-10 py-7">
                                   <p className="text-xs font-bold text-white italic">"{item.recommendation}"</p>
                                </td>
                                <td className="px-10 py-7 text-right">
                                   <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                      item.status === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                      item.status === 'LOW' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                      item.status === 'OVERSTOCK' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                      'bg-[#4edea3]/10 text-[#4edea3] border-[#4edea3]/20'
                                   }`}>
                                      {item.status}
                                   </span>
                                </td>
                             </tr>
                          ))
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </section>

        {/* Lower Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 bg-[#131b2e] p-10 rounded-[3rem] border border-white/5 shadow-2xl">
              <h3 className="text-xl font-black text-white uppercase italic mb-8">Aktivitas Pergerakan Stok</h3>
              <div className="w-full h-[300px]">
                 {loading ? (
                    <div className="w-full h-full bg-white/5 animate-pulse rounded-2xl"></div>
                 ) : (
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={volumeChartData}>
                          <defs>
                             <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4edea3" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#4edea3" stopOpacity={0}/>
                             </linearGradient>
                             <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2e5bff" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#2e5bff" stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#8c9bbd', fontSize: 12}} />
                          <Tooltip contentStyle={{ backgroundColor: '#0b1326', border: 'none', borderRadius: '1rem' }} />
                          <Area type="monotone" dataKey="in" stroke="#4edea3" strokeWidth={4} fill="url(#colorIn)" />
                          <Area type="monotone" dataKey="out" stroke="#2e5bff" strokeWidth={4} fill="url(#colorOut)" />
                       </AreaChart>
                    </ResponsiveContainer>
                 )}
              </div>
           </div>
           <div className="bg-[#131b2e] p-10 rounded-[3rem] border border-white/5 shadow-2xl flex flex-col justify-center items-center text-center space-y-6">
              <h3 className="text-xl font-black text-white uppercase italic">Kapasitas Penyimpanan</h3>
              <div className="relative w-48 h-48 flex items-center justify-center">
                 {loading ? (
                    <div className="w-40 h-40 rounded-full border-8 border-white/5 animate-pulse"></div>
                 ) : (
                    <>
                       <svg className="w-full h-full transform -rotate-90">
                          <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/5" />
                          <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray="502.6" strokeDashoffset={502.6 * (1 - metrics.storageOccupancy / 100)} className="text-[#2e5bff]" strokeLinecap="round" />
                       </svg>
                       <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-4xl font-black text-white">{metrics.storageOccupancy}%</span>
                          <span className="text-[10px] font-bold text-[#8c9bbd] uppercase tracking-widest">Terpakai</span>
                       </div>
                    </>
                 )}
              </div>
              <div className="space-y-1">
                 <p className="text-sm font-bold text-white">Kapasitas Terpakai Saat Ini</p>
                 <p className="text-xs text-[#8c9bbd]">Berdasarkan jumlah unit yang tersedia di gudang {selectedWarehouse === 'ALL' ? 'keseluruhan' : 'terpilih'}</p>
              </div>
           </div>
        </div>
      </main>
      {/* Admin Floating Access */}
      <button className="fixed bottom-10 right-10 w-16 h-16 bg-[#2e5bff] text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/40 hover:scale-110 active:scale-95 transition-all z-50 group">
         <span className="material-icons text-3xl group-hover:rotate-90 transition-transform">add</span>
      </button>
    </div>
  )
}

