import Anthropic from '@anthropic-ai/sdk'
import { Prisma } from '@prisma/client'
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

  // ─── Detect cart clear BEFORE calling AI ─────────────────────────
  const clearIntent = /\b(clear|reset|cancel all|start over|empty cart|remove all)\b/i.test(userMessage)

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
  let currentCart: CartItem[] = cartData.items ?? []

  // Clear cart AND message history immediately if intent detected
  if (clearIntent) {
    currentCart = []
    // Persist the cleared cart right away
    const clearedSession = await prisma.chatSession.upsert({
      where: { businessId_customerPhone: { businessId, customerPhone } },
      create: { businessId, customerPhone, cartData: { items: [], total: 0 }, lastMessageAt: new Date() },
      update: { cartData: { items: [], total: 0 }, lastMessageAt: new Date() },
    })
    // Also wipe message history so AI doesn't "remember" old cart from conversation context
    await prisma.chatMessage.deleteMany({ where: { sessionId: clearedSession.id } })
  }

  const systemPrompt = `You are a friendly AI assistant for "${business.name}", a business on WhatsApp.
  CURRENT CART: ${clearIntent ? '[] (cart was just cleared by customer)' : JSON.stringify(currentCart)}
${business.description ? `About the business: ${business.description}` : ''}

STRICT RULES — follow these exactly:
1. Only show products from the catalog below. Never invent items.
2. NEVER use markdown. No **, no __, no #, no bullet points with -. 
   Use plain text only. For lists use numbers: "1. Item - Price"
   WhatsApp does not render markdown — it will show as raw symbols.
3. Use simple formatting — just plain text and emojis.
4. When customer wants to order, ask for their name first if not known.
5. Maintain the cart accurately — add, remove, update items as customer requests.
6. When customer confirms the final order, summarise it clearly and end with ORDER_READY on its own line.
7. ORDER_READY must appear alone on the last line — never mid-sentence.

CART MANAGEMENT:
- Current cart: ${JSON.stringify(currentCart)}
- When customer says "cancel X" or "remove X" — remove only that item from cart
- When customer says "add X" or "I want X" — add only that item
- When customer says "2 biryanis" — they mean 2 of the biryani, not other items
- Never re-add items the customer cancelled
- Always show the updated cart after any change

PRODUCT CATALOG:
${catalogText || 'No products added yet.'}

FAQs:
${faqText || 'No FAQs added yet.'}

ORDER FLOW:
1. Customer browses → show menu/filter products
2. Customer orders → update cart, confirm items
3. Customer confirms → summarise and write ORDER_READY on last line
4. Never add ORDER_READY unless customer explicitly confirms the order

EXAMPLE of correct order confirmation:
"Here is your order:
- 2x Chicken Biryani - Rs.360
Total: Rs.360
Generating your payment link now!
ORDER_READY"
`

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
  const cleanReply = stripMarkdown(replyText.replace('ORDER_READY', '').trim())

  // Persist messages and session
  await upsertSessionAndMessages(businessId, customerPhone, userMessage, cleanReply, currentCart)

  return {
    reply: cleanReply,
    updatedCart: currentCart,
    orderReady,
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove **bold**
    .replace(/\*(.*?)\*/g, '$1')       // Remove *italic*
    .replace(/__(.*?)__/g, '$1')       // Remove __bold__
    .replace(/#+\s/g, '')              // Remove # headers
    .replace(/^\s*[-*]\s/gm, '• ')    // Convert - bullets to •
    .trim()
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
      cartData: { items: cart, total } as unknown as Prisma.InputJsonValue,
      lastMessageAt: new Date(),
    },
    update: {
      cartData: { items: cart, total } as unknown as Prisma.InputJsonValue,
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
