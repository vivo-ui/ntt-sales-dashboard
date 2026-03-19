'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [stores, setStores] = useState<any[]>([])

  useEffect(() => {
    fetchStores()
  }, [])

  const fetchStores = async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('*')

    if (error) {
      console.error(error)
    } else {
      setStores(data)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Aplikasi Tracking Penjualan Nubia NTT</h1>

      <h2>Data Toko:</h2>

      {stores.length === 0 ? (
        <p>Belum ada data</p>
      ) : (
        <ul>
          {stores.map((store) => (
            <li key={store.id}>
              {store.name} - {store.city}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}