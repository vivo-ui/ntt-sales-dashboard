'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function DashboardManager() {
  const [sales, setSales] = useState<any[]>([])
  const [targets, setTargets] = useState<any[]>([])
  const [pics, setPics] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const [selectedPic, setSelectedPic] = useState('')

  useEffect(() => {
    fetchAll()
  }, [])

  // ================= FETCH ALL =================
  const fetchAll = async () => {
    setLoading(true)

    // 🔥 AMBIL SEMUA PIC (WAJIB DARI PROFILES)
    const { data: picData } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('role', 'pic')

    // 🔥 SALES
    const { data: salesData } = await supabase
      .from('sales_reports')
      .select(`
        qty,
        imei,
        created_at,
        stores!sales_reports_store_id_fkey (name),
        products!sales_reports_product_id_fkey (name, price),
        profiles:user_id (id, email)
      `)

    // 🔥 TARGET
    const { data: targetData } = await supabase
      .from('targets')
      .select('*')

    setPics(picData || [])
    setSales(salesData || [])
    setTargets(targetData || [])

    setLoading(false)
  }

  // ================= FILTER PIC =================
  const filteredPics = selectedPic
    ? pics.filter(p => p.email === selectedPic)
    : pics

  // ================= PROCESS =================
  const finalData = filteredPics.map((pic: any) => {
    // ambil sales milik PIC ini
    const userSales = sales.filter(
      s => s.profiles?.id === pic.id
    )

    const unit = userSales.reduce(
      (sum, s) => sum + Number(s.qty ?? 1),
      0
    )

    const omzet = userSales.reduce(
      (sum, s) => sum + (Number(s.qty ?? 1) * Number(s.products?.price ?? 0)),
      0
    )

    // ambil target
    const target = targets.find(t => t.user_id === pic.id)

    const targetUnit = target?.target_unit || 0
    const targetOmzet = target?.target_omzet || 0

    const percent =
      targetUnit > 0 ? Math.round((unit / targetUnit) * 100) : 0

    return {
      email: pic.email,
      unit,
      omzet,
      targetUnit,
      targetOmzet,
      percent,
      sales: userSales // untuk export detail
    }
  })

  // ================= SORT =================
  const ranking = finalData.sort((a, b) => b.percent - a.percent)

  // ================= TOTAL =================
  const totalUnit = finalData.reduce((s, i) => s + i.unit, 0)
  const totalOmzet = finalData.reduce((s, i) => s + i.omzet, 0)

  const format = (n: number) =>
    new Intl.NumberFormat('id-ID').format(n || 0)

  // ================= CHART =================
  const chartData = ranking.map(r => ({
    pic: r.email,
    omzet: r.omzet
  }))

  // ================= EXPORT =================
  const exportToExcel = () => {
    let exportRows: any[] = []

    finalData.forEach((pic: any) => {
      if (pic.sales.length === 0) {
        // tetap tampil walau belum jual
        exportRows.push({
          PIC: pic.email,
          Toko: '-',
          Type: '-',
          IMEI: '-',
          Unit: 0,
          Harga: 0,
          Omzet: 0
        })
      } else {
        pic.sales.forEach((s: any) => {
          const unit = Number(s.qty ?? 1)
          const price = Number(s.products?.price ?? 0)

          exportRows.push({
            PIC: pic.email,
            Toko: s.stores?.name || '-',
            Type: s.products?.name || '-',
            IMEI: s.imei || '-',
            Unit: unit,
            Harga: price,
            Omzet: unit * price
          })
        })
      }
    })

    if (exportRows.length === 0) {
      alert('Tidak ada data')
      return
    }

    const ws = XLSX.utils.json_to_sheet(exportRows)
    ws['!cols'] = Object.keys(exportRows[0]).map(() => ({ wch: 20 }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Monitoring')

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf]), 'Monitoring_Tim.xlsx')
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>🔥 Monitoring Tim & Target</h1>

      {/* FILTER */}
      <select
        value={selectedPic}
        onChange={(e) => setSelectedPic(e.target.value)}
      >
        <option value="">Semua PIC</option>
        {pics.map((p: any, i) => (
          <option key={i} value={p.email}>
            {p.email}
          </option>
        ))}
      </select>

      <button onClick={exportToExcel} style={{ marginLeft: 10 }}>
        Export
      </button>

      {loading && <p>Loading...</p>}

      {/* TOTAL */}
      <h2>Total Unit: {totalUnit}</h2>
      <h2>Total Omzet: Rp {format(totalOmzet)}</h2>

      {/* RANKING */}
      <h2>🏆 Monitoring PIC</h2>

      {ranking.map((r: any, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <b>#{i + 1} {r.email}</b><br />
          📦 {r.unit} / {r.targetUnit} unit<br />
          💰 Rp {format(r.omzet)}<br />
          🎯 {r.percent}% tercapai
          <hr />
        </div>
      ))}

      {/* CHART */}
      <div style={{ width: '100%', height: '400px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="pic" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="omzet" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}