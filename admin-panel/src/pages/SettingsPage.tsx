import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { Smartphone, CheckCircle, Copy, ExternalLink, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { business } = useAuth()
  const qc = useQueryClient()
  const [profileForm, setProfileForm] = useState({ name: '', description: '', logoUrl: '' })
  const [waNumber, setWaNumber] = useState('')
  const [webhookInfo, setWebhookInfo] = useState<{ webhookUrl: string; verifyToken: string } | null>(null)

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/api/business/profile').then(r => r.data),
  })

  useEffect(() => {
    if (profile) {
      setProfileForm({
        name: profile.name ?? '',
        description: profile.description ?? '',
        logoUrl: profile.logoUrl ?? '',
      })
      setWaNumber(profile.whatsappNumber ?? '')
    }
  }, [profile])

  const profileMutation = useMutation({
    mutationFn: (data: any) => api.put('/api/business/profile', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.success('Profile saved') },
    onError: () => toast.error('Failed to save profile'),
  })

  const waMutation = useMutation({
    mutationFn: (number: string) => api.post('/api/whatsapp/connect', { whatsappNumber: number }).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      setWebhookInfo({ webhookUrl: data.webhookUrl, verifyToken: data.verifyToken })
      toast.success('WhatsApp number linked!')
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Failed to connect'),
  })

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied!')
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setProfileForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your business profile and WhatsApp integration</p>
      </div>

      {/* Business Profile */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Business profile</h2>

        <div>
          <label className="label">Business name</label>
          <input className="input" value={profileForm.name} onChange={set('name')} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input resize-none" rows={2} value={profileForm.description} onChange={set('description')}
            placeholder="What does your business do?" />
        </div>
        <div>
          <label className="label">Logo URL</label>
          <input className="input" value={profileForm.logoUrl} onChange={set('logoUrl')} placeholder="https://..." />
        </div>
        <div className="flex justify-end">
          <button onClick={() => profileMutation.mutate(profileForm)} className="btn-primary"
            disabled={profileMutation.isPending}>
            {profileMutation.isPending ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </div>

      {/* WhatsApp Integration */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
            <Smartphone size={18} className="text-brand-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">WhatsApp integration</h2>
            <p className="text-xs text-gray-400">Connect your WhatsApp Business number</p>
          </div>
          {profile?.whatsappVerified && (
            <span className="ml-auto badge-success flex items-center gap-1">
              <CheckCircle size={12} /> Connected
            </span>
          )}
        </div>

        <div>
          <label className="label">WhatsApp Business number</label>
          <div className="flex gap-2">
            <input className="input" value={waNumber} onChange={e => setWaNumber(e.target.value)}
              placeholder="+919876543210" />
            <button onClick={() => waMutation.mutate(waNumber)} className="btn-primary shrink-0"
              disabled={waMutation.isPending || !waNumber}>
              {waMutation.isPending ? 'Linking…' : 'Link number'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Enter in E.164 format: +91XXXXXXXXXX</p>
        </div>

        {/* Webhook info — shown after connecting */}
        {(webhookInfo || profile?.whatsappNumber) && (
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-yellow-500 shrink-0" />
              <p className="text-xs font-medium text-gray-700">
                Configure these in your Meta App → WhatsApp → Configuration
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">Webhook URL</p>
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-xs text-gray-700 flex-1 break-all font-mono">
                  {webhookInfo?.webhookUrl ??
                    `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/api/webhook/whatsapp/${business?.id}`}
                </code>
                <button onClick={() => copy(webhookInfo?.webhookUrl ?? '')} className="text-gray-400 hover:text-gray-600 shrink-0">
                  <Copy size={14} />
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">Verify token</p>
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-xs text-gray-700 flex-1 font-mono">
                  {webhookInfo?.verifyToken ?? '(set META_WEBHOOK_VERIFY_TOKEN in backend .env)'}
                </code>
                <button onClick={() => copy(webhookInfo?.verifyToken ?? '')} className="text-gray-400 hover:text-gray-600 shrink-0">
                  <Copy size={14} />
                </button>
              </div>
            </div>

            <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
              Open Meta Developer Console <ExternalLink size={11} />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
