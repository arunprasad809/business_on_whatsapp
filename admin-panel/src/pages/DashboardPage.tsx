import { useQuery } from '@tanstack/react-query'
import { api } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { ShoppingCart, Package, TrendingUp, Clock, AlertCircle } from 'lucide-react'

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: any; color: string
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:             'badge-warning',
  PAYMENT_LINK_SENT:   'badge-warning',
  PAID:                'badge-success',
  PROCESSING:          'badge-success',
  COMPLETED:           'badge-success',
  CANCELLED:           'badge-danger',
  REFUNDED:            'badge-gray',
}

export default function DashboardPage() {
  const { business } = useAuth()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/api/business/dashboard').then(r => r.data),
  })

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (isError) return (
    <div className="p-8 flex items-center gap-2 text-red-600">
      <AlertCircle size={18} /> Failed to load dashboard
    </div>
  )

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {business?.name} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here's what's happening with your business today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total revenue"
          value={`₹${(data.totalRevenue ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
          color="bg-green-50 text-green-600"
        />
        <StatCard label="Total orders" value={data.totalOrders} icon={ShoppingCart} color="bg-blue-50 text-blue-600" />
        <StatCard label="Pending orders" value={data.pendingOrders} icon={Clock} color="bg-yellow-50 text-yellow-600" />
        <StatCard label="Active products" value={data.totalProducts} icon={Package} color="bg-purple-50 text-purple-600" />
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent orders</h2>
        </div>
        {data.recentOrders?.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            No orders yet. Share your WhatsApp number to start receiving orders!
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.recentOrders?.map((order: any) => (
              <div key={order.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {order.customerName ?? order.customerPhone}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {order.items?.length} item{order.items?.length !== 1 ? 's' : ''} ·{' '}
                    {new Date(order.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">
                    ₹{order.totalAmount.toLocaleString('en-IN')}
                  </span>
                  <span className={STATUS_STYLES[order.status] ?? 'badge-gray'}>
                    {order.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
