import sendToWhatsApp from "../services/httpRequest/sendToWhatsApp.js";

class WhatsAppService {
  async sendMessage(to, body, messageId) {
  const data = {
          messaging_product: 'whatsapp',
          to,
          text: { body }
        }
    await sendToWhatsApp(data);
  }

  async markAsRead(messageId) {
    const data = {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }
    await sendToWhatsApp(data);
  }

  async sendInteractiveButtons(to, BodyText, buttons){
    const data = {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: BodyText },
          action: { buttons: buttons }
        }
    }
    await sendToWhatsApp(data);
  }

}

export default new WhatsAppService();