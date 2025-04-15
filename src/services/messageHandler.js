import whatsappService from './whatsappService.js';
import sheetsUtils  from './googleSheetsService.js';
import { openAiExtractData, openAiSearchRates, openAiAsistance } from './openAiService.js';
import { SelectedData, filterData, standardizePort } from './dataManagement.js';
import { handleCompleteRequest, handlePendingRequest } from './requestHandler.js'

class MessageHandler {

  constructor() {
    this.requestState = {};
    this.assistanceState = {};
    this.hasWelcomed = {}
  }

  async handleIncomingMessage(message, senderInfo) {
    if (message?.type === 'text') {
        const incomingMessage = message.text.body.toLowerCase().trim();

        if (!this.hasWelcomed[message.from]) {
          await this.sendWelcomeMessage(message.from, message.id, senderInfo);
          await this.sendWelcomeMenu(message.from);
          this.hasWelcomed[message.from] = true; // 🔹 marca como saludado
        }

        if (incomingMessage === 'media') {
          await this.sendMedia(message.from);

        } else if (this.requestState[message.from]) {
          await this.handleRequestFlow(message.from, incomingMessage)

        } else if (this.assistanceState[message.from]) {
          await this.handleAssistanceFlow(message.from, incomingMessage)

        } 
        await whatsappService.markAsRead(message.id);

    } else if (message?.type == 'interactive'){
      const option = message?.interactive?.button_reply?.id.toLowerCase().trim();
      console.log(option)
      await this.handleMenuOption(message.from, option);
      await whatsappService.markAsRead(message.id);
    }
  }

  getSenderName(senderInfo){
    return senderInfo.profile?.name || senderInfo.wa_id || "trader";
  }

  async sendWelcomeMessage(to, messageId, senderInfo){
    const name = this.getSenderName(senderInfo);
    const WelcomeMessage = `Hello ${name}, it's Regina. How can I help you today?`;
    await whatsappService.sendMessage(to, WelcomeMessage, messageId)
  }

  async sendWelcomeMenu(to){
    const menuMessage = "Choose an option"
    const buttons = [
      {
        type: 'reply', reply: {id: 'new_request', title: 'New Request'}
      },
      {
        type: 'reply', reply: {id: 'ask_me_a_question', title: 'Ask me a question'}
      }
    ];

    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);
  }

  async handleMenuOption(to, option) {
    let response = null;
    const normalizedOption = option.toLowerCase().trim();
  
    switch (normalizedOption) {
      case 'new_request':
        this.requestState[to] = { step: 'information' };
        response = "Great! Please, type all your requirements (POL - POD, Container type, empty pickup city, commodity)";
        break;
      case 'ask_me_a_question':
        this.assistanceState[to] = { step: 'question' };
        response = "Awesome! How can I help you today?";
        break;
      case 'finished':
        response = "Thank you for using our service. Have a great day!";
        delete this.assistanceState[to];
        delete this.requestState[to];
        delete this.hasWelcomed[to]; 
        break;
      case 'continue_question':
        return;
      default:
        response = "Please choose a valid option.";
    }
  
    if (response) {
      await whatsappService.sendMessage(to, response);
    }
  }

  async handleRequestFlow(to, message) {
    const state = this.requestState[to] || { step: 'information' };

    const response = await openAiExtractData(message);

    const previousData = this.requestState[to] || {};
    const combinedData = {
      ...previousData,
      ...response,
      step: 'information'
    };
    this.requestState[to] = combinedData;

    const missingFields = [];
    if (!response?.pol) missingFields.push("origin port");
    if (!response?.pod) missingFields.push("destination port");
    if (!response?.type_container) missingFields.push("container type");
    if (!response?.commodity) missingFields.push("commodity");

    if (missingFields.length > 0) {
      await whatsappService.sendMessage(
        to,
        `It seems some information is missing: ${missingFields.join(", ")}. Please send your request again.`
      );
      this.requestState[to] = { step: 'information' };
      return;
    }

    await whatsappService.sendMessage(
      to,
      "Thank you for your request! We will be back soon with the best offer."
    );
  
    const df = await sheetsUtils.readGoogleSheet();
    const df_st = df.map(row => ({
      ...row,
      POD: standardizePort(row.POD)
    }));

    const allSelectedData = SelectedData(df_st);
    const filteredData = filterData(allSelectedData, combinedData);

    if (filteredData.length > 0) {
      // Si se encontraron datos filtrados, se maneja la solicitud completa.
      const offerSummary = await handleCompleteRequest(combinedData, filteredData, to);
      this.requestState[to] = { ...this.requestState[to], step: 'requestProcessed' };
      await whatsappService.sendMessage(to, offerSummary);
      await this.sendAnotherRequest(to);
    } else {
      // Si no se encontraron datos filtrados, se registra una solicitud pendiente.
      this.requestState[to] = { ...this.requestState[to], step: 'requestProcessed' };
      await handlePendingRequest(combinedData, to);
      await this.sendAnotherRequest(to);

    }
  }

  async sendAnotherRequest(to) {
    const state = this.requestState[to];
    let response = "Your request has been processed."; 

    if (state && state.step === 'requestProcessed') {
      response = "Your request has been processed.";
    }
  
    delete this.requestState[to];
  
    const menuMessage = "Do you want to send another request?";
    const buttons = [
      { type: 'reply', reply: { id: 'new_request', title: "Yes!" } },
      { type: 'reply', reply: { id: 'finished', title: "No, Thank you" } }
    ];
  
    await whatsappService.sendMessage(to, response);
    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);
  }

  async handleAssistanceFlow(to, message) {
    if (!this.assistanceState[to]) {
      this.assistanceState[to] = { step: 'question', conversation: [] };
    }
    if (!this.assistanceState[to].conversation) {
      this.assistanceState[to].conversation = [];
    }

    const state = this.assistanceState[to];

    state.conversation.push({ role: 'user', content: message });

    const response = await openAiAsistance(state.conversation);
    state.conversation.push({ role: 'assistant', content: response });
    
    const menuMessage = "Was the response helpful? You can continue the conversation or end it.";
    const buttons = [
      { type: 'reply', reply: { id: 'finished', title: "End conversation" } },
      { type: 'reply', reply: { id: 'continue_question', title: "Ask another question" } }
    ];
  
    await whatsappService.sendMessage(to, response);
    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);
  }

}

export default new MessageHandler();