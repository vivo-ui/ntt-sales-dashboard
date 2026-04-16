'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { Html5Qrcode } from 'html5-qrcode'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

interface ScannedItem {
  id: string
  product_id: string
  productName: string
  imei: string
}

export default function StockOutPage() {
  const [stores, setStores] = useState<any[]>([])
  const [selection, setSelection] = useState({
    storeId: '',
    priority: 'STANDARD',
    items: [] as ScannedItem[]
  })
  const [isScanning, setIsScanning] = useState(false)
  const [manualImei, setManualImei] = useState('')
  const [loading, setLoading] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    fetchStores()
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error)
      }
    }
  }, [])

  const fetchStores = async () => {
    const { data } = await supabase.from('stores').select('*').order('name')
    setStores(data || [])
  }

  const validateAndAddImei = async (imei: string) => {
    const cleanImei = imei.trim()
    if (!cleanImei) return
    
    if (selection.items.find(i => i.imei === cleanImei)) {
      alert('IMEI sudah ada di daftar manifest.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*, products(name)')
        .eq('imei', cleanImei)
        .eq('status', 'IN_WAREHOUSE')
        .single()

      if (data) {
        setSelection(prev => ({
          ...prev,
          items: [...prev.items, { 
            id: data.id, 
            product_id: data.product_id, 
            productName: data.products.name, 
            imei: cleanImei 
          }]
        }))
        setManualImei('')
      } else {
        alert('Eror: IMEI tidak ditemukan di gudang atau sudah diproses.')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const startScanner = async () => {
    setIsScanning(true)
    setTimeout(async () => {
      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;
      const config = { fps: 20, qrbox: { width: 300, height: 120 } };
      
      try {
        await html5QrCode.start(
          { facingMode: "environment" }, 
          config, 
          (decodedText) => validateAndAddImei(decodedText),
          () => {}
        );
      } catch (err) {
        alert("Gagal mengakses kamera.");
        setIsScanning(false);
      }
    }, 100);
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      setIsScanning(false);
    } else {
      setIsScanning(false);
    }
  }

  const exportManifest = () => {
    if (selection.items.length === 0) return
    
    const storeName = stores.find(s => s.id === selection.storeId)?.name || 'Unset'
    const exportRows = selection.items.map(item => ({
      'Toko Tujuan': storeName,
      'Prioritas': selection.priority,
      'Nama Produk': item.productName,
      'IMEI': item.imei,
      'Status': 'Draft Dispatch'
    }))

    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Shipment_Manifest')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf]), `StockOut_Manifest_${new Date().getTime()}.xlsx`)
  }

  const processOrder = async () => {
    if (loading) return
    if (!selection.storeId || selection.items.length === 0) {
      alert('Mohon lengkapi data pengiriman.')
      return
    }
    
    setLoading(true)
    try {
      const storeName = stores.find(s => s.id === selection.storeId)?.name

      const { data: tx, error: txError } = await supabase.from('inventory_transactions').insert({
        type: 'STOCK_OUT',
        quantity: selection.items.length,
        source_destination: storeName,
        notes: `Dispatch to ${storeName}, Priority: ${selection.priority}`
      }).select().single()

      if (txError) throw txError

      const itemIds = selection.items.map(i => i.id)
      await supabase.from('inventory_items')
        .update({ status: 'SHIPPED', last_transaction_id: tx.id })
        .in('id', itemIds)

      const productCounts = selection.items.reduce((acc: any, item) => {
        acc[item.product_id] = (acc[item.product_id] || 0) + 1
        return acc
      }, {})

      for (const pid in productCounts) {
        const { data: prod } = await supabase.from('products').select('current_stock').eq('id', pid).single()
        await supabase.from('products').update({ current_stock: (prod?.current_stock || 0) - productCounts[pid] }).eq('id', pid)
      }

      alert(`Berhasil mengirim ${selection.items.length} unit ke ${storeName}!`)
      setSelection({ storeId: '', priority: 'STANDARD', items: [] })
    } catch (error: any) {
      alert('Eror: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-manrope">
      <main className="pl-64 pt-20 p-8 max-w-7xl mx-auto space-y-10 pb-32">
        <header className="flex justify-between items-center">
           <div className="space-y-1">
             <h1 className="text-4xl font-black text-white uppercase italic tracking-tight">Order Fulfillment</h1>
             <p className="text-[#8c9bbd] text-sm font-medium uppercase tracking-widest">Process Store Stock-Out with Validation.</p>
           </div>
           <div className="flex gap-4">
              <button 
                onClick={exportManifest}
                disabled={selection.items.length === 0}
                className="px-6 py-2 bg-white/5 border border-white/10 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-all disabled:opacity-30"
              >
                 <span className="material-icons text-sm">download</span> Export Manifest
              </button>
              <span className="px-4 py-2 bg-[#2e5bff]/10 border border-[#2e5bff]/20 text-[#2e5bff] rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                 <span className="w-2 h-2 bg-[#2e5bff] rounded-full animate-pulse"></span> Ledger Sync Active
              </span>
           </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-8">
              <section className="bg-[#131b2e]/60 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c9bbd] ml-1">Destination Node</label>
                       <select 
                         value={selection.storeId}
                         onChange={(e) => setSelection({...selection, storeId: e.target.value})}
                         className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 appearance-none transition-all"
                       >
                          <option value="">Select Destination Store</option>
                          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c9bbd] ml-1">Fulfillment Priority</label>
                       <div className="flex p-1 bg-[#0b1326] rounded-2xl border border-white/5">
                          {['STANDARD', 'EXPRESS', 'CRITICAL'].map(p => (
                            <button 
                              key={p}
                              type="button"
                              onClick={() => setSelection({...selection, priority: p})}
                              className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${selection.priority === p ? 'bg-[#2e5bff] text-white shadow-lg' : 'text-[#8c9bbd] hover:bg-white/5'}`}
                            >
                              {p}
                            </button>
                          ))}
                       </div>
                    </div>
                 </div>
              </section>

              <section className="bg-[#131b2e]/60 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#4edea3]/10 flex items-center justify-center text-[#4edea3]">
                      <span className="material-icons">qr_code_scanner</span>
                    </div>
                    <h3 className="text-xl font-black text-white uppercase">Guided Fulfillment Scan</h3>
                 </div>

                 {isScanning && (
                   <div className="relative mb-8 rounded-[2rem] overflow-hidden border-2 border-[#2e5bff]/30 shadow-2xl bg-black aspect-video">
                      <div id="reader" className="w-full h-full"></div>
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                         <div className="w-[320px] h-[120px] border-4 border-[#4edea3] rounded-2xl relative shadow-[0_0_100px_rgba(0,0,0,0.8)]">
                            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-[#4edea3] animate-pulse"></div>
                         </div>
                      </div>
                   </div>
                 )}

                 <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c9bbd] ml-1">Manual IMEI Input</label>
                       <input 
                         type="text" 
                         placeholder="Type serial number..."
                         value={manualImei}
                         onChange={(e) => setManualImei(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), validateAndAddImei(manualImei))}
                         className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 transition-all"
                       />
                    </div>
                    <div className="pt-6">
                       <button 
                         type="button"
                         onClick={isScanning ? stopScanner : startScanner}
                         className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isScanning ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' : 'bg-[#2e5bff]/10 text-[#2e5bff] border border-[#2e5bff]/20 hover:bg-[#2e5bff] hover:text-white'}`}
                       >
                         <span className="material-icons">{isScanning ? 'close' : 'photo_camera'}</span>
                       </button>
                    </div>
                 </div>

                 <button 
                   type="button"
                   onClick={() => validateAndAddImei(manualImei)}
                   disabled={!manualImei || loading}
                   className="w-full py-4 bg-[#2e5bff]/10 border border-[#2e5bff]/20 text-[#2e5bff] rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 hover:bg-[#2e5bff] hover:text-white transition-all"
                 >
                   Verify and Queue
                 </button>
              </section>

              <section className="space-y-6">
                 <h3 className="text-xl font-bold text-white uppercase tracking-tight ml-2">Outcoming Item List</h3>
                 <div className="space-y-4">
                    {selection.items.length === 0 ? (
                      <div className="p-16 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 opacity-20">
                         <span className="material-icons text-5xl">inventory</span>
                         <p className="text-xs font-black uppercase tracking-[0.3em]">No items on list</p>
                      </div>
                    ) : (
                      selection.items.map((item, i) => (
                        <div key={i} className="p-6 bg-[#131b2e]/60 border border-white/5 rounded-[2.5rem] shadow-xl flex justify-between items-center group transition-all hover:border-[#2e5bff]/30">
                           <div className="flex items-center gap-6">
                              <div className="w-12 h-12 rounded-2xl bg-[#4edea3]/10 flex items-center justify-center text-[#4edea3]">
                                 <span className="material-icons">check_circle</span>
                              </div>
                              <div>
                                 <h4 className="text-lg font-black text-white">{item.productName}</h4>
                                 <p className="text-[10px] font-mono font-bold text-[#8c9bbd] uppercase tracking-tighter">IMEI: <span className="text-white">{item.imei}</span></p>
                              </div>
                           </div>
                           <button onClick={() => setSelection(prev => ({...prev, items: prev.items.filter((_, idx) => idx !== i)}))} className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 opacity-20 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white">
                              <span className="material-icons text-sm">delete_sweep</span>
                           </button>
                        </div>
                      ))
                    )}
                 </div>
              </section>
           </div>

           <div className="space-y-6">
              <div className="bg-[#131b2e] p-10 rounded-[3rem] border border-white/5 shadow-2xl sticky top-28 space-y-10">
                 <div className="space-y-2 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8c9bbd] mb-4">Shipment Manifest</p>
                    <div className="flex justify-between items-end bg-[#0b1326] p-8 rounded-[2rem] border border-white/5 shadow-inner">
                       <span className="text-xs font-bold text-[#8c9bbd] uppercase">Total Units</span>
                       <span className="text-7xl font-black text-[#4edea3] tracking-tighter">{selection.items.length.toString().padStart(2, '0')}</span>
                    </div>
                 </div>

                 <div className="pt-4 space-y-4">
                    <button 
                      onClick={processOrder}
                      disabled={loading || selection.items.length === 0 || !selection.storeId}
                      className="w-full py-6 bg-gradient-to-br from-[#4e74ff] to-[#2e5bff] text-white rounded-[2rem] font-black text-lg shadow-2xl shadow-blue-500/40 active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-3 group"
                    >
                      {loading ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>
                           <span className="uppercase tracking-[0.2em]">Submit Sell-In</span>
                           <span className="material-icons group-hover:translate-x-1 transition-transform">local_shipping</span>
                        </>
                      )}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      </main>
    </div>
  )
}
