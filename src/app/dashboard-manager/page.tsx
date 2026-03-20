'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function DashboardManager() {
  const [data, setData] = useState<any[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    fetchData()
  }, [startDate, endDate])

const fetchData = async () => {
  // ambil sales
  const { data: sales, error: err1 } = await supabase
    .from('sales_reports')
    .select('*')

  if (err1) {
    console.log(err1)
    return
  }

  // ambil products
  const { data: products, error: err2 } = await supabase
    .from('products')
    .select('*')

  if (err2) {
    console.log(err2)
    return
  }

  // mapping product
  const productMap: any = {}
  products?.forEach((p: any) => {
    productMap[p.id] = p
  })

  // inject product ke sales
  const finalData = sales.map((s: any) => ({
    ...s,
    products: productMap[s.product_id] || null
  }))

  console.log('🔥 FINAL DATA:', finalData)

  setData(finalData || [])
}
  // ✅ PROSES DATA (TIDAK BUANG DATA LAGI)
  const processed = data.map((item) => {
    const unit = Number(item.qty ?? 0)
    const price = Number(item.products?.price ?? 0)

    return {
      toko: item.store_id ?? 'Unknown',
      email: item.profiles?.email ?? 'Unknown',
      unit,
      omzet: unit * price
    }
  })

  // ✅ TOTAL
  const totalUnit = processed.reduce((s, i) => s + i.unit, 0)
  const totalOmzet = processed.reduce((s, i) => s + i.omzet, 0)

  const formatRupiah = (angka: number) =>
    new Intl.NumberFormat('id-ID').format(angka || 0)

  // 🏆 RANKING PIC
  const ranking = Object.values(
    processed.reduce((acc: any, item: any) => {
      const key = item.email

      if (!acc[key]) {
        acc[key] = { email: key, unit: 0, omzet: 0 }
      }

      acc[key].unit += item.unit
      acc[key].omzet += item.omzet

      return acc
    }, {})
  ).sort((a: any, b: any) => b.unit - a.unit)

  // 📊 GRAFIK PER TOKO
  const tokoMap: any = {}

  processed.forEach((item) => {
    const toko = item.toko

    if (!tokoMap[toko]) {
      tokoMap[toko] = 0
    }

    tokoMap[toko] += item.omzet
  })

  const chartData = Object.keys(tokoMap).map((toko) => ({
    toko,
    omzet: tokoMap[toko]
  }))

  // 📥 EXPORT
  const exportToExcel = () => {
    const exportData = processed.map((item) => ({
      PIC: item.email,
      Toko: item.toko,
      Unit: item.unit,
      Omzet: item.omzet
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Report')

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf]), 'Sales_Report.xlsx')
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>🔥 Dashboard Real Sales (IMEI Based)</h1>

      {/* FILTER */}
      <div style={{ marginBottom: 10 }}>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        {' - '}
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />

        <button
          onClick={exportToExcel}
          style={{
            marginLeft: 10,
            padding: '6px 10px',
            background: '#2563eb',
            color: 'white',
            borderRadius: 5,
            border: 'none'
          }}
        >
          📥 Export
        </button>
      </div>

      {/* TOTAL */}
      <h2>Total Unit: {totalUnit}</h2>
      <h2>Total Omzet: Rp {formatRupiah(totalOmzet)}</h2>

      {/* RANKING */}
      <h2>🏆 Ranking PIC</h2>

      {ranking.length === 0 ? (
        <p>Tidak ada data</p>
      ) : (
        ranking.map((r: any, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <b>#{i + 1} {r.email}</b><br />
            📦 {r.unit} unit<br />
            💰 Rp {formatRupiah(r.omzet)}
            <hr />
          </div>
        ))
      )}

      {/* CHART */}
      <div style={{ width: '100%', height: 300 }}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="toko" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="omzet" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p>Tidak ada data grafik</p>
        )}
      </div>
    </div>
  )
}