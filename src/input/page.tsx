'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function InputPage() {
  const [stores, setStores] = useState<any[]>([])
  const [storeId, setStoreId] = useState('')
  const [product, setProduct] = useState('')
  const [qty, setQty] = useState(0)

  useEffect(() => {
    fetchStores()
  }, [])

  const fetchStores = async () => {
    const { data } = await supabase.from('stores').select('*')
    setStores(data || [])
  }

  const handleSubmit = async () => {
    const { error } = await supabase.from('sales_reports').insert([
      {
        store_id: storeId,
        product: product,
        qty: qty,
      },
    ])

    if (error) {
      alert('Gagal simpan')
    } else {
      alert('Berhasil disimpan 🔥')
      setProduct('')
      setQty(0)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Input Penjualan</h1>

      <div>
        <label>Pilih Toko:</label><br />
        <select onChange={(e) => setStoreId(e.target.value)}>
          <option value="">-- pilih toko --</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store['NAMA TOKO']}
            </option>
          ))}
        </select>
      </div>

      <br />

      <div>
        <label>Produk:</label><br />
        <input
          value={product}
          onChange={(e) => setProduct(e.target.value)}
        />
      </div>

      <br />

      <div>
        <label>Qty:</label><br />
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
        />
      </div>

      <br />

      <button onClick={handleSubmit}>Simpan</button>
    </div>
  )
}