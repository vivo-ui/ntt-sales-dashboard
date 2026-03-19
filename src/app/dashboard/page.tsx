'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

export default function Dashboard() {
  const [data, setData] = useState<any[]>([])
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)

  const picLogin =
    typeof window !== 'undefined' ? localStorage.getItem('pic') : null

  useEffect(() => {
    if (!picLogin) {
      window.location.href = '/login'
    } else {
      fetchData()
    }
  }, [])

  const fetchData = async () => {
    let query = supabase
      .from('sales_reports')
      .select(`
        qty,
        created_at,
        stores ("NAMA TOKO", PIC),
        products (name, price)
      `)

    if (startDate && endDate) {
      query = query
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
    }

    const { data } = await query
    setData(data || [])
  }

  let totalOmzet = 0
  let totalUnit = 0

  data.forEach((item) => {
    const harga = item.products?.price || 0
    totalOmzet += harga * item.qty
    totalUnit += item.qty
  })

  const card = {
    background: '#111827',
    borderRadius: 16,
    padding: 20,
  }

  return (
    <div style={{
      padding: 20,
      background: '#020617',
      minHeight: '100vh',
      color: 'white'
    }}>
      <h1>📊 Dashboard</h1>

      {/* SUMMARY */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2,1fr)',
        gap: 20
      }}>
        <div style={card}>
          <h3>Omzet</h3>
          Rp {totalOmzet.toLocaleString()}
        </div>

        <div style={card}>
          <h3>Unit</h3>
          {totalUnit}
        </div>
      </div>

      {/* DATE PICKER */}
      <div style={{ marginTop: 20 }}>
        <DatePicker
          selected={startDate}
          onChange={(date) => setStartDate(date)}
          placeholderText="Start Date"
        />

        <DatePicker
          selected={endDate}
          onChange={(date) => setEndDate(date)}
          placeholderText="End Date"
        />

        <button onClick={fetchData}>Filter</button>
      </div>

      {/* DATA */}
      <div style={{ marginTop: 20 }}>
        {data.map((item, i) => (
          <div key={i} style={card}>
            {item.stores?.["NAMA TOKO"]} - {item.qty}
          </div>
        ))}
      </div>
    </div>
  )
}