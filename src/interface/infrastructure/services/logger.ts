const debugEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true'

export const logger = {
  debug: (msg: string, ...args: unknown[]) => {
    if (!debugEnabled) return
    console.debug(msg, ...args)
  },
  info: (msg: string, ...args: unknown[]) => console.info(msg, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(msg, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(msg, ...args),
}
