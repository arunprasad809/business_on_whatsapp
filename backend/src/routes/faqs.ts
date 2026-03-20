import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { authenticate, AuthRequest } from '../middleware/authenticate'
import { AppError } from '../middleware/errorHandler'

export const faqsRouter = Router()
faqsRouter.use(authenticate)

const faqSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  sortOrder: z.number().int().default(0),
})

// GET /api/faqs
faqsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const faqs = await prisma.faq.findMany({
    where: { businessId: req.businessId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return res.json(faqs)
})

// POST /api/faqs
faqsRouter.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = faqSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const faq = await prisma.faq.create({
    data: { ...parsed.data, businessId: req.businessId! },
  })
  return res.status(201).json(faq)
})

// PUT /api/faqs/:id
faqsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const parsed = faqSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const existing = await prisma.faq.findFirst({
    where: { id: req.params.id, businessId: req.businessId },
  })
  if (!existing) throw new AppError(404, 'FAQ not found')

  const faq = await prisma.faq.update({ where: { id: req.params.id }, data: parsed.data })
  return res.json(faq)
})

// DELETE /api/faqs/:id
faqsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const existing = await prisma.faq.findFirst({
    where: { id: req.params.id, businessId: req.businessId },
  })
  if (!existing) throw new AppError(404, 'FAQ not found')

  await prisma.faq.delete({ where: { id: req.params.id } })
  return res.json({ success: true })
})
