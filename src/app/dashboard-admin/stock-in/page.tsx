'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { Html5QrcodeScanner } from 'html5-qrcode'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

interface BatchItem {
  productId: string
  productName: string
  imeis: string[]
}

export default function StockInManualSupplierPage() {
  const [products, setProducts] = useState<any[]>([])
  const [activeBatch, setActiveBatch] = useState<BatchItem[]>([])
  
  const [originInfo, setOriginInfo] = useState({
    supplierName: '',
    deliveryDate: new Date().toISOString().split('T')[0]
  })

  const [currentEntry, setCurrentEntry] = useState({
    productId: '',
    imei: ''
  })

  const [isScanning, setIsScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  useEffect(() => {
    fetchProducts()
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error)
      }
    }
  }, [])

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name')
    setProducts(data || [])
  }

  const startScanner = () => {
    if (!currentEntry.productId) {
      alert('Please select a product before scanning.')
      return
    }
    setIsScanning(true)
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("reader", { 
        fps: 15, 
        qrbox: { width: 300, height: 120 } 
      }, false)
      scanner.render((decodedText) => {
        addImeiToBatch(currentEntry.productId, decodedText)
      }, console.error)
      scannerRef.current = scanner
    }, 100)
  }

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().then(() => setIsScanning(false)).catch(console.error)
    } else {
      setIsScanning(false)
    }
  }

  const addImeiToBatch = (productId: string, imei: string) => {
    const cleanImei = imei.trim()
    if (!cleanImei) return
    
    setActiveBatch(prev => {
      const existingProduct = prev.find(item => item.productId === productId)
      if (existingProduct) {
        if (existingProduct.imeis.includes(cleanImei)) {
          alert('IMEI already exists in this session.')
          return prev
        }
        return prev.map(item => 
          item.productId === productId 
            ? { ...item, imeis: [...item.imeis, cleanImei] } 
            : item
        )
      } else {
        const product = products.find(p => p.id === productId)
        return [...prev, { productId, productName: product?.name || 'Unknown', imeis: [cleanImei] }]
      }
    })
    setCurrentEntry(prev => ({ ...prev, imei: '' }))
  }

  const handleManualAdd = () => {
    if (!currentEntry.productId || !currentEntry.imei) return
    addImeiToBatch(currentEntry.productId, currentEntry.imei)
  }

  const exportToExcel = () => {
    if (activeBatch.length === 0) return
    
    const exportRows: any[] = []
    activeBatch.forEach(item => {
      item.imeis.forEach(imei => {
        exportRows.push({
          'Supplier': originInfo.supplierName || 'Manual Entry',
          'Tanggal Datang': originInfo.deliveryDate,
          'Nama Produk': item.productName,
          'IMEI': imei,
          'Status': 'Draft Stock-In'
        })
      })
    })

    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Stock_In_Batch')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf]), `StockIn_Manifest_${new Date().getTime()}.xlsx`)
  }

  const finalizeStockIn = async () => {
    if (activeBatch.length === 0 || !originInfo.supplierName) {
      alert('Please fill in Supplier Name and add at least one item.')
      return
    }
    
    setLoading(true)
    try {
      for (const item of activeBatch) {
        const { data: tx, error: txError } = await supabase.from('inventory_transactions').insert({
          type: 'STOCK_IN',
          product_id: item.productId,
          quantity: item.imeis.length,
          source_destination: originInfo.supplierName,
          notes: `Batch arrival from: ${originInfo.supplierName} on ${originInfo.deliveryDate}`
        }).select().single()

        if (txError) throw txError

        const itemsToInsert = item.imeis.map(imei => ({
          product_id: item.productId,
          imei,
          status: 'IN_WAREHOUSE',
          last_transaction_id: tx.id
        }))
        const { error: itemsError } = await supabase.from('inventory_items').insert(itemsToInsert)
        if (itemsError) throw itemsError

        const { data: currentProd } = await supabase.from('products').select('current_stock').eq('id', item.productId).single()
        await supabase.from('products')
          .update({ current_stock: (currentProd?.current_stock || 0) + item.imeis.length })
          .eq('id', item.productId)
      }

      alert('Inventory synced successfully!')
      setActiveBatch([])
      setOriginInfo({ supplierName: '', deliveryDate: new Date().toISOString().split('T')[0] })
      setCurrentEntry({ productId: '', imei: '' })
    } catch (error: any) {
      alert('Sync Failed: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-manrope">
      <main className="pl-64 pt-20 p-8 max-w-7xl mx-auto space-y-10">
        <header className="flex justify-between items-center">
           <div className="space-y-1">
             <h1 className="text-4xl font-black text-white uppercase italic tracking-tight">Admin Stock-In</h1>
             <p className="text-[#8c9bbd] text-sm font-medium uppercase tracking-widest">Stock Entry</p>
           </div>
           <div className="flex gap-4">
              <button 
                onClick={exportToExcel}
                disabled={activeBatch.length === 0}
                className="px-6 py-2 bg-white/5 border border-white/10 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-all disabled:opacity-30"
              >
                 <span className="material-icons text-sm">download</span> Export Batch
              </button>
              <span className="px-4 py-2 bg-[#4edea3]/10 border border-[#4edea3]/20 text-[#4edea3] rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                 <span className="w-2 h-2 bg-[#4edea3] rounded-full animate-pulse"></span> Terminal Active
              </span>
           </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-8">
              <section className="bg-[#131b2e]/60 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c9bbd] ml-1">Supplier Origin</label>
                       <input 
                         type="text" 
                         placeholder="Name of Suplier..."
                         value={originInfo.supplierName}
                         onChange={(e) => setOriginInfo({...originInfo, supplierName: e.target.value})}
                         className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 transition-all"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c9bbd] ml-1">Arrival Date</label>
                       <input 
                         type="date"
                         value={originInfo.deliveryDate}
                         onChange={(e) => setOriginInfo({...originInfo, deliveryDate: e.target.value})}
                         className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 transition-all"
                       />
                    </div>
                 </div>
              </section>

              <section className="bg-[#131b2e]/60 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#2e5bff]/10 flex items-center justify-center text-[#2e5bff]">
                      <span className="material-icons">qr_code_scanner</span>
                    </div>
                    <h3 className="text-xl font-black text-white uppercase">Batch Scan</h3>
                 </div>

                 {isScanning && (
                   <div className="relative mb-8 rounded-[2rem] overflow-hidden border-2 border-[#2e5bff]/30 shadow-2xl">
                      <div id="reader" className="w-full"></div>
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                         <div className="w-[300px] h-[120px] border-2 border-[#4edea3] rounded-xl relative shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-[#4edea3] animate-pulse"></div>
                         </div>
                      </div>
                   </div>
                 )}

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c9bbd] ml-1">Select Product</label>
                       <select 
                         value={currentEntry.productId}
                         onChange={(e) => setCurrentEntry({...currentEntry, productId: e.target.value})}
                         className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 transition-all"
                       >
                          <option value="">-- Choose Product --</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c9bbd] ml-1">IMEI Entry</label>
                       <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Type manually..."
                            value={currentEntry.imei}
                            onChange={(e) => setCurrentEntry({...currentEntry, imei: e.target.value})}
                            onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
                            className="flex-1 bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 transition-all"
                          />
                          <button 
                            onClick={isScanning ? stopScanner : startScanner}
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isScanning ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' : 'bg-[#2e5bff]/10 text-[#2e5bff] border border-[#2e5bff]/20 hover:bg-[#2e5bff] hover:text-white'}`}
                          >
                            <span className="material-icons">{isScanning ? 'close' : 'photo_camera'}</span>
                          </button>
                       </div>
                    </div>
                 </div>

                 <button 
                   onClick={handleManualAdd}
                   disabled={!currentEntry.productId || !currentEntry.imei}
                   className="w-full py-4 bg-[#2e5bff] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 disabled:opacity-50 transition-all"
                 >
                   Queue Item
                 </button>
              </section>

              <section className="space-y-6">
                 <h3 className="text-xl font-bold text-white uppercase tracking-tight ml-2">Incoming Items List</h3>
                 <div className="space-y-4">
                    {activeBatch.length === 0 ? (
                      <div className="p-16 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 opacity-30">
                         <span className="material-icons text-5xl">inventory_2</span>
                         <p className="text-xs font-black uppercase tracking-[0.3em]">Items is empty</p>
                      </div>
                    ) : (
                      activeBatch.map((item, i) => (
                        <div key={i} className="p-8 bg-[#131b2e]/60 border border-white/5 rounded-[2.5rem] shadow-xl space-y-6">
                           <div className="flex justify-between items-start">
                              <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 rounded-2xl bg-[#2e5bff]/10 flex items-center justify-center text-[#2e5bff]">
                                   <span className="material-icons text-2xl">devices</span>
                                 </div>
                                 <div>
                                    <h4 className="text-lg font-black text-white">{item.productName}</h4>
                                    <p className="text-[10px] font-bold text-[#4edea3] uppercase tracking-widest">Ready: {item.imeis.length} units</p>
                                 </div>
                              </div>
                              <button onClick={() => setActiveBatch(activeBatch.filter((_, idx) => idx !== i))} className="text-rose-500 opacity-20 hover:opacity-100 transition-opacity">
                                 <span className="material-icons">delete_outline</span>
                              </button>
                           </div>
                           <div className="flex flex-wrap gap-2">
                              {item.imeis.map((imei, idx) => (
                                <div key={idx} className="px-4 py-2 bg-[#0b1326] border border-white/5 rounded-xl flex items-center gap-3">
                                   <span className="text-[10px] font-mono font-bold text-[#8c9bbd]">{imei}</span>
                                   <button onClick={() => {
                                      const newImeis = item.imeis.filter((_, subIdx) => subIdx !== idx);
                                      if (newImeis.length === 0) {
                                         setActiveBatch(activeBatch.filter((_, mainIdx) => mainIdx !== i));
                                      } else {
                                         setActiveBatch(activeBatch.map((obj, mainIdx) => mainIdx === i ? {...obj, imeis: newImeis} : obj));
                                      }
                                   }} className="text-rose-500/40 hover:text-rose-500 transition-colors">
                                      <span className="material-icons text-xs">close</span>
                                   </button>
                                </div>
                              ))}
                           </div>
                        </div>
                      ))
                    )}
                 </div>
              </section>
           </div>

           <div className="space-y-6">
              <div className="bg-[#131b2e] p-10 rounded-[3rem] border border-white/5 shadow-2xl sticky top-28 space-y-10">
                 <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8c9bbd] mb-4 text-center">Batch Summary</p>
                    <div className="flex justify-between items-end bg-[#0b1326] p-8 rounded-[2rem] border border-white/5 shadow-inner">
                       <span className="text-xs font-bold text-[#8c9bbd] uppercase">Total Items</span>
                       <span className="text-7xl font-black text-[#4edea3] tracking-tighter">{activeBatch.reduce((sum, i) => sum + i.imeis.length, 0).toString().padStart(2, '0')}</span>
                    </div>
                 </div>

                 <button 
                   onClick={finalizeStockIn}
                   disabled={loading || activeBatch.length === 0 || !originInfo.supplierName}
                   className="w-full py-6 bg-gradient-to-br from-[#4e74ff] to-[#2e5bff] text-white rounded-[2rem] font-black text-lg shadow-2xl shadow-blue-500/40 active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-3 group"
                 >
                   {loading ? (
                     <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                   ) : (
                     <>
                        <span className="uppercase tracking-[0.2em]">Submit Entry</span>
                        <span className="material-icons group-hover:translate-x-1 transition-transform">rocket_launch</span>
                     </>
                   )}
                 </button>
              </div>
           </div>
        </div>
      </main>
    </div>
  )
}
