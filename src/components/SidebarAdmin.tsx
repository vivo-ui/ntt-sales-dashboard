'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function SidebarAdmin() {
  const pathname = usePathname()

  const menus = [
    { name: 'Overview', path: '/dashboard-admin', icon: 'dashboard' },
    { name: 'Barang Masuk', path: '/dashboard-admin/stock-in', icon: 'login' },
    { name: 'Barang Keluar', path: '/dashboard-admin/stock-out', icon: 'logout' },
    { name: 'Transfer Stok', path: '/dashboard-admin/transfers', icon: 'swap_horiz' }, // NEW MENU ADDED
    { name: 'Ledger Stok', path: '/dashboard-admin/ledger', icon: 'menu_book' },
  ]

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-[#0b1326] border-r border-white/5 hidden lg:flex flex-col p-6 z-50 transition-all">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4e74ff] to-[#2e5bff] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="material-icons text-white">inventory_2</span>
          </div>
          <span className="text-xl font-black text-white italic tracking-tighter uppercase">Admin Hub</span>
        </div>

        <nav className="flex-1 space-y-2">
          {menus.map((menu) => (
            <Link 
              key={menu.path} 
              href={menu.path}
              className={`flex items-center gap-4 px-4 py-4 rounded-2xl transition-all group ${
                pathname === menu.path 
                  ? 'bg-[#2e5bff] text-white shadow-xl shadow-blue-500/20' 
                  : 'text-[#8c9bbd] hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className={`material-icons ${pathname === menu.path ? 'text-white' : 'text-[#2e5bff]'}`}>
                {menu.icon}
              </span>
              <span className="text-sm font-bold uppercase tracking-widest">{menu.name}</span>
            </Link>
          ))}
        </nav>

        <Link href="/login" className="flex items-center gap-4 px-4 py-4 text-rose-400 hover:bg-rose-500/10 rounded-2xl transition-all mt-auto">
          <span className="material-icons">exit_to_app</span>
          <span className="text-sm font-bold uppercase tracking-widest">Logout</span>
        </Link>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 w-full h-20 bg-[#0b1326]/90 backdrop-blur-xl border-t border-white/5 flex lg:hidden justify-around items-center px-4 pb-4 z-50">
        {menus.map((menu) => (
          <Link 
            key={menu.path} 
            href={menu.path}
            className={`flex flex-col items-center justify-center transition-all ${
              pathname === menu.path ? 'text-[#2e5bff] scale-110' : 'text-[#8c9bbd]'
            }`}
          >
            <span className={`material-icons text-2xl ${pathname === menu.path ? 'bg-[#2e5bff]/10 p-3 rounded-2xl shadow-lg' : ''}`}>
              {menu.icon}
            </span>
            <span className="text-[8px] font-black uppercase tracking-tighter mt-1">{menu.name.split(' ')[0]}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
