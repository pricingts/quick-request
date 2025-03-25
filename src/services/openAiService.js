import OpenAI from "openai";
import config from "../config/env.js";

const client = new OpenAI({
    apiKey: config.CHATGPT_API_KEY,
});

const promptTemplates = {
    extractData: (message) => `
    Extracts the following fields from this message: 
    POL - POD
    container type
    empty pick up city
    commodity

    Important: 
    1. For the field POL or POD, if the value corresponds to any of the following (or variations thereof), standardize it to the corresponding value:
    - If it is Cartagena (or similar), return "CTG"
    - If it is Barranquilla (or similar), return "BAQ"
    - If it is Buenaventura (or similar), return "BUN"
    - YOKOHAMA → "YOKOHAMA"
    - VERACRUZ → "VERACRUZ"
    - SUAPE → "SUAPE"
    - SENDAI (MIYAGI) or SENDAI → "SENDAI"
    - SAVANNAH, GA → "SAVANNAH, GA"
    - SANTOS → "SANTOS"
    - SANSHUI → "SANSHUI"
    - SANSHAN → "SANSHAN"
    - ROTTERDAM → "ROTTERDAM"
    - PORT QASIM → "PORT QASIM"
    - PORT KLANG → "PORT KLANG"
    - PORT EVERGLADES → "PORT EVERGLADES"
    - PIRAEUS → "PIRAEUS"
    - OITA → "OITA"
    - NINGBO → "NINGBO
    - NHAVA SHEVA → "NHAVA SHEVA"
    - NEW ORLEANS → "NEW ORLEANS"
    - NANHAI (even if repeated variations) → "NANHAI"
    - NAGOYA → "NAGOYA"
    - MUNDRA → "MUNDRA"
    - MOJI → "MOJI"
    - LIANHUASHAN → "LIANHUASHAN"
    - LAEM CHABANG → "LAEM CHABANG"
    - KARACHI → "KARACHI"
    - KAOHSIUNG → "KAOHSIUNG"
    - ITAPOA → "ITAPOA"
    - INCHEON → "INCHEON"
    - HOUSTON → "HOUSTON"
    - HAIPHONG → "HAIPHONG"
    - GAOMING → "GAOMING"
    - DAMAIYU → "DAMAIYU"
    - CHENNAI (KATTUPALLI) or CHENNAI → "CHENNAI"
    - CHARLESTON → "CHARLESTON"
    - BUSAN → "BUSAN"
    - BILBAO → "BILBAO"
    - ANTWERP → "ANTWERP"
    - ALGECIRAS → "ALGECIRAS"

    3. For the container type, standardize the values as follows:
    - If the container is a 20-foot container, return "20' DRY"
    - If the container is a 40-foot container and it is of HC type, return "40' DRY HC"
    - Otherwise, if it is a 40-foot container, return "40' DRY"

    4. For the empty pick up city, standardize the values as follows:
    - If empty pick up city is cartagena or similar, return CTG
    - If empty pick up city is barranquilla or similar, return BAQ
    - If empty pick up city is medellin or similar, return MED
    - If empty pick up city is cali or similar, return CALI
    - If empty pick up city is not specified, return TODOS

    5. For the commodity, standardize the values as follows:
    - If commodity is scrap or similar, return SCRAP METAL
    - If commodity is gelatina or similar, return GELATINA
    - If commodity is bebidas or similar, return BEBIDAS

    6. For the empty pick up city field, it may not always be, if the user did not include it in the message, leave the fild in blank

    Returns a diccionary with the following structure:

    {
    "pol": "...",
    "pod": "...",
    "empty_pickup": "..." if applies
    "commodity": "...",
    "type_container": "..."
    }

    Where pol refers to Port of Origin, pod refers to Port of Destination. 
    Only return the diccionary with no more additional information.
    Message: ${message}

    `,

    searchRates: (data, df) => `Using the following information: ${JSON.stringify(data)}, your task is to search in this dataframe: ${JSON.stringify(df)} for the best offer that exactly matches the requested Port of Origin (pol), Port of Destination (pod), container type (type_container) and empty pick up city (empty_pickup).
    Important instructions:
    - The requested values in the provided information should be used as the reference.
    - If any field in a matching record does not exactly correspond to the requested POL, POD, or container type after interpretation, ignore that record.
    - For the "empty pick up" field:
        - If the user does not specify an empty pick up, then consider all records regardless of the empty pick up city.
        - If the user specifies an empty pick up, then only consider records where the empty pick up exactly matches the requested value, or where the empty pick up is indicated as "TODOS" (since the rate applies for any city).
    - Among the records that clearly match the requested POL, POD, container type, and empty pick up (as per the above conditions), select the entry with the lowest cost in the column "TOTAL FLETE Y ORIGEN".
    - If any data (e.g., port name or container type) appears ambiguous or non-matching, do not invent values; leave such fields blank in the final output.

    When you find the best offer, return a dictionary with the following information:

    - "POL": Port of Origin
    - "POD": Port of Destination
    - "TOTAL FLETE Y ORIGEN": the lowest cost found
    - "FDO": Free days in Origin (if available, otherwise leave blank)
    - "FDD": Free days in Destination (if available, otherwise leave blank)
    - "Línea": (if available, otherwise leave blank)
    - "FECHA FIN FLETE": (if available, otherwise leave blank)
    - "TIPO CONT": container type
    - "EMPTY PICK UP": empty pick up city
    
    Return the dictionary in the following structure, and only return the dictionary with no additional information. If any field is missing or unknown, leave its value as an empty string:

    {
        "pol": "....",
        "pod": "....",
        "cost": $...,
        "FDO": "",
        "FDD": "",
        "shipping_line": "",
        "validity": "",
        "type_container": "...."
    }
    `,

    expertAsistance: (message) => `${message} You are an expert assistant in international trade and freight forwarding, 
    dedicated to supporting our sales and commercial teams. You possess in-depth knowledge of global logistics, 
    shipping regulations, customs procedures, documentation requirements, and freight rate optimization. 
    Your role is to provide clear, accurate, and actionable advice to our commercial staff regarding customer inquiries, freight quotes, 
    route optimization, carrier selection, and supply chain solutions. When responding, focus on delivering professional recommendations 
    and practical insights that enable our team to effectively communicate with clients and secure competitive freight solutions. 
    Ask clarifying questions when necessary and ensure your responses are tailored to our company’s best practices and market standards.`
}

