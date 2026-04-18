'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { Html5Qrcode } from 'html5-qrcode'

interface ScannedItem {
  id: string
  product_id: string
  productName: string
  imei: string
}

interface Warehouse {
  id: string
  name: string
  address: string
  pic_name: string
}

export default function WarehouseTransferPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selection, setSelection] = useState({
    sourceId: '',
    destinationId: '',
    items: [] as ScannedItem[]
  })
  const [isScanning, setIsScanning] = useState(false)
  const [manualImei, setManualImei] = useState('')
  const [loading, setLoading] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    fetchWarehouses()
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error)
      }
    }
  }, [])

  const fetchWarehouses = async () => {
    const { data } = await supabase.from('warehouses').select('*').order('name')
    setWarehouses(data || [])
  }

  const validateAndAddImei = async (imei: string) => {
    const cleanImei = imei.trim()
    if (!cleanImei) return
    
    if (!selection.sourceId) {
      alert('Mohon pilih Gudang Asal terlebih dahulu.')
      return
    }

    if (selection.items.find(i => i.imei === cleanImei)) {
      alert('IMEI sudah ada di daftar manifest.')
      return
    }

    setLoading(true)
    try {
      // Validate: Check if item is in the SELECTED SOURCE warehouse
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*, products(name)')
        .eq('imei', cleanImei)
        .eq('location_id', selection.sourceId)
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
        alert('Eror: IMEI tidak ditemukan di gudang asal yang dipilih atau status tidak valid.')
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
      try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        const config = { fps: 20, qrbox: { width: 320, height: 120 } };
        
        await html5QrCode.start(
          { facingMode: "environment" }, 
          config, 
          (decodedText) => validateAndAddImei(decodedText),
          () => {}
        );
      } catch (err) {
        console.error("Camera error:", err);
        setIsScanning(false);
      }
    }, 200);
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      setIsScanning(false);
    } else {
      setIsScanning(false);
    }
  }

  const commitTransfer = async () => {
    if (loading) return
    if (!selection.sourceId || !selection.destinationId || selection.items.length === 0) {
      alert('Mohon lengkapi data gudang dan scan minimal 1 item.')
      return
    }

    if (selection.sourceId === selection.destinationId) {
      alert('Gudang asal dan tujuan tidak boleh sama.')
      return
    }
    
    setLoading(true)
    try {
      const sourceName = warehouses.find(w => w.id === selection.sourceId)?.name
      const destName = warehouses.find(w => w.id === selection.destinationId)?.name

      // 1. Log Transaction (TRANSFER_OUT from source)
      const { data: tx, error: txError } = await supabase.from('inventory_transactions').insert({
        type: 'STOCK_OUT', // Categorized as stock out for source ledger
        quantity: selection.items.length,
        source_destination: destName,
        notes: `Inter-warehouse transfer from ${sourceName} to ${destName}`
      }).select().single()

      if (txError) throw txError

      // 2. Update status and LOCATION of items
      const itemIds = selection.items.map(i => i.id)
      const { error: updateError } = await supabase.from('inventory_items')
        .update({ 
          location_id: selection.destinationId, 
          last_transaction_id: tx.id 
        })
        .in('id', itemIds)
      
      if (updateError) throw updateError

      alert(`Berhasil! ${selection.items.length} unit telah dipindahkan ke ${destName}.`)
      setSelection({ ...selection, items: [] })
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
             <h1 className="text-4xl font-black text-white uppercase italic tracking-tight">Stock Transfer</h1>
             <p className="text-[#8c9bbd] text-sm font-medium uppercase tracking-widest">Execute secure inter-warehouse asset movements.</p>
           </div>
           <div className="flex gap-4">
              <span className="px-4 py-2 bg-[#2e5bff]/10 border border-[#2e5bff]/20 text-[#2e5bff] rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                 <span className="w-2 h-2 bg-[#2e5bff] rounded-full animate-pulse"></span> Transfer Protocol Active
              </span>
           </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-8">
              {/* Node Routing */}
              <section className="bg-[#131b2e]/60 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8">
                 <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-[#2e5bff]/10 flex items-center justify-center text-[#2e5bff]">
                      <span className="material-icons">swap_horiz</span>
                    </div>
                    <h3 className="text-xl font-black text-white uppercase">Transfer Routing</h3>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c9bbd] ml-1">Source Node (From)</label>
                       <select 
                         value={selection.sourceId}
                         onChange={(e) => setSelection({...selection, sourceId: e.target.value, items: []})}
                         className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 appearance-none transition-all"
                       >
                          <option value="">Select Source Warehouse</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                       </select>
                       <p className="text-[9px] text-[#8c9bbd]/40 italic ml-1">*Changing source will clear the current queue.</p>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c9bbd] ml-1">Destination Node (To)</label>
                       <select 
                         value={selection.destinationId}
                         onChange={(e) => setSelection({...selection, destinationId: e.target.value})}
                         className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 appearance-none transition-all"
                       >
                          <option value="">Select Destination Warehouse</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                       </select>
                    </div>
                 </div>
              </section>

              {/* Acquisition Field */}
              <section className="bg-[#131b2e]/60 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#4edea3]/10 flex items-center justify-center text-[#4edea3]">
                      <span className="material-icons">qr_code_scanner</span>
                    </div>
                    <h3 className="text-xl font-black text-white uppercase">IMEI Acquisition Mode</h3>
                 </div>

                 {isScanning && (
                   <div className="relative mb-8 rounded-[2rem] overflow-hidden border-2 border-[#2e5bff]/30 shadow-2xl bg-black aspect-video">
                      <div id="reader" className="w-full h-full"></div>
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                         <div className="w-[320px] h-[120px] border-4 border-[#4edea3] rounded-2xl relative shadow-[0_0_100px_rgba(0,0,0,0.8)]">
                            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-[#4edea3] animate-pulse"></div>
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#4edea3] text-[#0b1326] text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">Focus Target Barcode</div>
                         </div>
                      </div>
                   </div>
                 )}

                 <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c9bbd] ml-1">Manual Entry Identifier</label>
                       <input 
                         type="text" 
                         placeholder="Enter Serial/IMEI..."
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
                         className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isScanning ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' : 'bg-[#2e5bff]/10 text-[#2e5bff] border border-[#2e5bff]/20 hover:bg-[#2e5bff] hover:text-white shadow-lg'}`}
                       >
                         <span className="material-icons">{isScanning ? 'close' : 'photo_camera'}</span>
                       </button>
                    </div>
                 </div>

                 <button 
                   type="button"
                   onClick={() => validateAndAddImei(manualImei)}
                   disabled={!manualImei || loading}
                   className="w-full py-4 bg-[#2e5bff]/10 border border-[#2e5bff]/20 text-[#2e5bff] rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 disabled:opacity-30 transition-all hover:bg-[#2e5bff] hover:text-white"
                 >
                   Verify and Queue Asset
                 </button>
              </section>

              {/* List manifest */}
              <section className="space-y-6">
                 <h3 className="text-xl font-bold text-white uppercase tracking-tight ml-2">Current Manifest Queue</h3>
                 <div className="space-y-4">
                    {selection.items.length === 0 ? (
                      <div className="p-16 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 opacity-20">
                         <span className="material-icons text-5xl">swap_horiz</span>
                         <p className="text-xs font-black uppercase tracking-[0.3em]">No assets queued for transfer</p>
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

           {/* Transfer Intelligence Sidebar */}
           <div className="space-y-6">
              <div className="bg-[#131b2e] p-10 rounded-[3rem] border border-white/5 shadow-2xl sticky top-28 space-y-10">
                 <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8c9bbd] mb-4 text-center">Transfer Intelligence</p>
                    <div className="flex justify-between items-end bg-[#0b1326] p-8 rounded-[2rem] border border-white/5 shadow-inner">
                       <span className="text-xs font-bold text-[#8c9bbd] uppercase">Queue Density</span>
                       <span className="text-7xl font-black text-[#4edea3] tracking-tighter">{selection.items.length.toString().padStart(2, '0')}</span>
                    </div>
                 </div>

                 <div className="space-y-6 pt-6 border-t border-white/5">
                    <div className="flex justify-between items-center px-2">
                       <span className="text-[10px] font-bold text-[#8c9bbd] uppercase tracking-widest">Origin Node</span>
                       <span className="text-xs font-black text-white truncate max-w-[120px] text-right">
                          {warehouses.find(w => w.id === selection.sourceId)?.name || 'Not Selected'}
                       </span>
                    </div>
                    <div className="flex justify-between items-center px-2">
                       <span className="text-[10px] font-bold text-[#8c9bbd] uppercase tracking-widest">Target Node</span>
                       <span className="text-xs font-black text-white truncate max-w-[120px] text-right text-[#2e5bff]">
                          {warehouses.find(w => w.id === selection.destinationId)?.name || 'Not Selected'}
                       </span>
                    </div>
                 </div>

                 <div className="pt-4 space-y-4">
                    <button 
                      onClick={commitTransfer}
                      disabled={loading || selection.items.length === 0 || !selection.sourceId || !selection.destinationId}
                      className="w-full py-6 bg-gradient-to-br from-[#4e74ff] to-[#2e5bff] text-white rounded-[2rem] font-black text-lg shadow-2xl shadow-blue-500/40 active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-3 group"
                    >
                      {loading ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>
                           <span className="uppercase tracking-[0.2em]">Commit Transfer</span>
                           <span className="material-icons group-hover:translate-x-1 transition-transform">local_shipping</span>
                        </>
                      )}
                    </button>
                    <p className="text-[9px] text-center text-[#8c9bbd]/50 leading-relaxed px-4 italic">
                       Finalizing will atomically update the digital location of these assets in the central ledger.
                    </p>
                 </div>
              </div>
           </div>
        </div>
      </main>
    </div>
  )
}
