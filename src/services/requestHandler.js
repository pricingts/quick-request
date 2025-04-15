import { openAiSearchRates } from './openAiService.js';
import sheetsUtils from './googleSheetsService.js';
import whatsappService from './whatsappService.js';

function formatColombiaDate() {
    const date = new Date();

    const options = { timeZone: "America/Bogota" };

    const year = new Intl.DateTimeFormat('es-CO', { ...options, year: 'numeric' }).format(date);
    const month = new Intl.DateTimeFormat('es-CO', { ...options, month: '2-digit' }).format(date);
    const day = new Intl.DateTimeFormat('es-CO', { ...options, day: '2-digit' }).format(date);
    const hour = new Intl.DateTimeFormat('es-CO', { ...options, hour: '2-digit', hour12: false }).format(date);
    const minute = new Intl.DateTimeFormat('es-CO', { ...options, minute: '2-digit' }).format(date);
    const second = new Intl.DateTimeFormat('es-CO', { ...options, second: '2-digit' }).format(date);

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}


function createAppendIdRow(requestId, typeRequest, date) {
    return [requestId, typeRequest, '', date, ''];
}

function createPendingRequestData(extractedData, to, requestId, date) {
    return [
        requestId,
        to,
        'Pending Scrap Request',
        date,
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
        Valid to: ${offer.validity}.`;
}

export async function handleCompleteRequest(extractedData, filteredData, to) {
    const typeRequest = 'Complete Scrap Request';
    const requestId = await sheetsUtils.generateRequestId();
    const date = formatColombiaDate();

    const bestOffer = await openAiSearchRates(extractedData, filteredData);
    console.log("Best Offer from GPT:", bestOffer);

    if (!bestOffer?.pol || !bestOffer?.pod || !bestOffer?.cost) {
        await whatsappService.sendMessage(to, "We couldn't determine a best offer based on your details. Could you please recheck your requirements and try again?");
        return;
    }

    const rowData = [
        requestId,
        to,
        typeRequest,
        date,
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

    console.log("Mejor oferta encontrada:", rowData);

    await sheetsUtils.appendRequestToSheet(rowData, typeRequest);
    await sheetsUtils.appendRequestId(createAppendIdRow(requestId, typeRequest, date));

    return completeRatesInformation(bestOffer);
}

export async function handlePendingRequest(extractedData, to) {
    const typeRequest = 'Pending Scrap Request';
    const requestId = await sheetsUtils.generateRequestId();
    const date = formatColombiaDate();

    const reqData = createPendingRequestData(extractedData, to, requestId, date);
    await sheetsUtils.appendRequestToSheet(reqData, typeRequest);
    await sheetsUtils.appendRequestId(createAppendIdRow(requestId, typeRequest, date));

    console.log('Solicitud pendiente registrada');
}
