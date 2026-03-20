'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function InputPage() {
  const [stores, setStores] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [formData, setFormData] = useState({
    storeId: '',
    productId: '',
    imei: '',
    qty: 1
  })
  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const router = useRouter()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    const email = user?.email || ''
    
    if (!email) {
      router.push('/login')
      return
    }
    
    setUserEmail(email)

    // CRITICAL FIX: Extract prefix and handle case-insensitivity
    const picPrefix = email.split('@')[0]

    // Fetch stores assigned to this PIC (Case Insensitive Match)
    const { data: storeData } = await supabase
      .from('stores')
      .select('*')
      .or(`pic.ilike.${picPrefix},pic.eq.${email}`) 
    
    const { data: productData } = await supabase.from('products').select('*')
    
    setStores(storeData || [])
    setProducts(productData || [])
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    
    if (!userId) {
      alert('Session expired. Please log in again.')
      router.push('/login')
      return
    }

    if (!formData.storeId || !formData.productId || !formData.imei) {
      alert('Semua field wajib diisi!')
      setLoading(false)
      return
    }
    
    const { error } = await supabase.from('sales_reports').insert({
      user_id: userId,
      store_id: formData.storeId,
      product_id: formData.productId,
      imei: formData.imei,
      qty: formData.qty
    })

    if (!error) {
      alert('Transaksi berhasil disimpan!')
      setFormData({ ...formData, imei: '', qty: 1 })
    } else {
      alert('Gagal: ' + error.message)
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-[#0b1326] font-manrope text-[#dae2fd] pb-32">
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-20 bg-[#0b1326]/70 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[#2e5bff] border border-white/10 shadow-lg">
             <span className="material-icons">edit_note</span>
          </div>
          <span className="text-xl font-black tracking-tight text-white">Input Penjualan</span>
        </div>
        <div className="text-right">
          <p className="text-[8px] font-bold text-[#dae2fd]/40 uppercase tracking-widest">Operator</p>
          <p className="text-[10px] font-bold text-[#2e5bff]">{userEmail.split('@')[0].toUpperCase()}</p>
        </div>
      </header>

      <main className="pt-28 px-6 space-y-8 max-w-lg mx-auto">
        <div className="bg-[#131b2e]/60 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8">
          
          <div className="space-y-6">
            {/* Store Dropdown */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#dae2fd]/40 ml-1">Pilih Toko Saya</label>
              <div className="relative">
                <select 
                  value={formData.storeId}
                  onChange={(e) => setFormData({...formData, storeId: e.target.value})}
                  className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 appearance-none"
                >
                  <option value="">-- Pilih Toko Anda --</option>
                  {stores.length === 0 ? (
                    <option disabled>Tidak ada toko assigned (PIC: {userEmail.split('@')[0].toUpperCase()})</option>
                  ) : (
                    stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                  )}
                </select>
                <span className="material-icons absolute right-5 top-1/2 -translate-y-1/2 text-[#dae2fd]/20 pointer-events-none">storefront</span>
              </div>
            </div>

            {/* Product Dropdown */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#dae2fd]/40 ml-1">Pilih Produk</label>
              <div className="relative">
                <select 
                  value={formData.productId}
                  onChange={(e) => setFormData({...formData, productId: e.target.value})}
                  className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 appearance-none"
                >
                  <option value="">-- Pilih Produk --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <span className="material-icons absolute right-5 top-1/2 -translate-y-1/2 text-[#dae2fd]/20 pointer-events-none">inventory_2</span>
              </div>
            </div>

            {/* IMEI Scan Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#dae2fd]/40 ml-1">Scan IMEI</label>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Ketik atau scan IMEI"
                  value={formData.imei}
                  onChange={(e) => setFormData({...formData, imei: e.target.value})}
                  className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 transition-all"
                />
                <button 
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-[#2e5bff]/10 px-3 py-1.5 rounded-lg border border-[#2e5bff]/20 active:scale-90 transition-transform"
                  onClick={() => alert('Camera module starting...')}
                >
                  <span className="material-icons text-sm text-[#2e5bff]">photo_camera</span>
                </button>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#dae2fd]/40 ml-1">Jumlah (Qty)</label>
              <div className="flex items-center justify-between bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4">
                 <button type="button" onClick={() => setFormData({...formData, qty: Math.max(1, formData.qty - 1)})} className="text-[#2e5bff] active:scale-75 transition-transform">
                   <span className="material-icons">remove_circle_outline</span>
                 </button>
                 <span className="text-xl font-black text-white">{formData.qty}</span>
                 <button type="button" onClick={() => setFormData({...formData, qty: formData.qty + 1})} className="text-[#2e5bff] active:scale-75 transition-transform">
                   <span className="material-icons">add_circle_outline</span>
                 </button>
              </div>
            </div>
          </div>

          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-5 bg-gradient-to-br from-[#4e74ff] to-[#2e5bff] text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Menyimpan...</span>
              </>
            ) : (
              'Simpan Transaksi'
            )}
          </button>
        </div>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 w-full h-24 bg-[#131b2e]/80 backdrop-blur-2xl border-t border-white/5 flex justify-around items-center px-6 pb-6 z-50">
          <a href="/dashboard-pic" className="flex flex-col items-center justify-center text-[#dae2fd]/40 hover:text-[#dae2fd] transition-colors">
            <span className="material-icons text-xl mb-0.5">grid_view</span>
            <span className="text-[8px] font-black uppercase tracking-widest">Dashboard</span>
          </a>
          <a href="/dashboard-pic/input" className="flex flex-col items-center justify-center text-[#2e5bff] bg-[#222a3d] rounded-2xl px-5 py-2.5 shadow-lg">
            <span className="material-icons text-xl mb-0.5">edit_square</span>
            <span className="text-[8px] font-black uppercase tracking-widest">Input</span>
          </a>
          <button onClick={handleLogout} className="flex flex-col items-center justify-center text-red-400">
            <span className="material-icons text-xl mb-0.5">logout</span>
            <span className="text-[8px] font-black uppercase tracking-widest">Logout</span>
          </button>
        </nav>
      </main>
    </div>
  )
}
