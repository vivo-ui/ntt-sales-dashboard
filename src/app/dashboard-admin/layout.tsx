'use client'

import SidebarAdmin from "@/components/SidebarAdmin";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0b1326] font-manrope">
      {/* Sidebar: Fixed width on desktop, hidden on mobile in favor of bottom nav or toggle */}
      <SidebarAdmin />
      
      {/* Main Content: Add responsive padding to account for sidebar (desktop) or bottom nav (mobile) */}
      <div className="lg:pl-64 pb-24 lg:pb-0 transition-all duration-300">
        {children}
      </div>
    </div>
  );
}
