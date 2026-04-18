
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
    
    // Ensure the container is ready
    setTimeout(async () => {
      const html5QrCode = new Html5Qrcode("reader");
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
      };

      try {
        // Method 1: Try using the "environment" facing mode directly (Standard)
        await html5QrCode.start(
          { facingMode: "environment" }, 
          config,
          (decodedText) => {
            setImei(decodedText)
            stopScanner()
          },
          () => {} // Ignore scan failures
        );
      } catch (err) {
        console.warn("Direct facingMode failed, trying manual camera selection...");
        try {
          // Method 2: Manual fallback - get all cameras and pick the last one (usually the main back camera)
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const backCamera = cameras[cameras.length - 1];
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
        } catch (manualErr) {
          console.error("All camera access methods failed:", manualErr);
          alert("Gagal mengakses kamera belakang. Pastikan izin kamera diberikan dan coba segarkan halaman.");
          setScanning(false);
        }
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
    <div className="p-5 font-sans">
      <h1 className="text-xl font-bold mb-5">Input Penjualan</h1>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Pilih PIC:</label>
        <select
          value={selectedPic}
          onChange={(e) => setSelectedPic(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="">-- pilih PIC --</option>
          {pics.map((pic, i) => (
            <option key={i} value={pic}>{pic}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Pilih Toko:</label>
        <select
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          disabled={!selectedPic}
          className="w-full p-2 border rounded disabled:bg-gray-100"
        >
          <option value="">-- pilih toko --</option>
          {filteredStores.map((store) => (
            <option key={store.id} value={store.id}>
              {store['NAMA TOKO'] || store.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Pilih Produk:</label>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="">-- pilih produk --</option>
          {products.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} - Rp {item.price?.toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">IMEI:</label>
        <div className="flex gap-2">
          <input
            placeholder="Ketik atau scan IMEI"
            value={imei}
            onChange={(e) => setImei(e.target.value)}
            className="flex-1 p-2 border rounded"
          />
          <button 
            onClick={scanning ? stopScanner : startScanner}
            className={`px-4 py-2 rounded text-white font-bold ${scanning ? 'bg-red-500' : 'bg-blue-600'}`}
          >
            {scanning ? 'Stop' : '📷 Scan'}
          </button>
        </div>
      </div>

      {scanning && (
        <div className="mb-6 border-2 border-blue-500 rounded-xl overflow-hidden shadow-lg">
          <div id="reader" className="w-full bg-black"></div>
          <div className="bg-blue-600 text-white text-[10px] text-center py-1 uppercase font-bold">Kamera Belakang Aktif</div>
        </div>
      )}

      <button 
        onClick={handleSubmit}
        className="w-full bg-green-600 text-white py-3 rounded-lg font-bold shadow-lg active:scale-95 transition-transform"
      >
        SIMPAN DATA
      </button>
    </div>
  )
}