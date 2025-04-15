import OpenAI from "openai";
import config from "../config/env.js";

const client = new OpenAI({
    apiKey: config.CHATGPT_API_KEY,
});

const promptTemplates = {
    extractData: (message) => `
    Extracts the following fields from this message: 
    POL (Port of Origin)
    POD (Port of Destination)
    Container Type
    Empty Pick-Up City (optional)
    Commodity

    Important Instructions:

    1. **Standardize POL and POD values**:
    If the extracted value corresponds to any of the following (or variations), return the standard value:

    - "Cartagena" → "CTG"
    - "Barranquilla" → "BAQ"
    - "Buenaventura" → "BUN"
    - "Sendai" → "SENDAI"
    - "Chennai Kattupalli" → "CHENNA (KATTUPALLI)"
    - "Nanhai" (or variations) → "NANHAI"


    Special logic for NINGBO:
    - If the user specifies **"Ningbo Beilun"** or similar → return "NINGBO (BEILUN)"
    - If the user specifies **"Ningbo Meishan"** or similar → return "NINGBO (MEISHAN)"
    - If the user only says **"Ningbo"** without a terminal → return "NINGBO"

    Other ports (return exactly as shown if detected):
    - "YOKOHAMA", "VERACRUZ", "SUAPE", "SAVANNAH", "SANTOS", "SANSHUI", "SANSHAN",
    "ROTTERDAM", "PORT QASIM", "PORT KLANG", "PORT EVERGLADES", "PIRAEUS", "PARANAGUA", "OITA",
    "NINGBO", "NHAVA SHEVA", "NEW ORLEANS", "NAGOYA", "MUNDRA", "MOJI", "LIANHUASHAN",
    "LAEM CHABANG", "KARACHI", "KAOHSIUNG", "ITAPOA", "INCHEON", "HOUSTON", "HAIPHONG",
    "GAOMING", "DAMAIYU", "CHARLESTON", "BUSAN", "BILBAO", "ANTWERP", "ALGECIRAS", "SUBIC BAY", 
    "CHENNAI", "KOBE", "HOUSTON"", "NANHAI", "SENDAI", "CALLAO"

    2. **Container Type**:
    - If the container is a 20-foot container, return "20' DRY"
    - If the container is a 40-foot container and it is of HC type, return "40' DRY HC"
    - Otherwise, if it is a 40-foot container, return "40' DRY"

    3. **Empty Pick-Up City**:
    For the empty pick up city, standardize the values as follows:
    - If empty pick up city is cartagena or similar, return CTG
    - If empty pick up city is barranquilla or similar, return BAQ
    - If empty pick up city is medellin or similar, return MED
    - If empty pick up city is cali or similar, return CALI
    - If empty pick up city is not specified, return TODOS

    4. For the commodity, standardize the values as follows:
    - If commodity is scrap or similar, return SCRAP METAL
    - If commodity is gelatina or similar, return GELATINA
    - If commodity is bebidas or similar, return BEBIDAS

    5. If any of the fields are not present in the message, leave them as an empty string (except empty_pickup, which defaults to "TODOS").

    Returns a diccionary with the following structure:

    {
    "pol": "...",
    "pod": "...",
    "empty_pickup": "..." if applies
    "commodity": "...",
    "type_container": "..."
    }

    Only return the diccionary with no more additional information.
    Now extract the data from this message:
    Message: ${message}

    `,

    searchRates: (data, df) => ` Using the following input data: ${JSON.stringify(data)}, search through this dataset: ${JSON.stringify(df)} to find the best matching freight offer.

    **Matching Criteria**:
    1. You must **strictly match** the following fields:
    - Port of Origin (pol)
    - Port of Destination (pod)
    - Container Type (type_container)

    2. **Empty Pick-Up City Logic**:
    - If the user **did not provide** an empty_pickup, ignore this field and consider all records.
    - If the user **did provide** an empty_pickup, only accept:
        - Exact matches in the dataset
        - Or records where the empty_pickup field is "TODOS"

    **Interpretation Rules**:
    - If any field (pol, pod, or type_container) in a row **does not exactly match** the interpreted user request, discard that row.
    - Do **not infer or guess** missing values. If there is any ambiguity, leave the result field empty.
    - For ports with known terminal variations (e.g. "NINGBO", "NINGBO (BEILUN)", "NINGBO (MEISHAN)"):
    - If the request is "NINGBO" → match all variants.
    - If the request is "NINGBO (BEILUN)" or similar → match only that variant.

    **Selection Rule**:
    - From the valid matches, return the entry with the **lowest value** in the column "TOTAL FLETE Y ORIGEN".

    **Important Note**:
    - When returning the result, the values in the output must match the ones from the dataset **exactly**.
    - For example, if the dataset value for "empty_pickup" is "TODOS", you must return "empty_pickup": "TODOS" even if the user requested "CTG".

    **Output Format**:
    Return the dictionary in the following structure, and only return the dictionary with no additional information. If any field is missing or unknown, leave its value as an empty string:

    {
        "pol": "....",
        "pod": "....",
        "cost": $...,
        "FDO": "",
        "FDD": "",
        "shipping_line": "",
        "validity": "",
        "type_container": "....",
        "empty_pickup": "...."
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