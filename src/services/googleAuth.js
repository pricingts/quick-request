import config from "../config/env.js";
import { google } from 'googleapis'; 

export const getAuthClient = async (scopes) => {
    const decoded = Buffer.from(config.GOOGLE_CREDENTIALS, 'base64').toString('utf-8');
    const credentials = JSON.parse(decoded);
    const auth = new google.auth.GoogleAuth({ credentials, scopes });
    return await auth.getClient();
};
