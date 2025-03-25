import whatsappService from './whatsappService.js';
import sheetsUtils  from './googleSheetsService.js';
import { openAiExtractData, openAiSearchRates, openAiAsistance } from './openAiService.js';
import { SelectedData, filterData } from './dataManagement.js';
import { handleCompleteRequest, handlePendingRequest } from './requestHandler.js'

class MessageHandler {

  constructor() {
    this.requestState = {};
    this.assistanceState = {};
  }

  async handleIncomingMessage(message, senderInfo) {
    if (message?.type === 'text') {
        const incomingMessage = message.text.body.toLowerCase().trim();

        if(this.isGreeting(incomingMessage)){
            await this.sendWelcomeMessage(message.from, message.id, senderInfo)
            await this.sendWelcomeMenu(message.from);

        } else if (incomingMessage === 'media') {
          await this.sendMedia(message.from);

        } else if (this.requestState[message.from]) {
          await this.handleRequestFlow(message.from, incomingMessage)

        } else if (this.assistanceState[message.from]) {
          await this.handleAssistanceFlow(message.from, incomingMessage)

        } else {
            const response = `Echo: ${message.text.body}`;
            await whatsappService.sendMessage(message.from, response, message.id, senderInfo);
        }
        await whatsappService.markAsRead(message.id);
    } else if (message?.type == 'interactive'){
      const option = message?.interactive?.button_reply?.id.toLowerCase().trim();
      console.log(option)
      await this.handleMenuOption(message.from, option);
      await whatsappService.markAsRead(message.id);
    }
  }
  isGreeting(message){
    const greetings = ["hola", "hello", "hi", "buenas tardes"]
    return greetings.includes(message);
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
    console.log("Option received:", option);
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
        // Optionally clear the assistance state if needed:
        delete this.assistanceState[to];
        break;
      case 'continue_question':
        // Do nothing and wait for the user to ask a new question.
        return;
      default:
        response = "Please choose a valid option.";
    }
  
    if (response) {
      await whatsappService.sendMessage(to, response);
    }
  }

  async handleRequestFlow(to, message) {
    const state = this.requestState[to];
    let response;

    if (state.step === 'information') {
      response = await openAiExtractData(message);
      this.requestState[to] = response;
    }

    await whatsappService.sendMessage(to, "Thank you for your request! We will be back soon with the best offer.");

    const extractedData = this.requestState[to];
    const df = await sheetsUtils.readGoogleSheet();

    const allSelectedData = SelectedData(df);
    const filteredData = filterData(allSelectedData, extractedData);

    const allowedPols = ['baq', 'ctg', 'bun'];
    const userPol = extractedData.pol ? extractedData.pol.toLowerCase() : '';
    
    const handler = new MessageHandler();

    if (allowedPols.includes(userPol)) {
      if (filteredData.length > 0) {
        // Si se encontraron datos filtrados, se maneja la solicitud completa.
        const offerSummary = await handleCompleteRequest(extractedData, filteredData, to);
        this.requestState[to] = { ...this.requestState[to], step: 'requestProcessed' };
        await whatsappService.sendMessage(to, offerSummary);
        await this.sendAnotherRequest(to);
      } else {
        // Si no se encontraron datos filtrados, se registra una solicitud pendiente.
        this.requestState[to] = { ...this.requestState[to], step: 'requestProcessed' };
        await handlePendingRequest(extractedData, to);
        await this.sendAnotherRequest(to);

      }
    } else {
      // Si el POL no está permitido, se registra una solicitud pendiente.
      this.requestState[to] = { ...this.requestState[to], step: 'requestProcessed' };
      await handlePendingRequest(extractedData, to);
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