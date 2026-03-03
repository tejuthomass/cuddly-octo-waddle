import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useAdminPasswordReset() {
  return useMutation({
    mutationFn: async (payload: { email: string }) => {
      const { error } = await supabase.auth.resetPasswordForEmail(payload.email)
      if (error) {
        throw error
      }
    },
  })
}
