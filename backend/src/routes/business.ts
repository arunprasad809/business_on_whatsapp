import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { authenticate, AuthRequest } from '../middleware/authenticate'
import { AppError } from '../middleware/errorHandler'

export const businessRouter = Router()
businessRouter.use(authenticate)

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  whatsappNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be E.164 format e.g. +919876543210').optional(),
})

// GET /api/business/profile
businessRouter.get('/profile', async (req: AuthRequest, res: Response) => {
  const business = await prisma.business.findUnique({
    where: { id: req.businessId },
    select: {
      id: true, name: true, email: true, logoUrl: true,
      description: true, whatsappNumber: true, whatsappVerified: true,
      isActive: true, createdAt: true,
      _count: { select: { products: true, faqs: true, orders: true } },
    },
  })
  if (!business) throw new AppError(404, 'Business not found')
  return res.json(business)
})

// PUT /api/business/profile
businessRouter.put('/profile', async (req: AuthRequest, res: Response) => {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const business = await prisma.business.update({
    where: { id: req.businessId },
    data: parsed.data,
    select: {
      id: true, name: true, email: true, logoUrl: true,
      description: true, whatsappNumber: true, whatsappVerified: true,
    },
  })
  return res.json(business)
})

// GET /api/business/dashboard
businessRouter.get('/dashboard', async (req: AuthRequest, res: Response) => {
  const [totalOrders, paidOrders, pendingOrders, totalProducts, recentOrders] = await Promise.all([
    prisma.order.count({ where: { businessId: req.businessId } }),
    prisma.order.count({ where: { businessId: req.businessId, status: 'PAID' } }),
    prisma.order.count({ where: { businessId: req.businessId, status: { in: ['PENDING', 'PAYMENT_LINK_SENT'] } } }),
    prisma.product.count({ where: { businessId: req.businessId, isAvailable: true } }),
    prisma.order.findMany({
      where: { businessId: req.businessId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  const revenue = await prisma.order.aggregate({
    where: { businessId: req.businessId, status: { in: ['PAID', 'COMPLETED'] } },
    _sum: { totalAmount: true },
  })

  return res.json({
    totalOrders,
    paidOrders,
    pendingOrders,
    totalProducts,
    totalRevenue: revenue._sum.totalAmount ?? 0,
    recentOrders,
  })
})
