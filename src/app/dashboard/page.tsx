'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function DashboardPage() {
  const [reports, setReports] = useState<any[]>([])

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    if (!userId) return

    const { data, error } = await supabase
      .from('sales_reports')
      .select(`
        id,
        imei,
        created_at,
        stores!sales_reports_store_id_fkey (
          id,
          name,
          pic
        ),
        products!sales_reports_product_id_fkey (
          id,
          name,
          price
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    console.log('DATA:', data)
    console.log('ERROR:', error)

    if (error) return

    setReports(data || [])
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Dashboard PIC</h1>

      <table border={1} cellPadding={10} style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Toko</th>
            <th>PIC</th>
            <th>Produk</th>
            <th>Harga</th>
            <th>IMEI</th>
          </tr>
        </thead>
        <tbody>
          {reports.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center' }}>
                Tidak ada data
              </td>
            </tr>
          ) : (
            reports.map((item) => {
              const store = item.stores || {}
              const product = item.products || {}

              return (
                <tr key={item.id}>
                  <td>
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                  <td>{store.name || '-'}</td>
                  <td>{store.pic || '-'}</td>
                  <td>{product.name || '-'}</td>
                  <td>
                    Rp {product.price?.toLocaleString() || 0}
                  </td>
                  <td>{item.imei || '-'}</td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}