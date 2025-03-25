import { openAiSearchRates } from './openAiService.js';
import sheetsUtils from './googleSheetsService.js';
import whatsappService from './whatsappService.js';

function createPendingRequestData(extractedData, to, colombiaDate, requestId) {
    return [
        requestId,
        to,
        'PendingRequest',
        colombiaDate,
        extractedData.pol || '',
        extractedData.pod || '',
        extractedData.type_container || '',
        extractedData.commodity || '',
        extractedData.empty_pickup || '',
        ];
}

function completeRatesInformation(offer) {
    return `Best Offer:
        Port of Origin: ${offer.pol}
        Port of Destination: ${offer.pod}, 
        Container Type: ${offer.type_container}
        Cost: ${offer.cost}
        FDO: ${offer.FDO}, FDD: ${offer.FDD}
        Shipping Line: ${offer.shipping_line}
        Empty Pickup City: ${offer.empty_pickup}
        Valid to: ${offer.validity}.`
}

export async function handleCompleteRequest(extractedData, filteredData, to) {
    const typeRequest = 'CompleteRequest';
    const colombiaDate = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
    const requestId = await sheetsUtils.generateRequestId()

    const bestOffer = await openAiSearchRates(extractedData, filteredData);
    console.log("Best Offer from GPT:", bestOffer);

    if (
        !bestOffer ||
        !bestOffer.pol ||
        !bestOffer.pod ||
        !bestOffer.cost
    ) {
        await whatsappService.sendMessage(to, "We couldn't determine a best offer based on your details. Could you please recheck your requirements and try again?");
        //requestState[to] = { step: 'information' };
        return; 
    }

    const rowData = [
        requestId,
        to,
        typeRequest,
        colombiaDate,
        bestOffer.pol,           
        bestOffer.pod,           
        bestOffer.cost,         
        bestOffer.FDO,           
        bestOffer.FDD,        
        bestOffer.shipping_line, 
        bestOffer.validity,     
        bestOffer.type_container,
        bestOffer.empty_pickup,                   
    ];

    const offerSummary = completeRatesInformation(bestOffer);
    console.log("Mejor oferta encontrada:", rowData);

    await sheetsUtils.appendRequestToSheet(rowData, typeRequest);
    const data = [requestId, typeRequest, '' , colombiaDate, '']

    await sheetsUtils.appendRequestId(data)

    return offerSummary;
}

export async function handlePendingRequest(extractedData, to) {
    const typeRequest = 'PendingRequest';
    const requestId = await sheetsUtils.generateRequestId()
    const colombiaDate = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });

    const reqData = createPendingRequestData(extractedData, to, colombiaDate, requestId);
    await sheetsUtils.appendRequestToSheet(reqData, typeRequest);

    const data = [requestId, typeRequest, '' , colombiaDate, '']

    await sheetsUtils.appendRequestId(data)

    console.log('Solicitud pendiente registrada');

}
