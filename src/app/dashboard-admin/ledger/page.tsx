'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function InventoryLedger() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLedger()
  }, [])

  const fetchLedger = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select(`
          id,
          created_at,
          type,
          quantity,
          source_destination,
          product_id,
          products (name),
          inventory_items (
            imei, 
            status,
            warehouses:location_id (name)
          )
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setTransactions(data || [])
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredData = transactions.filter(t => {
    const productName = t.products?.name || ''
    const destination = t.source_destination || ''
    const matchesSearch = productName.toLowerCase().includes(search.toLowerCase()) || 
                          destination.toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === 'ALL' || t.type === filterType
    
    const transactionDate = new Date(t.created_at).toISOString().split('T')[0]
    const matchesDate = transactionDate >= startDate && transactionDate <= endDate

    return matchesSearch && matchesType && matchesDate
  })

  // FIXED: Logic to export 1 row per IMEI
  const exportToExcel = () => {
    if (filteredData.length === 0) {
      alert('No data to export for current filters.')
      return
    }

    try {
      const exportRows: any[] = []
      
      filteredData.forEach(t => {
        const items = t.inventory_items || []
        
        if (items.length > 0) {
          // Create a dedicated row for each individual IMEI in the transaction
          items.forEach((item: any) => {
            const locationName = item.warehouses?.name || 'N/A'
            exportRows.push({
              'Tanggal': new Date(t.created_at).toLocaleString(),
              'Tipe': t.type.replace('_', ' '),
              'Produk': t.products?.name || '-',
              'IMEI / Serial': item.imei || '-',
              'Quantity': 1, // Each row represents 1 unit
              'Tujuan/Sumber': t.source_destination || '-',
              'Lokasi Gudang': locationName,
              'Status Saat Ini': item.status || 'COMPLETED'
            })
          })
        } else {
          // Fallback for batch transactions without individual item links
          exportRows.push({
            'Tanggal': new Date(t.created_at).toLocaleString(),
            'Tipe': t.type.replace('_', ' '),
            'Produk': t.products?.name || '-',
            'IMEI / Serial': 'Batch Entry',
            'Quantity': t.quantity,
            'Tujuan/Sumber': t.source_destination || '-',
            'Lokasi Gudang': 'N/A',
            'Status Saat Ini': 'COMPLETED'
          })
        }
      })

      const ws = XLSX.utils.json_to_sheet(exportRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Detailed_Inventory_Ledger')
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      saveAs(new Blob([buf], { type: 'application/octet-stream' }), `Inventory_Detailed_Export_${new Date().getTime()}.xlsx`)
    } catch (err) {
      console.error('Export Error:', err)
      alert('Failed to generate Excel file.')
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-manrope pb-24">
      <main className="lg:pl-64 pt-20 p-8 space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Inventory Database</h1>
            <p className="text-[#8c9bbd] text-sm font-medium uppercase tracking-[0.2em]">Detailed audit trail (1 Row per IMEI Export)</p>
          </div>
          <button 
            onClick={exportToExcel}
            className="px-6 py-3 bg-[#2e5bff] hover:bg-[#4e74ff] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
          >
            <span className="material-icons text-sm">download</span> Export Detailed Excel
          </button>
        </header>

        {/* Filters */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-[#131b2e]/40 p-6 rounded-[2.5rem] border border-white/5 shadow-xl">
           <div className="md:col-span-1 relative group">
              <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-[#8c9bbd] group-focus-within:text-[#2e5bff] transition-colors">search</span>
              <input 
                type="text" 
                placeholder="Product or Node name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0b1326] border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 transition-all"
              />
           </div>

           <div>
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 appearance-none transition-all"
              >
                 <option value="ALL">All Asset Types</option>
                 <option value="STOCK_IN">Stock-In Entry</option>
                 <option value="STOCK_OUT">Stock-Out Fulfillment</option>
              </select>
           </div>

           <div className="grid grid-cols-2 gap-3 md:col-span-2">
              <div className="relative group">
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-4 py-4 text-xs font-bold text-white outline-none focus:border-[#2e5bff]/50 transition-all"
                />
                <span className="absolute -top-2 left-4 bg-[#131b2e] px-2 text-[8px] font-black text-[#8c9bbd] uppercase tracking-widest">Start Date</span>
              </div>
              <div className="relative group">
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-4 py-4 text-xs font-bold text-white outline-none focus:border-[#2e5bff]/50 transition-all"
                />
                <span className="absolute -top-2 left-4 bg-[#131b2e] px-2 text-[8px] font-black text-[#8c9bbd] uppercase tracking-widest">End Date</span>
              </div>
           </div>
        </section>

        {/* Ledger Table */}
        <section className="bg-[#131b2e] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl relative">
           {loading && (
             <div className="absolute inset-0 bg-[#0b1326]/60 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#2e5bff] border-t-transparent rounded-full animate-spin"></div>
             </div>
           )}
           <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[900px]">
                 <thead>
                    <tr className="bg-white/5 text-[#8c9bbd] text-[10px] font-black uppercase tracking-[0.2em]">
                       <th className="px-10 py-6">Timestamp</th>
                       <th className="px-10 py-6">Type</th>
                       <th className="px-10 py-6">Product Details</th>
                       <th className="px-10 py-6">Quantity</th>
                       <th className="px-10 py-6">Entity/Node</th>
                       <th className="px-10 py-6 text-right">Status & Location</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                    {filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-10 py-20 text-center text-[#8c9bbd] uppercase font-black tracking-widest opacity-30">No matching records found</td>
                      </tr>
                    ) : (
                      filteredData.map((t, i) => {
                        const item = t.inventory_items?.[0]
                        const locationName = item?.warehouses?.name || 'N/A'
                        
                        return (
                          <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                              <td className="px-10 py-8">
                                <p className="text-sm font-bold text-white mb-1">{new Date(t.created_at).toLocaleDateString()}</p>
                                <p className="text-[10px] font-medium text-[#8c9bbd] uppercase">{new Date(t.created_at).toLocaleTimeString()}</p>
                              </td>
                              <td className="px-10 py-8">
                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${t.type === 'STOCK_IN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                    {t.type.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-10 py-8">
                                <p className="text-sm font-black text-white mb-1">{t.products?.name}</p>
                                <p className="text-[10px] font-mono text-[#8c9bbd] uppercase tracking-tighter">ID: {t.id.substring(0, 12).toUpperCase()}</p>
                              </td>
                              <td className="px-10 py-8">
                                <p className={`text-lg font-black ${t.type === 'STOCK_IN' ? 'text-emerald-400' : 'text-blue-400'}`}>
                                    {t.type === 'STOCK_IN' ? '+' : '-'}{t.quantity}
                                </p>
                              </td>
                              <td className="px-10 py-8">
                                <p className="text-sm font-black text-white mb-1">{t.source_destination}</p>
                                <p className="text-[10px] font-medium text-[#8c9bbd] uppercase tracking-widest italic">Warehouse Node</p>
                              </td>
                              <td className="px-10 py-8 text-right">
                                <div className="space-y-1">
                                  <span className="text-[10px] font-black text-[#4edea3] uppercase tracking-tighter">
                                      {item?.status || 'PROCESSED'}
                                  </span>
                                  <p className="text-[9px] font-bold text-[#2e5bff] uppercase tracking-widest">
                                    {locationName.toUpperCase()}
                                  </p>
                                </div>
                              </td>
                          </tr>
                        )
                      })
                    )}
                 </tbody>
              </table>
           </div>
           
           <footer className="p-8 border-t border-white/5 flex justify-between items-center bg-[#0b1326]/40">
              <p className="text-xs font-bold text-[#8c9bbd] uppercase tracking-widest">Showing {filteredData.length} records</p>
              <div className="flex gap-2">
                 <button className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors material-icons">chevron_left</button>
                 <button className="w-10 h-10 rounded-xl bg-[#2e5bff] flex items-center justify-center text-white font-black text-xs shadow-lg shadow-blue-500/20">1</button>
                 <button className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all material-icons">chevron_right</button>
              </div>
           </footer>
        </section>
      </main>
    </div>
  )
}
