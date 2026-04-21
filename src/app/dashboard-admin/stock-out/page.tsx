
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

interface Warehouse {
  id: string
  name: string
  address: string
  pic_name: string
}

export default function StockOutPage() {
  const [stores, setStores] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selection, setSelection] = useState({
    storeId: '',
    priority: 'STANDARD',
    items: [] as ScannedItem[]
  })
  const [isScanning, setIsScanning] = useState(false)
  const [manualImei, setManualImei] = useState('')
  const [loading, setLoading] = useState(false)
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    fetchInitialData()
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(console.error)
      }
    }
  }, [])

  const fetchInitialData = async () => {
    try {
      const [storesRes, warehousesRes] = await Promise.all([
        supabase.from('stores').select('*').order('name'),
        supabase.from('warehouses').select('*')
      ])
      setStores(storesRes.data || [])
      setWarehouses(warehousesRes.data || [])
    } catch (err) {
      console.error('Error fetching data:', err)
    }
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
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) return;
    
    setIsScanning(true)
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        html5QrCodeRef.current = html5QrCode;
        const config = { fps: 20, qrbox: { width: 300, height: 120 } };
        
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
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
        setIsScanning(false);
      } catch (err) {
        console.error(err);
        setIsScanning(false);
      }
    } else {
      setIsScanning(false);
    }
  }

  const handlePrintInvoice = () => {
    if (!selection.storeId || selection.items.length === 0) {
      alert('Pilih toko dan scan barang terlebih dahulu.');
      return;
    }

    const selectedStore = stores.find(s => s.id === selection.storeId);
    const storeName = selectedStore?.name || 'Unknown Store';
    const storePic = selectedStore?.pic || 'Store Manager';
    
    const warehouse = warehouses.find(w => w.id === selectedStore?.warehouse_id) || {
      name: 'PT. OUMAN INVESTMENT AND TRADE',
      address: 'Nusa Tenggara Timur',
      pic_name: 'Warehouse Admin'
    };

    const date = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const invoiceId = `NTT-${Math.floor(10000 + Math.random() * 90000)}`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = selection.items.map((item, index) => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px; text-align: center;">${(index + 1).toString().padStart(2, '0')}</td>
        <td style="padding: 10px;">${item.productName}</td>
        <td style="padding: 10px; font-family: monospace;">${item.imei}</td>
        <td style="padding: 10px; text-align: center;">1</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice - ${invoiceId}</title>
          <style>
            body { font-family: 'Inter', sans-serif; color: #1a1a1a; margin: 0; padding: 40px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #2e5bff; padding-bottom: 20px; }
            .logo { font-size: 24px; font-weight: 800; color: #2e5bff; text-transform: uppercase; }
            .invoice-info { text-align: right; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .section-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #888; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            th { background: #f8fafc; font-size: 10px; text-transform: uppercase; padding: 12px 10px; text-align: left; border-bottom: 2px solid #eee; }
            .footer { margin-top: 60px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; }
            .sig-box { height: 80px; border-bottom: 1px solid #000; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">Nubia NTT 东</div>
              <h1 style="margin: 10px 0 0 0; font-size: 20px;">SURAT JALAN</h1>
            </div>
            <div class="invoice-info">
              <p style="margin: 0; font-weight: bold;">${invoiceId}</p>
              <p style="margin: 0; color: #666;">${date}</p>
            </div>
          </div>
          <div class="grid">
            <div>
              <div class="section-title">Origin / Dari</div>
              <p style="margin: 0; font-weight: bold;">${warehouse.name}</p>
              <p style="margin: 0; font-size: 13px; color: #666;">${warehouse.address}</p>
            </div>
            <div>
              <div class="section-title">Destination / Tujuan</div>
              <p style="margin: 0; font-weight: bold;">${storeName}</p>
              <p style="margin: 0; font-size: 13px; color: #666;">Attn: ${storePic}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">No</th>
                <th>Nama Produk</th>
                <th>IMEI / Serial</th>
                <th style="width: 60px;">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div style="text-align: right; margin-bottom: 60px;">
            <p style="margin: 0; font-size: 14px;">Total Units: <span style="font-size: 24px; font-weight: 900; color: #2e5bff; margin-left: 10px;">${selection.items.length}</span></p>
          </div>
          <div class="footer">
            <div><div class="sig-box"></div><p style="margin: 0; font-size: 12px; font-weight: bold;">${warehouse.pic_name || 'Warehouse Admin'}</p></div>
            <div><div class="sig-box"></div><p style="margin: 0; font-size: 12px; font-weight: bold;">Courier / Driver</p></div>
            <div><div class="sig-box"></div><p style="margin: 0; font-size: 12px; font-weight: bold;">Store Receiver (${storePic})</p></div>
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  const handleExportExcel = () => {
    if (selection.items.length === 0) {
      alert('Belum ada barang yang discan.')
      return
    }
    
    try {
      const storeName = stores.find(s => s.id === selection.storeId)?.name || 'Not Selected'
      const exportRows = selection.items.map(item => ({
        'Toko Tujuan': storeName,
        'Prioritas': selection.priority,
        'Nama Produk': item.productName,
        'IMEI': item.imei,
        'Status': 'Draft Dispatch'
      }))

      const ws = XLSX.utils.json_to_sheet(exportRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Stock_Out_Manifest')
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      saveAs(new Blob([buf], { type: 'application/octet-stream' }), `StockOut_Manifest_${new Date().getTime()}.xlsx`)
    } catch (err) {
      console.error('Export Error:', err)
      alert('Failed to export Excel.')
    }
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
      await supabase.from('inventory_items').update({ status: 'SHIPPED', last_transaction_id: tx.id }).in('id', itemIds)
      
      const productCounts = selection.items.reduce((acc: any, item) => {
        acc[item.product_id] = (acc[item.product_id] || 0) + 1
        return acc
      }, {})

      for (const pid in productCounts) {
        const { data: prod } = await supabase.from('products').select('current_stock').eq('id', pid).single()
        await supabase.from('products').update({ current_stock: (prod?.current_stock || 0) - productCounts[pid] }).eq('id', pid)
      }
      alert('Success! Dispatch complete.')
      setSelection({ storeId: '', priority: 'STANDARD', items: [] })
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-manrope">
      <main className="lg:pl-64 pt-20 p-6 max-w-7xl mx-auto space-y-10 pb-32">
        <header className="flex justify-between items-center">
           <div className="space-y-1">
             <h1 className="text-4xl font-black text-white uppercase italic tracking-tight">Order Fulfillment</h1>
             <p className="text-[#8c9bbd] text-sm font-medium uppercase tracking-widest">Process store deployments</p>
           </div>
           <div className="flex gap-4">
              <button onClick={handlePrintInvoice} className="px-6 py-2 bg-white/5 border border-white/10 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-all">
                 <span className="material-icons text-sm">print</span> Print Invoice
              </button>
              <button onClick={handleExportExcel} className="px-6 py-2 bg-white/5 border border-white/10 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-all">
                 <span className="material-icons text-sm">download</span> Export Excel
              </button>
           </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-8">
              <section className="bg-[#131b2e]/60 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c9bbd]">Destination Node</label>
                       <select 
                         value={selection.storeId}
                         onChange={(e) => setSelection({...selection, storeId: e.target.value})}
                         className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none appearance-none"
                       >
                          <option value="">Select Destination Store</option>
                          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c9bbd]">Priority</label>
                       <div className="flex p-1 bg-[#0b1326] rounded-2xl border border-white/5">
                          {['STANDARD', 'EXPRESS', 'CRITICAL'].map(p => (
                            <button key={p} type="button" onClick={() => setSelection({...selection, priority: p})} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${selection.priority === p ? 'bg-[#2e5bff] text-white' : 'text-[#8c9bbd]'}`}>
                              {p}
                            </button>
                          ))}
                       </div>
                    </div>
                 </div>
              </section>

              <section className="bg-[#131b2e]/60 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8">
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
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#4edea3] text-[#0b1326] text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">Focus IMEI 1 Barcode</div>
                         </div>
                      </div>
                   </div>
                 )}

                 <div className="flex gap-4">
                    <input 
                      type="text" 
                      placeholder="Type serial number..."
                      value={manualImei}
                      onChange={(e) => setManualImei(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), validateAndAddImei(manualImei))}
                      className="flex-1 bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none"
                    />
                    <button onClick={isScanning ? stopScanner : startScanner} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isScanning ? 'bg-rose-500/20 text-rose-500' : 'bg-[#2e5bff]/10 text-[#2e5bff] border border-[#2e5bff]/20 hover:bg-[#2e5bff] hover:text-white'}`}>
                       <span className="material-icons">{isScanning ? 'close' : 'photo_camera'}</span>
                    </button>
                 </div>
                 <button onClick={() => validateAndAddImei(manualImei)} className="w-full py-4 bg-[#2e5bff]/10 border border-[#2e5bff]/20 text-[#2e5bff] rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 hover:bg-[#2e5bff] hover:text-white">Verify and Queue</button>
              </section>

              <section className="space-y-4">
                 {selection.items.map((item, i) => (
                    <div key={i} className="p-6 bg-[#131b2e]/60 border border-white/5 rounded-[2.5rem] flex justify-between items-center group transition-all hover:border-[#2e5bff]/30 shadow-xl">
                       <div className="flex items-center gap-6">
                          <span className="material-icons text-[#4edea3]">check_circle</span>
                          <div>
                             <h4 className="text-lg font-black text-white">{item.productName}</h4>
                             <p className="text-[10px] font-mono font-bold text-[#8c9bbd] uppercase">IMEI: {item.imei}</p>
                          </div>
                       </div>
                       <button onClick={() => setSelection(prev => ({...prev, items: prev.items.filter((_, idx) => idx !== i)}))} className="text-rose-500 opacity-20 hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white">
                          <span className="material-icons text-sm">delete_sweep</span>
                       </button>
                    </div>
                 ))}
              </section>
           </div>

           <div className="space-y-6">
              <div className="bg-[#131b2e] p-8 rounded-[3rem] border border-white/5 shadow-2xl sticky top-28 space-y-10">
                 <div className="flex justify-between items-end bg-[#0b1326] p-8 rounded-[2rem] border border-white/5 shadow-inner">
                    <span className="text-xs font-bold text-[#8c9bbd] uppercase">Total Units</span>
                    <span className="text-7xl font-black text-[#4edea3] tracking-tighter">{selection.items.length.toString().padStart(2, '0')}</span>
                 </div>
                 <button onClick={processOrder} disabled={loading || selection.items.length === 0 || !selection.storeId} className="w-full py-6 bg-gradient-to-br from-[#4e74ff] to-[#2e5bff] text-white rounded-[2rem] font-black text-lg shadow-xl active:scale-95 disabled:opacity-30">
                    {loading ? 'Processing...' : 'Submit Sell-In'}
                 </button>
              </div>
           </div>
        </div>
      </main>
    </div>
  )
}
