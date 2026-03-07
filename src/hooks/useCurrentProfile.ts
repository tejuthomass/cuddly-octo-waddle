import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

export interface CurrentProfile {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

const currentProfileKey = ['me', 'profile'] as const

export function useCurrentProfile() {
  const { user } = useAuth()

  return useQuery({
    queryKey: currentProfileKey,
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('No authenticated user.')
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('id', user.id)
        .maybeSingle<CurrentProfile>()

      if (error) throw error
      if (!data) throw new Error('Profile not found.')

      return data
    },
  })
}

export function useUpdateAvatar() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (avatarBlob: Blob | null) => {
      if (!user?.id) {
        throw new Error('No authenticated user.')
      }

      const storagePath = `${user.id}/avatar.webp`
      let avatarUrl: string | null = null

      if (avatarBlob) {
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(storagePath, avatarBlob, { upsert: true, contentType: 'image/webp' })

        if (uploadError) {
          throw uploadError
        }

        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(storagePath)
        avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`
      } else {
        const { error: removeError } = await supabase.storage.from('avatars').remove([storagePath])
        if (removeError && !String(removeError.message ?? '').toLowerCase().includes('not found')) {
          throw removeError
        }
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id)

      if (updateError) {
        throw updateError
      }

      return avatarUrl
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: currentProfileKey })
    },
  })
}
