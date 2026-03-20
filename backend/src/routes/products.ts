import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { authenticate, AuthRequest } from '../middleware/authenticate'
import { AppError } from '../middleware/errorHandler'

export const productsRouter = Router()
productsRouter.use(authenticate)

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  isAvailable: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  categoryId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().default(0),
})

// GET /api/products
productsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const products = await prisma.product.findMany({
    where: { businessId: req.businessId },
    include: { category: { select: { id: true, name: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })
  return res.json(products)
})

// GET /api/products/:id
productsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const product = await prisma.product.findFirst({
    where: { id: req.params.id, businessId: req.businessId },
    include: { category: { select: { id: true, name: true } } },
  })
  if (!product) throw new AppError(404, 'Product not found')
  return res.json(product)
})

// POST /api/products
productsRouter.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = productSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const product = await prisma.product.create({
    data: { ...parsed.data, businessId: req.businessId! },
    include: { category: { select: { id: true, name: true } } },
  })
  return res.status(201).json(product)
})

// PUT /api/products/:id
productsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const parsed = productSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, businessId: req.businessId },
  })
  if (!existing) throw new AppError(404, 'Product not found')

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: { category: { select: { id: true, name: true } } },
  })
  return res.json(product)
})

// DELETE /api/products/:id
productsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, businessId: req.businessId },
  })
  if (!existing) throw new AppError(404, 'Product not found')

  await prisma.product.delete({ where: { id: req.params.id } })
  return res.json({ success: true })
})

// PATCH /api/products/:id/toggle
productsRouter.patch('/:id/toggle', async (req: AuthRequest, res: Response) => {
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, businessId: req.businessId },
  })
  if (!existing) throw new AppError(404, 'Product not found')

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: { isAvailable: !existing.isAvailable },
  })
  return res.json(product)
})
