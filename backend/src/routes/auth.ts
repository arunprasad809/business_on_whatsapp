import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { authenticate, AuthRequest } from '../middleware/authenticate'
import { AppError } from '../middleware/errorHandler'

export const authRouter = Router()

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

// POST /api/auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const { name, email, password } = parsed.data

  const existing = await prisma.business.findUnique({ where: { email } })
  if (existing) throw new AppError(409, 'Email already registered')

  const passwordHash = await bcrypt.hash(password, 12)
  const business = await prisma.business.create({
    data: { name, email, passwordHash },
    select: { id: true, name: true, email: true, createdAt: true },
  })

  const token = jwt.sign({ businessId: business.id }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })

  return res.status(201).json({ token, business })
})

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const { email, password } = parsed.data

  const business = await prisma.business.findUnique({ where: { email } })
  if (!business) throw new AppError(401, 'Invalid credentials')

  const valid = await bcrypt.compare(password, business.passwordHash)
  if (!valid) throw new AppError(401, 'Invalid credentials')

  const token = jwt.sign({ businessId: business.id }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })

  return res.json({
    token,
    business: {
      id: business.id,
      name: business.name,
      email: business.email,
      logoUrl: business.logoUrl,
      whatsappNumber: business.whatsappNumber,
    },
  })
})

// GET /api/auth/me
authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const business = await prisma.business.findUnique({
    where: { id: req.businessId },
    select: {
      id: true, name: true, email: true, logoUrl: true,
      description: true, whatsappNumber: true, whatsappVerified: true, createdAt: true,
    },
  })
  if (!business) throw new AppError(404, 'Business not found')
  return res.json(business)
})
