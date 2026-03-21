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
    console.log('[Webhook] Meta verified')
    return res.status(200).send(challenge)
  }
  return res.sendStatus(403)
})

// POST /api/webhook/whatsapp/:businessId — handles BOTH Meta and Twilio
webhookRouter.post('/whatsapp/:businessId', async (req: Request, res: Response) => {
  res.sendStatus(200)
  try {
    const { businessId } = req.params
    const body = req.body
    console.log('[Webhook] Received body keys:', Object.keys(body))

    // ─── Twilio format ───────────────────────────────────────────────
    if (body.From && body.Body) {
      console.log('[Webhook] Twilio message from:', body.From, '→', body.Body)
      const customerPhone = body.From.replace('whatsapp:+', '')
      const text = body.Body
      const business = await prisma.business.findFirst({
        where: { id: businessId, isActive: true },
      })
      if (!business) { console.log('[Webhook] Business not found:', businessId); return }
      console.log('[Webhook] Business found:', business.name)
      console.log('[Webhook] Calling AI for:', text)
      const { reply, orderReady, updatedCart } = await getAIResponse(businessId, customerPhone, text)
      console.log('[Webhook] AI replied:', reply.substring(0, 150))
      if (orderReady && updatedCart && updatedCart.length > 0) {
        const { paymentLink } = await createPaymentLink(businessId, customerPhone, updatedCart)
        const paymentMessage = `${reply}\n\n💳 Tap to pay:\n${paymentLink}\n\nYour order will be confirmed once payment is done. ✅`
        await sendWhatsAppMessage('', '', customerPhone, paymentMessage)
      } else {
        await sendWhatsAppMessage('', '', customerPhone, reply)
      }
      return
    }

    // ─── Meta format ─────────────────────────────────────────────────
    if (body.object !== 'whatsapp_business_account') {
      console.log('[Webhook] Not a recognised WhatsApp event, skipping')
      return
    }
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue
        const messages = change.value?.messages ?? []
        const phoneNumberId = change.value?.metadata?.phone_number_id
        const business = await prisma.business.findFirst({
          where: { id: businessId, isActive: true },
        })
        if (!business) continue
        console.log('[Webhook] Business found:', business.name)
        for (const message of messages) {
          if (message.type !== 'text') continue
          const from: string = message.from
          const text: string = message.text.body
          console.log('[Webhook] Calling AI for:', text)
          const { reply, orderReady, updatedCart } = await getAIResponse(businessId, from, text)
          console.log('[Webhook] AI replied:', reply.substring(0, 150))
          if (orderReady && updatedCart && updatedCart.length > 0) {
            const { paymentLink } = await createPaymentLink(businessId, from, updatedCart)
            const paymentMessage = `${reply}\n\n💳 Tap to pay:\n${paymentLink}\n\nYour order will be confirmed once payment is done. ✅`
            await sendWhatsAppMessage(phoneNumberId, process.env.META_WHATSAPP_TOKEN!, from, paymentMessage)
          } else {
            await sendWhatsAppMessage(phoneNumberId, process.env.META_WHATSAPP_TOKEN!, from, reply)
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
        include: { items: true },
      })
      if (order) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'PAID', razorpayPaymentId: paymentId, paidAt: new Date() },
        })
        const business = await prisma.business.findUnique({ where: { id: order.businessId } })
        if (business) {
          const itemsSummary = order.items.map(i => `• ${i.name} x${i.quantity} — ₹${(i.price * i.quantity).toFixed(2)}`).join('\n')
          const confirmMsg = `✅ Payment received! Your order is confirmed.\n\n${itemsSummary}\n\nTotal: ₹${order.totalAmount.toFixed(2)}\n\nThank you for ordering from ${business.name}! 🙏`
          await sendWhatsAppMessage('', '', order.customerPhone, confirmMsg)
        }
      }
    }
    return res.json({ received: true })
  } catch (error) {
    console.error('[Razorpay Webhook Error]', error)
    return res.status(400).json({ error: 'Invalid payload' })
  }
})