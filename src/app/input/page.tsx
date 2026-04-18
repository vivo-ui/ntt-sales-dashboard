
'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
// Note: Ensure 'html5-qrcode' is installed: npm install html5-qrcode
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode'

export default function InputPage() {
  const [stores, setStores] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [formData, setFormData] = useState({
    storeId: '',
    productId: '',
    imei: '',
    qty: 1,
    staffRole: '',
    staffName: ''
  })
  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [cameraMode, setCameraMode] = useState('environment') // 'user' (front) or 'environment' (back)
  const router = useRouter()
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    fetchData()
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(console.error)
      }
    }
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
    const picPrefix = email.split('@')[0].toLowerCase()

    // Query stores assigned to this PIC
    const { data: storeData } = await supabase
      .from('stores')
      .select('*')
      .or(`pic.ilike.${picPrefix},pic.eq.${email}`) 
    
    const { data: productData } = await supabase.from('products').select('*')
    
    setStores(storeData || [])
    setProducts(productData || [])
  }

  const startScanner = async () => {
    setIsScanning(true)
    
    // Slight delay to ensure element "reader" is in DOM
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        html5QrCodeRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 300, height: 120 },
        };

        await html5QrCode.start(
          { facingMode: cameraMode }, 
          config,
          (decodedText) => {
            setFormData(prev => ({ ...prev, imei: decodedText }))
            stopScanner()
          },
          () => {} // silent failure
        );
      } catch (err) {
        console.error("Scanner failed:", err);
        alert("Gagal mengakses kamera. Silakan periksa izin kamera.");
        setIsScanning(false);
      }
    }, 300);
  }

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        setIsScanning(false);
      }
    }
  }

  // Effect to restart scanner if mode changes while scanning
  useEffect(() => {
    if (isScanning) {
      stopScanner().then(() => startScanner())
    }
  }, [cameraMode])

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

    if (!formData.storeId || !formData.productId || !formData.imei || !formData.staffRole || !formData.staffName) {
      alert('Semua field wajib diisi!')
      setLoading(false)
      return
    }
    
    const { error } = await supabase.from('sales_reports').insert({
      user_id: userId,
      store_id: formData.storeId,
      product_id: formData.productId,
      imei: formData.imei,
      qty: formData.qty,
      staff_role: formData.staffRole,
      staff_name: formData.staffName
    })

    if (!error) {
      alert('Transaksi berhasil disimpan!')
      setFormData({ ...formData, imei: '', qty: 1, staffName: '' })
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
          <span className="text-xl font-black tracking-tight text-white uppercase">Data Acquisition</span>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-[#2e5bff]">{userEmail.split('@')[0].toUpperCase()}</p>
        </div>
      </header>

      <main className="pt-28 px-6 space-y-8 max-w-lg mx-auto">
        {/* Scanner Overlay */}
        {isScanning && (
          <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm space-y-6 text-center">
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Scanning Mode</h3>
                <p className="text-sm text-[#dae2fd]/60 italic">Align barcode inside the central frame</p>
              </div>

              {/* CAMERA SELECTION UI */}
              <div className="flex p-1 bg-[#131b2e] rounded-2xl border border-white/5 mx-auto w-fit">
                 <button 
                  onClick={() => setCameraMode('user')}
                  className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all ${cameraMode === 'user' ? 'bg-[#2e5bff] text-white shadow-lg' : 'text-[#8c9bbd]'}`}
                >
                  DEPAN
                </button>
                <button 
                  onClick={() => setCameraMode('environment')}
                  className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all ${cameraMode === 'environment' ? 'bg-[#2e5bff] text-white shadow-lg' : 'text-[#8c9bbd]'}`}
                >
                  BELAKANG
                </button>
              </div>
              
              <div className="relative">
                <div id="reader" className="w-full aspect-square rounded-[2.5rem] overflow-hidden border-2 border-[#2e5bff]/30 shadow-[0_0_50px_rgba(46,91,255,0.2)] bg-black"></div>
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-12">
                   <div className="w-full h-24 border-2 border-[#4edea3] rounded-2xl relative shadow-[0_0_20px_rgba(78,222,163,0.3)]">
                      <div className="absolute inset-0 bg-[#4edea3]/5 animate-pulse"></div>
                   </div>
                </div>
              </div>

              <button 
                onClick={stopScanner}
                className="w-full py-5 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase tracking-[0.2em] active:scale-95 transition-all text-xs"
              >
                Close Scanner
              </button>
            </div>
          </div>
        )}

        {/* Input Form */}
        <div className="bg-[#131b2e]/60 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#2e5bff]/5 blur-[60px] rounded-full -mr-10 -mt-10"></div>
          
          <div className="space-y-6">
            {/* Store Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#dae2fd]/40 ml-1">Target Store</label>
              <select 
                value={formData.storeId}
                onChange={(e) => setFormData({...formData, storeId: e.target.value})}
                className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 appearance-none transition-all"
              >
                <option value="">-- Pilih Toko --</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Staff Info */}
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#dae2fd]/40 ml-1">Staff Role</label>
                <select 
                  value={formData.staffRole}
                  onChange={(e) => setFormData({...formData, staffRole: e.target.value})}
                  className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 appearance-none transition-all"
                >
                  <option value="">-- Pilih Peran --</option>
                  <option value="Promotor vivo">Promotor vivo</option>
                  <option value="Front Liner (FL) toko">Front Liner (FL) toko</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#dae2fd]/40 ml-1">Staff Full Name</label>
                <input 
                  type="text"
                  placeholder="Sesuai KTP..."
                  value={formData.staffName}
                  onChange={(e) => setFormData({...formData, staffName: e.target.value})}
                  className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 transition-all"
                />
              </div>
            </div>

            {/* Product Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#dae2fd]/40 ml-1">Product Model</label>
              <select 
                value={formData.productId}
                onChange={(e) => setFormData({...formData, productId: e.target.value})}
                className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 appearance-none transition-all"
              >
                <option value="">-- Pilih Produk --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* IMEI 1 Input & Scanner */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#dae2fd]/40 ml-1">IMEI 1 Identifier</label>
              <div className="relative group">
                <input 
                  type="text"
                  placeholder="Type or Scan..."
                  value={formData.imei}
                  onChange={(e) => setFormData({...formData, imei: e.target.value})}
                  className="w-full bg-[#0b1326] border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#2e5bff]/50 transition-all pr-16"
                />
                <button 
                  type="button"
                  onClick={startScanner}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#2e5bff] text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 active:scale-90 transition-transform"
                >
                  <span className="material-icons text-xl">qr_code_scanner</span>
                </button>
              </div>
            </div>

            {/* Qty Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#dae2fd]/40 ml-1">Quantity</label>
              <div className="flex items-center justify-between bg-[#0b1326] border border-white/5 rounded-2xl px-6 py-4">
                 <button type="button" onClick={() => setFormData({...formData, qty: Math.max(1, formData.qty - 1)})} className="text-[#2e5bff] active:scale-75 transition-transform">
                   <span className="material-icons">remove_circle_outline</span>
                 </button>
                 <span className="text-2xl font-black text-white">{formData.qty}</span>
                 <button type="button" onClick={() => setFormData({...formData, qty: formData.qty + 1})} className="text-[#2e5bff] active:scale-75 transition-transform">
                   <span className="material-icons">add_circle_outline</span>
                 </button>
              </div>
            </div>
          </div>

          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-5 bg-gradient-to-br from-[#4e74ff] to-[#2e5bff] text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              'Simpan Transaksi'
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="fixed bottom-0 w-full h-24 bg-[#131b2e]/80 backdrop-blur-2xl border-t border-white/5 flex justify-around items-center px-6 pb-6 z-50">
          <a href="/dashboard-pic" className="flex flex-col items-center justify-center text-[#dae2fd]/40 hover:text-[#dae2fd] transition-colors group">
            <span className="material-icons text-xl mb-0.5 group-active:scale-90 transition-transform">grid_view</span>
            <span className="text-[8px] font-black uppercase tracking-widest">Dashboard</span>
          </a>
          <a href="/dashboard-pic/input" className="flex flex-col items-center justify-center text-[#2e5bff] bg-[#222a3d] rounded-2xl px-5 py-2.5 shadow-lg border border-white/5">
            <span className="material-icons text-xl mb-0.5">edit_square</span>
            <span className="text-[8px] font-black uppercase tracking-widest">Input</span>
          </a>
          <button onClick={handleLogout} className="flex flex-col items-center justify-center text-red-400/60 hover:text-red-400 group">
            <span className="material-icons text-xl mb-0.5 group-active:scale-90 transition-transform">logout</span>
            <span className="text-[8px] font-black uppercase tracking-widest">Logout</span>
          </button>
        </nav>
      </main>
    </div>
  )
}
