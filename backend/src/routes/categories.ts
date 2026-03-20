import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { authenticate, AuthRequest } from '../middleware/authenticate'
import { AppError } from '../middleware/errorHandler'

export const categoriesRouter = Router()
categoriesRouter.use(authenticate)

const categorySchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().default(0),
})

categoriesRouter.get('/', async (req: AuthRequest, res: Response) => {
  const categories = await prisma.category.findMany({
    where: { businessId: req.businessId },
    include: { _count: { select: { products: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return res.json(categories)
})

categoriesRouter.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = categorySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const category = await prisma.category.create({
    data: { ...parsed.data, businessId: req.businessId! },
  })
  return res.status(201).json(category)
})

categoriesRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const parsed = categorySchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const existing = await prisma.category.findFirst({
    where: { id: req.params.id, businessId: req.businessId },
  })
  if (!existing) throw new AppError(404, 'Category not found')

  const category = await prisma.category.update({
    where: { id: req.params.id },
    data: parsed.data,
  })
  return res.json(category)
})

categoriesRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const existing = await prisma.category.findFirst({
    where: { id: req.params.id, businessId: req.businessId },
  })
  if (!existing) throw new AppError(404, 'Category not found')

  await prisma.category.delete({ where: { id: req.params.id } })
  return res.json({ success: true })
})
