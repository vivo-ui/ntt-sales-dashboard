'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

export default function InventoryLedger() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLedger()
  }, [])

  const fetchLedger = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('inventory_transactions')
      .select(`
        id,
        created_at,
        type,
        quantity,
        source_destination,
        product_id,
        products (name)
      `)
      .order('created_at', { ascending: false })
    
    setTransactions(data || [])
    setLoading(false)
  }

  const filteredData = transactions.filter(t => {
    const matchesSearch = t.products?.name?.toLowerCase().includes(search.toLowerCase()) || 
                          t.source_destination?.toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === 'ALL' || t.type === filterType
    return matchesSearch && matchesType
  })

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-manrope pb-24">
      <main className="pt-20 p-8 space-y-8">
        <header className="flex justify-between items-end">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Inventory Ledger</h1>
            <p className="text-[#8c9bbd] text-sm font-medium uppercase tracking-[0.2em]">Detailed audit trail of every asset movement.</p>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-[#131b2e]/40 p-6 rounded-[2.5rem] border border-white/5">
           <div className="md:col-span-2 relative group">
              <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-[#8c9bbd]">search</span>
              <input 
                type="text" 
                placeholder="Product ID, SKU, or Admin name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0b1326] border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 transition-all"
              />
           </div>
           <div>
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 appearance-none"
              >
                 <option value="ALL">All Asset Types</option>
                 <option value="STOCK_IN">Stock-In only</option>
                 <option value="STOCK_OUT">Stock-Out only</option>
              </select>
           </div>
        </section>

        <section className="bg-[#131b2e] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
           <table className="w-full text-left">
              <thead>
                 <tr className="bg-white/5 text-[#8c9bbd] text-[10px] font-black uppercase tracking-[0.2em]">
                    <th className="px-10 py-6">Timestamp</th>
                    <th className="px-10 py-6">Type</th>
                    <th className="px-10 py-6">Product</th>
                    <th className="px-10 py-6">Quantity</th>
                    <th className="px-10 py-6">Entity/Source</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                 {filteredData.map((t, i) => (
                    <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                       <td className="px-10 py-8">
                          <p className="text-sm font-bold text-white mb-1">{new Date(t.created_at).toLocaleDateString()}</p>
                          <p className="text-[10px] font-medium text-[#8c9bbd] uppercase">{new Date(t.created_at).toLocaleTimeString()}</p>
                       </td>
                       <td className="px-10 py-8">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${t.type === 'STOCK_IN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                             {t.type.replace('_', ' ')}
                          </span>
                       </td>
                       <td className="px-10 py-8">
                          <p className="text-sm font-bold text-white mb-1">{t.products?.name}</p>
                       </td>
                       <td className="px-10 py-8">
                          <p className={`text-lg font-black ${t.type === 'STOCK_IN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                             {t.type === 'STOCK_IN' ? '+' : '-'}{t.quantity}
                          </p>
                       </td>
                       <td className="px-10 py-8">
                          <p className="text-sm font-bold text-white mb-1">{t.source_destination}</p>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </section>
      </main>
    </div>
  )
}
