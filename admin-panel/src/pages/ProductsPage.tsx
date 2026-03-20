import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../utils/api'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Tag, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Product {
  id: string; name: string; description?: string; price: number
  imageUrl?: string; isAvailable: boolean; tags: string[]
  categoryId?: string; category?: { id: string; name: string }
}

interface Category { id: string; name: string }

const EMPTY: Omit<Product, 'id' | 'isAvailable' | 'category'> = {
  name: '', description: '', price: 0, imageUrl: '', tags: [], categoryId: undefined
}

export default function ProductsPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; product: any }>({ open: false, product: EMPTY })
  const [tagInput, setTagInput] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.get('/api/products').then(r => r.data),
  })

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/categories').then(r => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      data.id
        ? api.put(`/api/products/${data.id}`, data).then(r => r.data)
        : api.post('/api/products', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success(modal.product.id ? 'Product updated' : 'Product added')
      setModal({ open: false, product: EMPTY })
    },
    onError: () => toast.error('Failed to save product'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Product deleted'); setDeleteId(null) },
    onError: () => toast.error('Failed to delete'),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/products/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  const p = modal.product
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setModal(m => ({ ...m, product: { ...m.product, [k]: e.target.value } }))

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !p.tags.includes(t)) {
      setModal(m => ({ ...m, product: { ...m.product, tags: [...m.product.tags, t] } }))
    }
    setTagInput('')
  }

  const removeTag = (t: string) =>
    setModal(m => ({ ...m, product: { ...m.product, tags: m.product.tags.filter((x: string) => x !== t) } }))

  const handleSave = () => {
    if (!p.name || !p.price) return toast.error('Name and price are required')
    saveMutation.mutate({ ...p, price: parseFloat(p.price) })
  }

  const openEdit = (product: Product) => setModal({ open: true, product: { ...product } })
  const openNew = () => { setModal({ open: true, product: { ...EMPTY, tags: [] } }); setTagInput('') }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your menu / product catalog</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={16} /> Add product
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-gray-400 text-sm">No products yet. Add your first product to get started.</p>
          <button onClick={openNew} className="btn-primary mt-4 mx-auto">
            <Plus size={16} /> Add product
          </button>
        </div>
      ) : (
        <div className="card divide-y divide-gray-50">
          {products.map(product => (
            <div key={product.id} className="flex items-center gap-4 px-5 py-3.5">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name}
                  className="w-12 h-12 rounded-lg object-cover border border-gray-100 shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-gray-300 text-xl font-bold">
                  {product.name[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                  {product.category && (
                    <span className="badge-gray">{product.category.name}</span>
                  )}
                </div>
                {product.description && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">{product.description}</p>
                )}
                {product.tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {product.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600">
                        <Tag size={9} />{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 shrink-0">
                ₹{product.price.toLocaleString('en-IN')}
              </p>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleMutation.mutate(product.id)}
                  className={`p-1.5 rounded-lg transition-colors ${product.isAvailable ? 'text-brand-600 hover:bg-brand-50' : 'text-gray-400 hover:bg-gray-100'}`}
                  title={product.isAvailable ? 'Mark unavailable' : 'Mark available'}
                >
                  {product.isAvailable ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                </button>
                <button onClick={() => openEdit(product)}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                  <Pencil size={15} />
                </button>
                <button onClick={() => setDeleteId(product.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{p.id ? 'Edit product' : 'Add product'}</h2>
              <button onClick={() => setModal({ open: false, product: EMPTY })}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Product name *</label>
                <input className="input" value={p.name} onChange={set('name')} placeholder="e.g. Chicken Biryani" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input resize-none" rows={2} value={p.description ?? ''} onChange={set('description')}
                  placeholder="Brief description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Price (₹) *</label>
                  <input type="number" className="input" value={p.price} onChange={set('price')} min="0" step="0.01" />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={p.categoryId ?? ''} onChange={set('categoryId')}>
                    <option value="">No category</option>
                    {categories.map((c: Category) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Image URL</label>
                <input className="input" value={p.imageUrl ?? ''} onChange={set('imageUrl')} placeholder="https://..." />
              </div>
              <div>
                <label className="label">Tags (for AI filtering)</label>
                <div className="flex gap-2">
                  <input className="input" value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="e.g. rice-based, spicy, veg" />
                  <button onClick={addTag} className="btn-secondary shrink-0">Add</button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Tags help the AI filter products when customers say things like "show me spicy food"
                </p>
                {p.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.tags.map((tag: string) => (
                      <span key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-red-500">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setModal({ open: false, product: EMPTY })} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : p.id ? 'Save changes' : 'Add product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <AlertCircle size={20} className="text-red-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Delete product?</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteId!)} className="btn-danger"
                disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
