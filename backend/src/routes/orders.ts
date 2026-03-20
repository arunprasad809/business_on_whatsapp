import { Router, Response } from 'express'
import { prisma } from '../config/prisma'
import { authenticate, AuthRequest } from '../middleware/authenticate'
import { AppError } from '../middleware/errorHandler'

export const ordersRouter = Router()
ordersRouter.use(authenticate)

// GET /api/orders
ordersRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { status, page = '1', limit = '20' } = req.query
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string)

  const where: any = { businessId: req.businessId }
  if (status) where.status = status

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit as string),
    }),
    prisma.order.count({ where }),
  ])

  return res.json({ orders, total, page: parseInt(page as string), limit: parseInt(limit as string) })
})

// GET /api/orders/:id
ordersRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, businessId: req.businessId },
    include: { items: true, session: true },
  })
  if (!order) throw new AppError(404, 'Order not found')
  return res.json(order)
})

// PATCH /api/orders/:id/status
ordersRouter.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const { status } = req.body
  const validStatuses = ['PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED']
  if (!validStatuses.includes(status)) {
    throw new AppError(400, `Status must be one of: ${validStatuses.join(', ')}`)
  }

  const existing = await prisma.order.findFirst({
    where: { id: req.params.id, businessId: req.businessId },
  })
  if (!existing) throw new AppError(404, 'Order not found')

  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { status },
    include: { items: true },
  })
  return res.json(order)
})
