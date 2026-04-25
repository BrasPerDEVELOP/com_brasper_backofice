import { logger } from './services/logger'

function createLoggerWithContext(context: string) {
  const prefix = `[${context}]`
  return {
    debug: (msg: string, ...args: unknown[]) =>
      logger.debug(prefix, msg, ...args),
    info: (msg: string, ...args: unknown[]) =>
      logger.info(prefix, msg, ...args),
    warn: (msg: string, ...args: unknown[]) =>
      logger.warn(prefix, msg, ...args),
    error: (msg: string, ...args: unknown[]) =>
      logger.error(prefix, msg, ...args)
  }
}

export { createLoggerWithContext }
