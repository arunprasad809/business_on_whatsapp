import axios from 'axios'

const BASE_URL = 'https://graph.facebook.com/v19.0'

export async function sendWhatsAppMessage(
  phoneNumberId: string,
  token: string,
  to: string,
  message: string
) {
  await axios.post(
    `${BASE_URL}/${phoneNumberId}/messages`,
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
}

export async function sendWhatsAppButtonMessage(
  phoneNumberId: string,
  token: string,
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[]
) {
  await axios.post(
    `${BASE_URL}/${phoneNumberId}/messages`,
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
