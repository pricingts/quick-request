import path from 'path';
import { google } from 'googleapis';

const sheets = google.sheets('v4');

async function addRowToSheet(auth, spreadsheetId, sheetName, values) {
    const request = {
        spreadsheetId,
        range: sheetName,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
            values: [values],
        },
        auth,
    }

    try {
        const response = (await sheets.spreadsheets.values.append(request).data);
        return response;
    } catch (error) {
        console.error(error)
    }
}

const appendRequestToSheet = async (data, typeRequest) => {
    try {

        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(process.cwd(), 'src/credentials', 'credentials.json'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const authClient = await auth.getClient();
        const spreadsheetId = '1uPmi_hyHGhThjO0XjlDkD1orQpuio-PgrZQ4AEKMsT4';

        let sheetName;
        switch (typeRequest) {
        case 'CompleteRequest':
            sheetName = 'CompleteRequest';
            break;
        case 'PendingRequest':
            sheetName = 'PendingRequest';
            break;
        default:
            sheetName = 'PendingRequest'; 
        }

        await addRowToSheet(authClient, spreadsheetId, sheetName, data);
        return 'Data Succesfully added'

    } catch (error) {
        console.error(error);
    }

}

const readGoogleSheet = async () => {
    try {
        const auth = new google.auth.GoogleAuth({
        keyFile: path.join(process.cwd(), 'src/credentials', 'credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
        });

        const authClient = await auth.getClient();
        const spreadsheetId = '1OAGkqTAUKK2KHDjowpPKa0gaDYXq7kGUiGRCvby7dVY';
        const sheets = google.sheets({ version: 'v4', auth: authClient });

        const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'TARIFAS SCRAP EXPO',
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
        console.log('No se encontraron datos.');
        return [];
        }

        const headers = rows[0];
        const data = rows.slice(1).map(row => {
        const rowData = {};
        headers.forEach((header, index) => {
            rowData[header] = row[index] || '';
        });
        return rowData;
        });

    return data;
    } catch (error) {
        console.error('Error al leer Google Sheets:', error);
        throw error;
    }
    };

const readQuotations = async () => {
    try {
        const auth = new google.auth.GoogleAuth({
        keyFile: path.join(process.cwd(), 'src/credentials', 'credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
        });
    
        const authClient = await auth.getClient();
        const spreadsheetId = '1y5AHcfgLuf26s8K9Fhh5geIow84ITDkST1I_TZjGnWs';
        const sheets = google.sheets({ version: 'v4', auth: authClient });
    
        const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'TEST',
        });
    
        const rows = response.data.values;
        if (!rows || rows.length === 0) {
        console.log('No se encontraron datos.');
        return [];
        }
    
        const ids = rows.slice(1).map(row => row[0] || '');
        return ids;

    } catch (error) {
        console.error('Error al leer Google Sheets:', error);
        throw error;
    }
    };

const sessionState = {
    generatedIds: new Set()
    };

async function generateRequestId() {
    const existingIds = await readQuotations();

    const newSequenceIds = existingIds
        .filter(id => typeof id === 'string' && id.startsWith('Q') && /^\d+$/.test(id.slice(1)))
        .map(id => parseInt(id.slice(1), 10));

    let nextId;
    if (newSequenceIds.length > 0) {
        nextId = Math.max(...newSequenceIds) + 1;
    } else {
        nextId = 1;
    }

    const uniqueId = `Q${nextId.toString().padStart(4, '0')}`;

    sessionState.generatedIds.add(uniqueId);

    return uniqueId;
    }

const appendRequestId = async (data) => {
    try {

        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(process.cwd(), 'src/credentials', 'credentials.json'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const authClient = await auth.getClient();
        const spreadsheetId = '1y5AHcfgLuf26s8K9Fhh5geIow84ITDkST1I_TZjGnWs';
        const sheetName = 'TEST'

        await addRowToSheet(authClient, spreadsheetId, sheetName, data);
        return 'Data Succesfully added'

    } catch (error) {
        console.error(error);
    }

}

export default { appendRequestToSheet, readGoogleSheet, generateRequestId, appendRequestId };