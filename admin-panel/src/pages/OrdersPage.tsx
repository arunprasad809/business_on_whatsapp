import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../utils/api'
import { Eye, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface OrderItem { id: string; name: string; quantity: number; price: number }
interface Order {
  id: string; customerPhone: string; customerName?: string
  status: string; totalAmount: number; createdAt: string
  items: OrderItem[]; razorpayPaymentId?: string; paidAt?: string
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'badge-warning', PAYMENT_LINK_SENT: 'badge-warning',
  PAID: 'badge-success', PROCESSING: 'badge-success',
  COMPLETED: 'badge-success', CANCELLED: 'badge-danger', REFUNDED: 'badge-gray',
}

const FILTERS = ['ALL', 'PENDING', 'PAYMENT_LINK_SENT', 'PAID', 'COMPLETED', 'CANCELLED']

export default function OrdersPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('ALL')
  const [selected, setSelected] = useState<Order | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['orders', filter],
    queryFn: () => api.get('/api/orders', {
      params: filter !== 'ALL' ? { status: filter } : {}
    }).then(r => r.data),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/orders/${id}/status`, { status }).then(r => r.data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      setSelected(updated)
      toast.success('Status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  const orders: Order[] = data?.orders ?? []

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-500 text-sm mt-0.5">Track and manage all customer orders</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-brand-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-gray-400 text-sm">No orders found.</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-50">
          {orders.map(order => (
            <div key={order.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {order.customerName ?? order.customerPhone}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {order.items?.length} item{order.items?.length !== 1 ? 's' : ''} ·{' '}
                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-900 shrink-0">
                ₹{order.totalAmount.toLocaleString('en-IN')}
              </span>
              <span className={`shrink-0 ${STATUS_STYLES[order.status] ?? 'badge-gray'}`}>
                {order.status.replace(/_/g, ' ')}
              </span>
              <button onClick={() => setSelected(order)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors shrink-0">
                <Eye size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Order detail drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-end z-50">
          <div className="bg-white h-full w-full max-w-md shadow-2xl flex flex-col overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-gray-900">Order details</h2>
              <button onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="p-6 flex-1 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Customer</p>
                  <p className="font-medium text-gray-900 mt-0.5">{selected.customerName ?? '—'}</p>
                  <p className="text-sm text-gray-500">{selected.customerPhone}</p>
                </div>
                <span className={STATUS_STYLES[selected.status] ?? 'badge-gray'}>
                  {selected.status.replace(/_/g, ' ')}
                </span>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Items</p>
                <div className="space-y-2">
                  {selected.items.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                      <span className="text-gray-700">{item.name} × {item.quantity}</span>
                      <span className="font-medium">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center text-sm font-semibold pt-2 border-t border-gray-100">
                    <span>Total</span>
                    <span>₹{selected.totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {selected.razorpayPaymentId && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Payment ID</p>
                  <p className="text-sm font-mono text-gray-700 mt-0.5">{selected.razorpayPaymentId}</p>
                  {selected.paidAt && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Paid on {new Date(selected.paidAt).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              )}

              {/* Status actions */}
              {['PAID', 'PROCESSING'].includes(selected.status) && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Update status</p>
                  <div className="flex gap-2 flex-wrap">
                    {selected.status === 'PAID' && (
                      <button
                        onClick={() => statusMutation.mutate({ id: selected.id, status: 'PROCESSING' })}
                        className="btn-secondary text-xs" disabled={statusMutation.isPending}>
                        <RefreshCw size={13} /> Mark processing
                      </button>
                    )}
                    {['PAID', 'PROCESSING'].includes(selected.status) && (
                      <button
                        onClick={() => statusMutation.mutate({ id: selected.id, status: 'COMPLETED' })}
                        className="btn-primary text-xs" disabled={statusMutation.isPending}>
                        Mark completed
                      </button>
                    )}
                    <button
                      onClick={() => statusMutation.mutate({ id: selected.id, status: 'CANCELLED' })}
                      className="btn-danger text-xs" disabled={statusMutation.isPending}>
                      Cancel order
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