export const openAiExtractData = async (message) => {
    try {
        const prompt = promptTemplates.extractData(message);

        const response = await client.chat.completions.create({
        messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: message }
        ],
        model: 'gpt-4o-mini',
        temperature: 0.0
        });

        const jsonResponse = JSON.parse(response.choices[0].message.content);
        return jsonResponse;
    } catch (error) {
        console.error(error);
    }
    };

export const openAiSearchRates = async (data, df) => {
    try {
        const prompt = promptTemplates.searchRates(data, df);
        const response = await client.chat.completions.create({
        messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: JSON.stringify(data) }
        ],
        model: 'gpt-4o-mini',
        temperature: 0.0
        });

        let content = response.choices[0].message.content;
        content = content.replace(/```(json)?/gi, '').replace(/```/g, '').trim();

        console.log(content)

        let jsonResponse;
        try {
        jsonResponse = JSON.parse(content);
        } catch (e) {
        console.error('Error parsing JSON:', e);
        console.error('Response content:', content);
        return {};
        }

        console.log(jsonResponse)

        if (!jsonResponse || !jsonResponse.pol) {
        console.error('The returned JSON does not contain the expected "pol" property:', jsonResponse);
        return {};
        }
        return jsonResponse;
    } catch (error) {
        console.error(error);
    }
    };

export const openAiAsistance = async (conversation) => {
    try {
        // Genera un prompt de sistema usando el historial completo (puedes ajustar según tus necesidades)
        const systemPrompt = promptTemplates.expertAsistance(conversation);
        const response = await client.chat.completions.create({
        messages: [
            { role: 'system', content: systemPrompt },
            ...conversation
        ],
        model: 'gpt-4o-mini',
        temperature: 0.7
        });
    
        return response.choices[0].message.content;
    } catch (error) {
        console.error("Error in openAiAsistance:", error);
        return "Sorry, there was an error processing your request.";
    }
    };