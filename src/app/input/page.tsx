
'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Html5Qrcode } from 'html5-qrcode'

export default function InputPage() {
  const [stores, setStores] = useState<any[]>([])
  const [filteredStores, setFilteredStores] = useState<any[]>([])
  const [pics, setPics] = useState<string[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [selectedPic, setSelectedPic] = useState('')
  const [storeId, setStoreId] = useState('')
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState(1)
  const [imei, setImei] = useState('')
  const [scanning, setScanning] = useState(false)
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    fetchStores()
    fetchProducts()
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(console.error)
      }
    }
  }, [])

  // ================= STORES =================
  const fetchStores = async () => {
    const { data, error } = await supabase.from('stores').select('*')
    setStores(data || [])
    const uniquePics = [
      ...new Set(
        (data || [])
          .map((item) => item.pic || item.PIC || item.Pic)
          .filter(Boolean)
      ),
    ]
    setPics(uniquePics as string[])
  }

  // ================= PRODUCTS =================
  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*')
    setProducts(data || [])
  }

  // ================= FILTER TOKO =================
  useEffect(() => {
    if (selectedPic) {
      setFilteredStores(
        stores.filter(
          (s) =>
            s.pic === selectedPic ||
            s.PIC === selectedPic ||
            s.Pic === selectedPic
        )
      )
    } else {
      setFilteredStores([])
    }
    setStoreId('')
  }, [selectedPic, stores])

  // ================= SCANNER (STRICT BACK CAMERA LOGIC) =================
  const startScanner = async () => {
    setScanning(true)
    
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        html5QrCodeRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 300, height: 150 }, // Optimized for horizontal barcode
        };

        // STEP 1: Try forcing the environment camera using explicit constraints
        try {
          await html5QrCode.start(
            { facingMode: { exact: "environment" } }, 
            config,
            (decodedText) => {
              setImei(decodedText)
              stopScanner()
            },
            () => {}
          );
        } catch (err) {
          console.warn("Exact environment mode failed, trying non-exact environment...");
          
          // STEP 2: Try non-exact environment mode
          try {
            await html5QrCode.start(
              { facingMode: "environment" },
              config,
              (decodedText) => {
                setImei(decodedText)
                stopScanner()
              },
              () => {}
            );
          } catch (err2) {
            console.warn("Standard environment mode failed, attempting manual camera detection...");
            
            // STEP 3: Manual selection by scanning labels
            const cameras = await Html5Qrcode.getCameras();
            if (cameras && cameras.length > 0) {
              // Priority: Look for "back" or "rear" in the label, otherwise take the last one
              const backCamera = cameras.find(c => 
                c.label.toLowerCase().includes('back') || 
                c.label.toLowerCase().includes('rear') ||
                c.label.toLowerCase().includes('belakang')
              ) || cameras[cameras.length - 1];
              
              await html5QrCode.start(
                backCamera.id,
                config,
                (decodedText) => {
                  setImei(decodedText)
                  stopScanner()
                },
                () => {}
              );
            } else {
              throw new Error("No cameras found");
            }
          }
        }
      } catch (finalErr) {
        console.error("All camera access methods failed:", finalErr);
        alert("Gagal mengakses kamera belakang. Pastikan izin kamera diberikan.");
        setScanning(false);
      }
    }, 300);
  }

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        setScanning(false);
      } catch (err) {
        console.error("Stop failed", err);
        setScanning(false);
      }
    }
  }

  // ================= SUBMIT =================
  const handleSubmit = async () => {
    if (!storeId || !productId || !imei) {
      alert('Lengkapi semua data!')
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) {
      alert('User tidak ditemukan, login ulang!')
      return
    }
    const { error } = await supabase.from('sales_reports').insert([
      {
        store_id: storeId,
        product_id: productId,
        qty: 1,
        imei: imei,
        user_id: userId,
      },
    ])
    if (error) {
      alert('Simpan gagal: ' + error.message)
    } else {
      alert('Berhasil disimpan 🔥')
      setProductId('')
      setStoreId('')
      setImei('')
      setQty(1)
    }
  }

  return (
    <div className="p-5 font-manrope bg-[#0b1326] min-h-screen text-[#dae2fd]">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-black mb-8 text-white uppercase italic tracking-tighter">Input Penjualan</h1>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#8c9bbd] ml-1">Pilih PIC:</label>
            <select
              value={selectedPic}
              onChange={(e) => setSelectedPic(e.target.value)}
              className="w-full bg-[#131b2e] border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 appearance-none"
            >
              <option value="">-- pilih PIC --</option>
              {pics.map((pic, i) => (
                <option key={i} value={pic}>{pic}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#8c9bbd] ml-1">Pilih Toko:</label>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              disabled={!selectedPic}
              className="w-full bg-[#131b2e] border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 appearance-none disabled:opacity-20"
            >
              <option value="">-- pilih toko --</option>
              {filteredStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store['NAMA TOKO'] || store.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#8c9bbd] ml-1">Pilih Produk:</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full bg-[#131b2e] border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 appearance-none"
            >
              <option value="">-- pilih produk --</option>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - Rp {item.price?.toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#8c9bbd] ml-1">IMEI:</label>
            <div className="flex gap-3">
              <input
                placeholder="Ketik atau scan IMEI"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                className="flex-1 bg-[#131b2e] border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50"
              />
              <button 
                onClick={scanning ? stopScanner : startScanner}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${scanning ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' : 'bg-[#2e5bff]/10 text-[#2e5bff] border border-[#2e5bff]/20 shadow-lg'}`}
              >
                <span className="material-icons">{scanning ? 'close' : 'photo_camera'}</span>
              </button>
            </div>
          </div>

          {scanning && (
            <div className="relative rounded-[2rem] overflow-hidden border-2 border-[#2e5bff]/30 shadow-2xl bg-black aspect-video">
              <div id="reader" className="w-full"></div>
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                 <div className="w-[300px] h-[120px] border-4 border-[#4edea3] rounded-2xl relative shadow-[0_0_100px_rgba(0,0,0,0.8)]">
                    <div className="absolute top-1/2 left-0 w-full h-[1px] bg-[#4edea3] animate-pulse"></div>
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#4edea3] text-[#0b1326] text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">Focus IMEI Barcode</div>
                 </div>
              </div>
            </div>
          )}

          <div className="pt-4">
            <button 
              onClick={handleSubmit}
              className="w-full bg-gradient-to-br from-[#4e74ff] to-[#2e5bff] text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-500/20 active:scale-95 transition-all uppercase tracking-widest"
            >
              SIMPAN DATA
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}