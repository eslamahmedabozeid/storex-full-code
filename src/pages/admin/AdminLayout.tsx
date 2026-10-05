import { NavLink, Outlet, Link } from "react-router";
import {
  LayoutDashboard,
  FileText,
  Globe,
  Settings2,
  LogOut,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { Toaster } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { LOGIN_PATH } from "@/const";

const NAV = [
  { to: "/admin", end: true, icon: LayoutDashboard, label: "Overview" },
  { to: "/admin/posts", icon: FileText, label: "Blog Posts" },
  { to: "/admin/seo", icon: Globe, label: "SEO Settings" },
  { to: "/admin/content", icon: Settings2, label: "Site Content" },
];

export default function AdminLayout() {
  const { user, isLoading, logout } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: LOGIN_PATH,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#E53935] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null; // redirecting to login

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm text-center">
          <div className="w-12 h-12 bg-[#FFEBEE] rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="text-[#E53935]" size={22} />
          </div>
          <h1 className="text-lg font-bold mt-4">Admin access required</h1>
          <p className="text-sm text-[#666] mt-2">
            Your account ({user.name || user.email || "unknown"}) does not have
            permission to manage this site.
          </p>
          <Link
            to="/"
            className="inline-block mt-5 text-sm font-semibold text-[#E53935]"
          >
            Back to StoreX
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1A1A1A] font-sans">
      <Toaster position="top-right" richColors />
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-60 bg-[#1A1A1A] text-white flex flex-col flex-shrink-0 sticky top-0 h-screen">
          <div className="p-5 border-b border-white/10 flex items-center gap-2">
            <img src="/images/storex-logo.png" alt="StoreX" className="h-8 w-auto" />
            <span className="text-xs bg-[#E53935] px-2 py-0.5 rounded-full font-semibold">
              CMS
            </span>
          </div>

          <nav className="flex-1 p-3 space-y-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#E53935] text-white"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="p-3 border-t border-white/10 space-y-1">
            <Link
              to="/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ExternalLink size={18} />
              View Site
            </Link>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>

          <div className="p-4 border-t border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 bg-[#E53935] rounded-full flex items-center justify-center font-bold text-sm">
              {(user.name || "A")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user.name || "Admin"}</p>
              <p className="text-xs text-white/40 truncate">{user.email || "Administrator"}</p>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
