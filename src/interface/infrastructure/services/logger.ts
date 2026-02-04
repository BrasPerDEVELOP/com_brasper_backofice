export const logger = {
  info: (msg: string, ...args: unknown[]) => console.info(msg, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(msg, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(msg, ...args),
}
