import { google, type sheets_v4 } from "googleapis";
import { INSURANCE_HEADER, LICENSE_HEADER } from "./rowMapper.js";

export class GoogleSheetsClient {
  private sheetsApi: sheets_v4.Sheets | undefined;

  constructor(
    private readonly serviceAccountFile: string,
    private readonly sheetId: string,
  ) {}

  private async getApi(): Promise<sheets_v4.Sheets> {
    if (this.sheetsApi) return this.sheetsApi;
    const auth = new google.auth.GoogleAuth({
      keyFile: this.serviceAccountFile,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    this.sheetsApi = google.sheets({ version: "v4", auth });
    return this.sheetsApi;
  }

  async ensureTabWithHeader(tabName: string, header: string[]): Promise<void> {
    const api = await this.getApi();
    const meta = await api.spreadsheets.get({ spreadsheetId: this.sheetId });
    const exists = meta.data.sheets?.some((s) => s.properties?.title === tabName);

    if (!exists) {
      await api.spreadsheets.batchUpdate({
        spreadsheetId: this.sheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
      });
    }

    const firstRow = await api.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: `${tabName}!A1:Z1`,
    });
    if (!firstRow.data.values || firstRow.data.values.length === 0) {
      await api.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: `${tabName}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [header] },
      });
    }
  }

  async appendRow(tabName: string, row: unknown[]): Promise<void> {
    const api = await this.getApi();
    await api.spreadsheets.values.append({
      spreadsheetId: this.sheetId,
      range: `${tabName}!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  }
}

export { INSURANCE_HEADER, LICENSE_HEADER };
