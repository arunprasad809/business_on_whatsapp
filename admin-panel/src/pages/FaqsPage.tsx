import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../utils/api'
import { Plus, Pencil, Trash2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

interface Faq { id: string; question: string; answer: string; sortOrder: number }
const EMPTY = { question: '', answer: '', sortOrder: 0 }

export default function FaqsPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; faq: any }>({ open: false, faq: EMPTY })
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: faqs = [], isLoading } = useQuery<Faq[]>({
    queryKey: ['faqs'],
    queryFn: () => api.get('/api/faqs').then(r => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      data.id ? api.put(`/api/faqs/${data.id}`, data) : api.post('/api/faqs', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faqs'] })
      toast.success(modal.faq.id ? 'FAQ updated' : 'FAQ added')
      setModal({ open: false, faq: EMPTY })
    },
    onError: () => toast.error('Failed to save FAQ'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/faqs/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faqs'] }); toast.success('FAQ deleted'); setDeleteId(null) },
    onError: () => toast.error('Failed to delete'),
  })

  const f = modal.faq
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setModal(m => ({ ...m, faq: { ...m.faq, [k]: e.target.value } }))

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FAQs</h1>
          <p className="text-gray-500 text-sm mt-0.5">The AI uses these to answer customer questions</p>
        </div>
        <button onClick={() => setModal({ open: true, faq: EMPTY })} className="btn-primary">
          <Plus size={16} /> Add FAQ
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : faqs.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-gray-400 text-sm">No FAQs yet. Add common questions your customers ask.</p>
          <button onClick={() => setModal({ open: true, faq: EMPTY })} className="btn-primary mt-4 mx-auto">
            <Plus size={16} /> Add FAQ
          </button>
        </div>
      ) : (
        <div className="card divide-y divide-gray-50">
          {faqs.map(faq => (
            <div key={faq.id}>
              <div
                className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === faq.id ? null : faq.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{faq.question}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={e => { e.stopPropagation(); setModal({ open: true, faq: { ...faq } }) }}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                    <Pencil size={15} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setDeleteId(faq.id) }}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                    <Trash2 size={15} />
                  </button>
                  {expanded === faq.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </div>
              {expanded === faq.id && (
                <div className="px-5 pb-4">
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{f.id ? 'Edit FAQ' : 'Add FAQ'}</h2>
              <button onClick={() => setModal({ open: false, faq: EMPTY })}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Question *</label>
                <input className="input" value={f.question} onChange={set('question')}
                  placeholder="e.g. What are your opening hours?" />
              </div>
              <div>
                <label className="label">Answer *</label>
                <textarea className="input resize-none" rows={4} value={f.answer} onChange={set('answer')}
                  placeholder="We are open Monday to Saturday, 9am to 9pm." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setModal({ open: false, faq: EMPTY })} className="btn-secondary">Cancel</button>
              <button
                onClick={() => {
                  if (!f.question || !f.answer) return toast.error('Question and answer are required')
                  saveMutation.mutate(f)
                }}
                className="btn-primary" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : f.id ? 'Save changes' : 'Add FAQ'}
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
              <h2 className="font-semibold text-gray-900">Delete FAQ?</h2>
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
