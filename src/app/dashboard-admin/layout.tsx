import SidebarAdmin from "@/components/SidebarAdmin";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0b1326]">
      {/* Sidebar akan selalu muncul di kiri */}
      <SidebarAdmin />
      
      {/* Konten halaman akan muncul di kanan */}
      <div className="pl-64">
        {children}
      </div>
    </div>
  );
}
