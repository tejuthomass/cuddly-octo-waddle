import { useContext } from 'react'
import { AuthContext } from '../store/AuthContext'
import type { AuthContextValue } from '@/types/auth'

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
