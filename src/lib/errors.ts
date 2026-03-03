interface ErrorLike {
  message?: string
  code?: string
}

export function toHumanErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const typedError = error as ErrorLike
    if (typedError.message && typedError.message.trim().length > 0) {
      return typedError.message
    }
  }

  return fallback
}
