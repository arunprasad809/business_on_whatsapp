import { Router, Response } from 'express'
import { prisma } from '../config/prisma'
import { authenticate, AuthRequest } from '../middleware/authenticate'
import { AppError } from '../middleware/errorHandler'

export const whatsappRouter = Router()
whatsappRouter.use(authenticate)

// GET /api/whatsapp/status
whatsappRouter.get('/status', async (req: AuthRequest, res: Response) => {
  const business = await prisma.business.findUnique({
    where: { id: req.businessId },
    select: { whatsappNumber: true, whatsappVerified: true },
  })
  if (!business) throw new AppError(404, 'Business not found')
  return res.json(business)
})

// POST /api/whatsapp/connect
whatsappRouter.post('/connect', async (req: AuthRequest, res: Response) => {
  const { whatsappNumber } = req.body
  if (!whatsappNumber) throw new AppError(400, 'whatsappNumber is required')

  const existing = await prisma.business.findFirst({
    where: { whatsappNumber, NOT: { id: req.businessId } },
  })
  if (existing) throw new AppError(409, 'This WhatsApp number is already connected to another account')

  const business = await prisma.business.update({
    where: { id: req.businessId },
    data: { whatsappNumber, whatsappVerified: false },
    select: { whatsappNumber: true, whatsappVerified: true },
  })

  // In production: trigger Meta API verification flow here

  return res.json({
    ...business,
    webhookUrl: `${process.env.BACKEND_URL ?? 'http://localhost:3001'}/api/webhook/whatsapp/${req.businessId}`,
    verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
  })
})
