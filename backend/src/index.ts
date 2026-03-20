import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'

dotenv.config()

import { authRouter } from './routes/auth'
import { productsRouter } from './routes/products'
import { categoriesRouter } from './routes/categories'
import { faqsRouter } from './routes/faqs'
import { ordersRouter } from './routes/orders'
import { businessRouter } from './routes/business'
import { whatsappRouter } from './routes/whatsapp'
import { webhookRouter } from './routes/webhook'
import { errorHandler } from './middleware/errorHandler'

const app = express()
const PORT = process.env.PORT || 3001

// Security
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))

// Razorpay webhook needs raw body - register before express.json()
app.use('/api/webhook/razorpay', express.raw({ type: 'application/json' }))

app.use(express.json())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api', limiter)

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/api/auth', authRouter)
app.use('/api/business', businessRouter)
app.use('/api/products', productsRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/faqs', faqsRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/whatsapp', whatsappRouter)
app.use('/api/webhook', webhookRouter)

// Error handler (must be last)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
})

export default app
