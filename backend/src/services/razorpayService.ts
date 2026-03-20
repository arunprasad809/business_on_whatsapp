import Razorpay from 'razorpay'
import crypto from 'crypto'
import { prisma } from '../config/prisma'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
}

export async function createPaymentLink(
  businessId: string,
  customerPhone: string,
  cart: CartItem[],
  customerName?: string
): Promise<{ paymentLink: string; orderId: string }> {

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const amountInPaise = Math.round(totalAmount * 100)

  // Create Razorpay payment link (easier than hosted checkout for WhatsApp)
  const paymentLinkResponse = await razorpay.paymentLink.create({
    amount: amountInPaise,
    currency: 'INR',
    accept_partial: false,
    description: `Order from ${businessId}`,
    customer: {
      name: customerName ?? 'Customer',
      contact: customerPhone,
    },
    notify: {
      sms: false,
      email: false,
    },
    reminder_enable: false,
    callback_url: `${process.env.BACKEND_URL ?? 'http://localhost:3001'}/api/webhook/razorpay-return`,
    callback_method: 'get',
  } as any)

  // Save the order in DB
  const order = await prisma.order.create({
    data: {
      businessId,
      customerPhone,
      customerName: customerName ?? null,
      status: 'PAYMENT_LINK_SENT',
      totalAmount,
      razorpayOrderId: (paymentLinkResponse as any).id,
      paymentLinkUrl: (paymentLinkResponse as any).short_url,
      items: {
        create: cart.map(item => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      },
    },
  })

  // Link session
  const session = await prisma.chatSession.findUnique({
    where: { businessId_customerPhone: { businessId, customerPhone } },
  })
  if (session) {
    await prisma.order.update({
      where: { id: order.id },
      data: { sessionId: session.id },
    })
  }

  return {
    paymentLink: (paymentLinkResponse as any).short_url,
    orderId: order.id,
  }
}

export function verifyRazorpayWebhook(body: Buffer, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex')
  return expectedSignature === signature
}

export async function handlePaymentSuccess(razorpayPaymentLinkId: string, paymentId: string) {
  const order = await prisma.order.findFirst({
    where: { razorpayOrderId: razorpayPaymentLinkId },
    include: { items: true },
  })
  if (!order) return null

  return prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'PAID',
      razorpayPaymentId: paymentId,
      paidAt: new Date(),
    },
    include: { items: true },
  })
}
