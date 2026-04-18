
'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    fetchStores()
    fetchProducts()
  }, [])

  // ================= STORES =================
  const fetchStores = async () => {
    const { data, error } = await supabase.from('stores').select('*')
    console.log('🔥 STORES:', data)
    console.log('❌ ERROR:', error)
    setStores(data || [])
    // 🔥 HANDLE SEMUA KEMUNGKINAN FIELD PIC
    const uniquePics = [
      ...new Set(
        (data || [])
          .map((item) => item.pic || item.PIC || item.Pic)
          .filter(Boolean)
      ),
    ]
    console.log('🔥 PICS:', uniquePics)
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

  // ================= SCANNER (OPTIMIZED FOR BACK CAMERA) =================
  const startScanner = async () => {
    setScanning(true)
    const html5QrCode = new Html5Qrcode('reader')
    
    try {
      // Configuration for high-accuracy barcode scanning
      const config = {
        fps: 10,
        qrbox: 250,
      }

      // Automatically try to use environment-facing camera (back camera)
      await html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        (decodedText) => {
          setImei(decodedText)
          html5QrCode.stop().then(() => {
            setScanning(false)
          }).catch(err => console.error(err))
        },
        (errorMessage) => {
          // Scanning failures are common while aiming, so we just log them
        }
      )
    } catch (err) {
      console.error('Camera access error:', err)
      alert('Gagal mengakses kamera belakang. Pastikan izin kamera aktif.')
      setScanning(false)
    }
  }

  // ================= SUBMIT =================
  const handleSubmit = async () => {
    if (!storeId || !productId || !imei) {
      alert('Lengkapi semua data!')
      return
    }
    if (imei.length < 10) {
      alert('IMEI tidak valid')
      return
    }
    // 🔥 ambil user login
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
      console.error(error)
      alert('IMEI mungkin sudah terpakai!')
    } else {
      alert('Berhasil disimpan 🔥')
      setProductId('')
      setStoreId('')
      setImei('')
      setQty(1)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Input Penjualan</h1>
      
      {/* PIC */}
      <div>
        <label>Pilih PIC:</label><br />
        <select
          value={selectedPic}
          onChange={(e) => setSelectedPic(e.target.value)}
        >
          <option value="">-- pilih PIC --</option>
          {pics.map((pic, i) => (
            <option key={i} value={pic}>
              {pic}
            </option>
          ))}
        </select>
      </div>
      <br />

      {/* TOKO */}
      <div>
        <label>Pilih Toko:</label><br />
        <select
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          disabled={!selectedPic}
        >
          <option value="">-- pilih toko --</option>
          {filteredStores.map((store) => (
            <option key={store.id} value={store.id}>
              {store['NAMA TOKO'] || store.name}
            </option>
          ))}
        </select>
      </div>
      <br />

      {/* PRODUK */}
      <div>
        <label>Pilih Produk:</label><br />
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          <option value="">-- pilih produk --</option>
          {products.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} - Rp {item.price?.toLocaleString()}
            </option>
          ))}
        </select>
      </div>
      <br />

      {/* IMEI */}
      <div>
        <label>IMEI:</label><br />
        <input
          placeholder="Ketik atau scan IMEI"
          value={imei}
          onChange={(e) => setImei(e.target.value)}
        />
        <br /><br />
        <button onClick={startScanner}>
          📷 Scan IMEI
        </button>
      </div>
      <br />

      {/* CAMERA CONTAINER */}
      {scanning && (
        <div id="reader" style={{ width: 300, border: '1px solid #ccc', borderRadius: '10px', overflow: 'hidden' }} />
      )}
      <br />

      {/* QTY */}
      <div>
        <label>Qty:</label><br />
        <input value={1} disabled />
      </div>
      <br />

      <button onClick={handleSubmit}>Simpan</button>
    </div>
  )
}
