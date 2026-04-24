'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { Html5QrcodeScanner } from 'html5-qrcode'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

interface BatchItem {
  productId: string
  productName: string
  imeis: { imei: string; warehouseId: string }[]
}

export default function StockInManualSupplierPage() {
  const [products, setProducts] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [activeBatch, setActiveBatch] = useState<BatchItem[]>([])
  
  const [originInfo, setOriginInfo] = useState({
    supplierName: '',
    deliveryDate: new Date().toISOString().split('T')[0]
  })
  
  const [currentEntry, setCurrentEntry] = useState({
    productId: '',
    imei: '',
    warehouseId: ''
  })
  
  const [isScanning, setIsScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  useEffect(() => {
    fetchInitialData()
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error)
      }
    }
  }, [])

  const fetchInitialData = async () => {
    try {
      const { data: pData } = await supabase.from('products').select('*').order('name')
      const { data: wData } = await supabase.from('warehouses').select('*').order('name')
      setProducts(pData || [])
      setWarehouses(wData || [])
    } catch (err) {
      console.error('Error fetching initial data:', err)
    }
  }

  const startScanner = () => {
    if (!currentEntry.productId || !currentEntry.warehouseId) {
      alert('Please select a product and a warehouse before scanning.')
      return
    }
    setIsScanning(true)
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("reader", { 
        fps: 15, 
        qrbox: { width: 300, height: 120 } 
      }, false)
      scanner.render((decodedText) => {
        addImeiToBatch(currentEntry.productId, decodedText, currentEntry.warehouseId)
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

  const addImeiToBatch = (productId: string, imeiInput: string, warehouseId: string) => {
    if (!imeiInput.trim()) return
    
    // LOGIC: Split the input into a list based on newlines, commas, or spaces
    const imeiList = imeiInput
      .split(/[\n, ]+/)
      .map(item => item.trim())
      .filter(item => item !== '')

    if (imeiList.length === 0) return

    setActiveBatch(prev => {
      const existingProductIndex = prev.findIndex(item => item.productId === productId)
      
      let updatedBatch = [...prev]
      let currentImeis = existingProductIndex !== -1 ? [...prev[existingProductIndex].imeis] : []
      let skippedCount = 0

      imeiList.forEach(imei => {
        if (!currentImeis.some(i => i.imei === imei)) {
          currentImeis.push({ imei, warehouseId })
        } else {
          skippedCount++
        }
      })

      if (skippedCount > 0) {
        console.warn(`${skippedCount} IMEIs were duplicates and skipped.`)
      }

      if (existingProductIndex !== -1) {
        updatedBatch[existingProductIndex] = { ...updatedBatch[existingProductIndex], imeis: currentImeis }
      } else {
        const product = products.find(p => p.id === productId)
        updatedBatch.push({ 
          productId, 
          productName: product?.name || 'Unknown', 
          imeis: currentImeis 
        })
      }

      return updatedBatch
    })
    
    setCurrentEntry(prev => ({ ...prev, imei: '' }))
  }

  const handleManualAdd = () => {
    if (!currentEntry.productId || !currentEntry.imei || !currentEntry.warehouseId) {
      alert('Please select a product, a warehouse, and enter at least one IMEI.')
      return
    }
    addImeiToBatch(currentEntry.productId, currentEntry.imei, currentEntry.warehouseId)
  }

  const handleExportCurrentBatch = () => {
    if (activeBatch.length === 0) {
      alert('Active batch list is empty.')
      return
    }
    
    try {
      const exportRows: any[] = []
      activeBatch.forEach(item => {
        item.imeis.forEach(entry => {
          const warehouseName = warehouses.find(w => w.id === entry.warehouseId)?.name || 'Unknown'
          exportRows.push({
            'Type': 'CURRENT_BATCH',
            'Supplier': originInfo.supplierName || 'Manual Entry',
            'Tanggal': originInfo.deliveryDate,
            'Nama Produk': item.productName,
            'IMEI': entry.imei,
            'Gudang': warehouseName,
            'Status': 'Draft Stock-In'
          })
        })
      })
      generateExcel(exportRows, 'Current_StockIn_Batch')
    } catch (err) {
      console.error('Export Error:', err)
      alert('Failed to export Excel.')
    }
  }

  const handleExportHistory = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          imei, 
          created_at, 
          status,
          products (name),
          location:location_id (name)
        `)
        .eq('status', 'IN_WAREHOUSE')
        .order('created_at', { ascending: false })
      if (error) throw error
      if (!data || data.length === 0) {
        alert('No historical stock-in data found.')
        return
      }
      const exportRows = data.map((item: any) => ({
        'Type': 'HISTORICAL_STOCK',
        'Tanggal Masuk': new Date(item.created_at).toLocaleString(),
        'Nama Produk': item.products?.name || 'Unknown',
        'IMEI': item.imei,
        'Gudang': item.location?.name || 'Main Warehouse',
        'Status': item.status
      }))
      generateExcel(exportRows, 'StockIn_History_Full')
    } catch (err: any) {
      console.error('History Export Failed:', err)
      alert('History Export Failed. Make sure to run the SQL Relationship fix first.')
    } finally {
      setLoading(false)
    }
  }

  const generateExcel = (rows: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Stock_Data')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `${fileName}_${new Date().getTime()}.xlsx`)
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
        const itemsToInsert = item.imeis.map(entry => ({
          product_id: item.productId,
          imei: entry.imei,
          status: 'IN_WAREHOUSE',
          location_id: entry.warehouseId,
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
      setCurrentEntry({ productId: '', imei: '', warehouseId: '' })
    } catch (error: any) {
      alert('Sync Failed: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-manrope">
      <main className="lg:pl-64 pt-20 p-6 max-w-7xl mx-auto space-y-10 pb-32">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div className="space-y-1">
             <h1 className="text-4xl font-black text-white uppercase italic tracking-tight">Penerimaan Barang</h1>
             <p className="text-[#8c9bbd] text-sm font-medium uppercase tracking-widest">Pencatatan Penerimaan Barang Supplier</p>
           </div>
           <div className="flex flex-wrap gap-3">
              <button 
                onClick={handleExportCurrentBatch}
                className="px-6 py-2 bg-[#2e5bff]/10 border border-[#2e5bff]/20 text-[#2e5bff] rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#2e5bff] hover:text-white transition-all"
              >
                 <span className="material-icons text-sm">download</span> Eksport Excel Batch Aktif
              </button>
              <button 
                onClick={handleExportHistory}
                className="px-6 py-2 bg-white/5 border border-white/10 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-all"
              >
                 <span className="material-icons text-sm">history</span> Export Riwayat Barang Masuk
              </button>
           </div>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-8">
              <section className="bg-[#131b2e]/60 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c9bbd]">Sumber Supplier</label>
                       <input 
                         type="text" 
                         value={originInfo.supplierName}
                         onChange={(e) => setOriginInfo({...originInfo, supplierName: e.target.value})}
                         className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-2 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50"
                         placeholder="Input nama supplier (ketik manual)..."
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c9bbd]">Tanggal Barang Masuk</label>
                       <input 
                         type="date"
                         value={originInfo.deliveryDate}
                         onChange={(e) => setOriginInfo({...originInfo, deliveryDate: e.target.value})}
                         className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50"
                       />
                    </div>
                 </div>
              </section>
              <section className="bg-[#131b2e]/60 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8">
                 <div id="reader" className={`${isScanning ? 'block' : 'hidden'} mb-8 rounded-[2rem] overflow-hidden border-2 border-[#2e5bff]/30`}></div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c9bbd]">Product</label>
                       <select 
                         value={currentEntry.productId}
                         onChange={(e) => setCurrentEntry({...currentEntry, productId: e.target.value})}
                         className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none appearance-none"
                       >
                          <option value="">-- Pilih Product --</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c9bbd]">Warehouse Node</label>
                       <select 
                         value={currentEntry.warehouseId}
                         onChange={(e) => setCurrentEntry({...currentEntry, warehouseId: e.target.value})}
                         className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none appearance-none"
                       >
                          <option value="">-- Pilih Gudang --</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                       </select>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <textarea 
                      placeholder="Input atau Paste List IMEI 1 (Pisahkan dengan baris baru, koma, atau spasi)..."
                      value={currentEntry.imei}
                      onChange={(e) => setCurrentEntry({...currentEntry, imei: e.target.value})}
                      className="flex-1 bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none min-h-[120px] resize-none"
                    />
                    <div className="flex flex-col gap-2">
                       <button onClick={isScanning ? stopScanner : startScanner} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isScanning ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' : 'bg-[#2e5bff]/10 text-[#2e5bff] border border-[#2e5bff]/20'}`}>
                          <span className="material-icons">{isScanning ? 'close' : 'photo_camera'}</span>
                       </button>
                    </div>
                 </div>
                 <button onClick={handleManualAdd} className="w-full py-4 bg-[#2e5bff] text-white rounded-2xl font-black uppercase text-xs active:scale-95 transition-transform">Tambahkan ke Daftar</button>
              </section>
              <section className="space-y-4">
                 {activeBatch.length === 0 ? (
                    <div className="p-16 border-2 border-dashed border-white/5 rounded-[2.5rem] text-center opacity-30">
                       <span className="material-icons text-5xl mb-2">inventory_2</span>
                       <p className="text-xs font-bold uppercase tracking-widest">Belum Ada Barang Ditambahkan</p>
                    </div>
                 ) : (
                    activeBatch.map((item, i) => (
                       <div key={i} className="p-6 bg-[#131b2e]/60 border border-white/5 rounded-[2.5rem] shadow-xl space-y-4">
                          <div className="flex justify-between items-center">
                             <h4 className="font-black text-white">{item.productName}</h4>
                             <span className="text-[10px] font-bold text-[#4edea3] uppercase">{item.imeis.length} units</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                             {item.imeis.map((entry, idx) => (
                                <div key={idx} className="px-3 py-1.5 bg-[#0b1326] border border-white/5 rounded-xl flex items-center gap-2">
                                   <span className="text-[10px] font-mono text-[#8c9bbd]">{entry.imei}</span>
                                   <span className="text-[8px] font-bold text-[#2e5bff] uppercase">{warehouses.find(w => w.id === entry.warehouseId)?.name.split(' ')[0]}</span>
                                   <button 
                                      onClick={() => {
                                         const newImeis = item.imeis.filter((_, subIdx) => subIdx !== idx);
                                         if (newImeis.length === 0) {
                                            setActiveBatch(activeBatch.filter((_, mainIdx) => mainIdx !== i));
                                         } else {
                                            setActiveBatch(activeBatch.map((obj, mainIdx) => mainIdx === i ? {...obj, imeis: newImeis} : obj));
                                         }
                                      }}
                                      className="text-rose-500/40 hover:text-rose-500 transition-colors material-icons text-xs"
                                   >
                                      close
                                   </button>
                                </div>
                             ))}
                          </div>
                       </div>
                    ))
                 )}
              </section>
           </div>
           <div className="space-y-6">
              <div className="bg-[#131b2e] p-8 rounded-[3rem] border border-white/5 shadow-2xl sticky top-28 space-y-8">
                 <div className="flex justify-between items-end bg-[#0b1326] p-6 rounded-[2rem]">
                    <span className="text-xs font-bold text-[#8c9bbd] uppercase">Total Saat Ini</span>
                    <span className="text-5xl font-black text-[#4edea3]">{activeBatch.reduce((sum, item) => sum + item.imeis.length, 0)}</span>
                 </div>
                 <button 
                   onClick={finalizeStockIn}
                   disabled={loading || activeBatch.length === 0 || !originInfo.supplierName}
                   className="w-full py-6 bg-gradient-to-br from-[#4e74ff] to-[#2e5bff] text-white rounded-[2rem] font-black text-lg shadow-xl active:scale-95 disabled:opacity-30 flex items-center justify-center gap-2"
                 >
                   {loading ? (
                      <>
                         <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                         <span>Syncing Ledger...</span>
                      </>
                   ) : 'Simpan ke Sistem Stok'}
                 </button>
                 <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-black text-[#8c9bbd] uppercase tracking-[0.2em] mb-3">Informasi Sistem</p>
                    <p className="text-[11px] leading-relaxed text-[#dae2fd]/60 italic">
                       Proses ini akan mendaftarkan setiap IMEI 1 ke Database dan menambahkan stok secara otomatis.
                    </p>
                 </div>
              </div>
           </div>
        </div>
      </main>
    </div>
  )
}
