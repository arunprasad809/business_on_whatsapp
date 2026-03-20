import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '../utils/api'

interface Business {
  id: string
  name: string
  email: string
  logoUrl?: string
  whatsappNumber?: string
}

interface AuthContextType {
  business: Business | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness] = useState<Business | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      api.get('/api/auth/me')
        .then(r => setBusiness(r.data))
        .catch(() => { setToken(null); localStorage.removeItem('token') })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/api/auth/login', { email, password })
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setBusiness(data.business)
  }

  const register = async (name: string, email: string, password: string) => {
    const { data } = await api.post('/api/auth/register', { name, email, password })
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setBusiness(data.business)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setBusiness(null)
  }

  return (
    <AuthContext.Provider value={{ business, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
