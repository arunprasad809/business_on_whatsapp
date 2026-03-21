import axios from 'axios'
import twilio from 'twilio'

const USE_TWILIO = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)

const twilioClient = USE_TWILIO
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null

export async function sendWhatsAppMessage(
  phoneNumberId: string,
  token: string,
  to: string,
  message: string
) {
  if (USE_TWILIO) {
    console.log('[WhatsApp] Sending via Twilio to:', to)
    await twilioClient!.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER!,
      to: `whatsapp:+${to}`,
      body: message,
    })
    console.log('[WhatsApp] Sent via Twilio successfully')
  } else {
    console.log('[WhatsApp] Sending via Meta to:', to)
    await axios.post(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )
    console.log('[WhatsApp] Sent via Meta successfully')
  }
}

export async function sendWhatsAppButtonMessage(
  phoneNumberId: string,
  token: string,
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[]
) {
  if (USE_TWILIO) {
    const buttonText = buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n')
    await sendWhatsAppMessage(phoneNumberId, token, to, `${bodyText}\n\n${buttonText}`)
  } else {
    await axios.post(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map(b => ({
              type: 'reply',
              reply: { id: b.id, title: b.title },
            })),
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )
  }
}