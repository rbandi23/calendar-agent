import { google } from "googleapis";

/**
 * Create an OAuth2 client pre-authenticated with the given access token.
 * This is used internally by the service functions.
 */
export function getGoogleClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: accessToken });
  return oauth2Client;
}

/** Google Calendar v3 client */
export function getCalendarClient(accessToken: string) {
  const auth = getGoogleClient(accessToken);
  return google.calendar({ version: "v3", auth });
}

/** Gmail v1 client */
export function getGmailClient(accessToken: string) {
  const auth = getGoogleClient(accessToken);
  return google.gmail({ version: "v1", auth });
}

/** Google People API v1 client */
export function getPeopleClient(accessToken: string) {
  const auth = getGoogleClient(accessToken);
  return google.people({ version: "v1", auth });
}
