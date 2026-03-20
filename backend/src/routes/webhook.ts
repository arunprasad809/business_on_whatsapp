import { Router, Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { getAIResponse } from '../services/aiService'
import { createPaymentLink } from '../services/razorpayService'
import { sendWhatsAppMessage } from '../services/whatsappService'

export const webhookRouter = Router()

// GET /api/webhook/whatsapp/:businessId — Meta webhook verification
webhookRouter.get('/whatsapp/:businessId', (req: Request, res: Response) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    console.log('[Webhook] Verified')
    return res.status(200).send(challenge)
  }
  return res.sendStatus(403)
})

// POST /api/webhook/whatsapp/:businessId — incoming WhatsApp messages
webhookRouter.post('/whatsapp/:businessId', async (req: Request, res: Response) => {
  // Acknowledge immediately (Meta requires fast response)
  res.sendStatus(200)

  try {
    const { businessId } = req.params
    const body = req.body

    if (body.object !== 'whatsapp_business_account') return

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue

        const messages = change.value?.messages ?? []
        const phoneNumberId = change.value?.metadata?.phone_number_id

        const business = await prisma.business.findFirst({
          where: { id: businessId, isActive: true },
        })
        if (!business) continue

        for (const message of messages) {
          if (message.type !== 'text') {
            // Handle button replies
            if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
              const buttonId = message.interactive.button_reply.id
              const from = message.from
              if (buttonId === 'confirm_order') {
                await handleOrderConfirmation(businessId, from, phoneNumberId, business.whatsappNumber ?? '')
              }
              continue
            }
            continue
          }

          const from: string = message.from
          const text: string = message.text.body

          const { reply, orderReady, updatedCart } = await getAIResponse(businessId, from, text)

          if (orderReady && updatedCart && updatedCart.length > 0) {
            // Generate payment link
            const { paymentLink } = await createPaymentLink(businessId, from, updatedCart)

            const paymentMessage = `${reply}\n\n💳 Tap below to complete your payment:\n${paymentLink}\n\nYour order will be confirmed once payment is done. ✅`

            await sendWhatsAppMessage(
              phoneNumberId,
              process.env.META_WHATSAPP_TOKEN!,
              from,
              paymentMessage
            )
          } else {
            await sendWhatsAppMessage(
              phoneNumberId,
              process.env.META_WHATSAPP_TOKEN!,
              from,
              reply
            )
          }
        }
      }
    }
  } catch (error) {
    console.error('[Webhook Error]', error)
  }
})

// POST /api/webhook/razorpay — Razorpay payment confirmation
webhookRouter.post('/razorpay', async (req: Request, res: Response) => {
  try {
    const event = JSON.parse(req.body.toString())

    if (event.event === 'payment_link.paid') {
      const paymentLinkId = event.payload.payment_link.entity.id
      const paymentId = event.payload.payment.entity.id

      const order = await prisma.order.findFirst({
        where: { razorpayOrderId: paymentLinkId },
        include: { items: true, session: true },
      })

      if (order) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'PAID', razorpayPaymentId: paymentId, paidAt: new Date() },
        })

        // Send confirmation message
        const business = await prisma.business.findUnique({
          where: { id: order.businessId },
        })

        if (business) {
          const itemsSummary = order.items
            .map(i => `• ${i.name} x${i.quantity} — ₹${(i.price * i.quantity).toFixed(2)}`)
            .join('\n')

          const confirmMsg = `✅ Payment received! Your order is confirmed.\n\n${itemsSummary}\n\nTotal: ₹${order.totalAmount.toFixed(2)}\n\nThank you for ordering from ${business.name}! 🙏`

          // We need the phoneNumberId — fetch from Meta or store it. For now log it.
          console.log(`[Payment] Order ${order.id} paid. Send confirmation to ${order.customerPhone}`)
          console.log(confirmMsg)
        }
      }
    }

    return res.json({ received: true })
  } catch (error) {
    console.error('[Razorpay Webhook Error]', error)
    return res.status(400).json({ error: 'Invalid payload' })
  }
})

async function handleOrderConfirmation(
  businessId: string,
  customerPhone: string,
  phoneNumberId: string,
  _businessPhone: string
) {
  const session = await prisma.chatSession.findUnique({
    where: { businessId_customerPhone: { businessId, customerPhone } },
  })

  const cart = (session?.cartData as any)?.items ?? []
  if (!cart.length) return

  const { paymentLink } = await createPaymentLink(businessId, customerPhone, cart)
  await sendWhatsAppMessage(
    phoneNumberId,
    process.env.META_WHATSAPP_TOKEN!,
    customerPhone,
    `Here is your payment link 👇\n${paymentLink}\n\nTap to pay securely. Your order will be confirmed instantly. ✅`
  )
}
