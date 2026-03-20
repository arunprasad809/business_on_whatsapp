import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../config/prisma'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
}

interface SessionContext {
  cart: CartItem[]
  customerName?: string
}

export async function getAIResponse(
  businessId: string,
  customerPhone: string,
  userMessage: string
): Promise<{ reply: string; updatedCart?: CartItem[]; orderReady?: boolean }> {

  // Load business data for context
  const [business, products, faqs, session] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, description: true },
    }),
    prisma.product.findMany({
      where: { businessId, isAvailable: true },
      include: { category: { select: { name: true } } },
      orderBy: [{ sortOrder: 'asc' }],
    }),
    prisma.faq.findMany({
      where: { businessId },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.chatSession.findUnique({
      where: { businessId_customerPhone: { businessId, customerPhone } },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20, // last 20 messages for context
        },
      },
    }),
  ])

  if (!business) throw new Error('Business not found')

  // Build product catalog string
  const catalogText = products.map(p =>
    `- ${p.name} | ₹${p.price} | Category: ${p.category?.name ?? 'General'} | Tags: ${p.tags.join(', ') || 'none'} | ID: ${p.id}`
  ).join('\n')

  const faqText = faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')

  // Parse current cart from session
  const cartData = (session?.cartData as any) ?? { items: [], total: 0 }
  const currentCart: CartItem[] = cartData.items ?? []

  const systemPrompt = `You are a friendly AI assistant for "${business.name}", a business on WhatsApp.
${business.description ? `About the business: ${business.description}` : ''}

Your job:
1. Help customers browse products, answer questions, and place orders — all via WhatsApp chat.
2. Be warm, concise, and helpful. Use simple formatting (no markdown bold, no headers).
3. When showing products, list them clearly with name and price.
4. Filter products intelligently when asked (e.g. "rice-based", "white coloured", "under 200", "vegetarian").
5. When a customer wants to order, confirm their items and ask for their name if not known.
6. Once confirmed, end your reply with the exact token: ORDER_READY — this triggers payment link generation.
7. Never make up products. Only show what's in the catalog below.

PRODUCT CATALOG:
${catalogText || 'No products added yet.'}

FAQs:
${faqText || 'No FAQs added yet.'}

CURRENT CART: ${JSON.stringify(currentCart)}

IMPORTANT RULES:
- Keep replies short and WhatsApp-friendly (no markdown).
- When filtering by colour/type/diet, match against product name, description, and tags.
- If customer says "order", "buy", "I want", "add to cart" — update their cart and confirm.
- If customer says "show cart" or "my order" — summarise cart items and total.
- If cart is confirmed and customer says "place order", "confirm", "yes proceed" — say the order summary and end with ORDER_READY.
- Be conversational. Never output JSON or technical info to the customer.`

  // Build message history
  const history = (session?.messages ?? []).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      ...history,
      { role: 'user', content: userMessage },
    ],
  })

  const replyText = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as any).text)
    .join('')

  const orderReady = replyText.includes('ORDER_READY')
  const cleanReply = replyText.replace('ORDER_READY', '').trim()

  // Persist messages and session
  await upsertSessionAndMessages(businessId, customerPhone, userMessage, cleanReply, currentCart)

  return {
    reply: cleanReply,
    updatedCart: currentCart,
    orderReady,
  }
}

async function upsertSessionAndMessages(
  businessId: string,
  customerPhone: string,
  userMessage: string,
  assistantReply: string,
  cart: CartItem[]
) {
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const session = await prisma.chatSession.upsert({
    where: { businessId_customerPhone: { businessId, customerPhone } },
    create: {
      businessId,
      customerPhone,
      cartData: { items: cart, total },
      lastMessageAt: new Date(),
    },
    update: {
      cartData: { items: cart, total },
      lastMessageAt: new Date(),
    },
  })

  await prisma.chatMessage.createMany({
    data: [
      { sessionId: session.id, role: 'user', content: userMessage },
      { sessionId: session.id, role: 'assistant', content: assistantReply },
    ],
  })

  return session
}
