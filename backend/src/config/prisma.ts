import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Retry wrapper for Neon auto-suspend (free tier wakes up on first request)
export async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err: any) {
      const isConnectionError = err?.message?.includes("Can't reach database")
      if (isConnectionError && i < retries - 1) {
        console.log(`[DB] Neon waking up... retry ${i + 1}/${retries}`)
        await new Promise(r => setTimeout(r, 2000)) // wait 2s for Neon to wake
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries reached')
}
