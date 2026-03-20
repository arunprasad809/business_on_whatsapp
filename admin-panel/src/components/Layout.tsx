import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Package, MessageSquare, ShoppingCart,
  Settings, LogOut, Smartphone, ChevronRight
} from 'lucide-react'

const navItems = [
  { to: '/',          label: 'Dashboard',  icon: LayoutDashboard, exact: true },
  { to: '/products',  label: 'Products',   icon: Package },
  { to: '/faqs',      label: 'FAQs',       icon: MessageSquare },
  { to: '/orders',    label: 'Orders',     icon: ShoppingCart },
  { to: '/settings',  label: 'Settings',   icon: Settings },
]

export default function Layout() {
  const { business, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-gray-100 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <Smartphone size={16} className="text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm leading-tight">
            Business on<br />WhatsApp
          </span>
        </div>

        {/* Business name */}
        <div className="px-4 py-3 border-b border-gray-50">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Account</p>
          <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">{business?.name}</p>
          {business?.whatsappNumber ? (
            <p className="text-xs text-brand-600 mt-0.5">{business.whatsappNumber}</p>
          ) : (
            <p className="text-xs text-yellow-600 mt-0.5">No WhatsApp linked</p>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
