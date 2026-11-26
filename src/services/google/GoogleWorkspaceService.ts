/**
 * Foundry Stage 3 — Google Workspace Service (Phases 18–21)
 * Provides real Google Workspace API operations using the user's authorized
 * in-memory OAuth token. Does not fake or mock API responses.
 */
import { googleOAuthManager } from "./GoogleOAuthManager";

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
}

export class GoogleWorkspaceService {
  private getHeaders(): HeadersInit {
    const token = googleOAuthManager.getAccessToken();
    if (!token) {
      throw new Error("AUTH_REQUIRED: Google account is not connected or authorization expired.");
    }
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  // --- Google Drive ---
  public async searchDriveFiles(query = ""): Promise<{ ok: boolean; files: GoogleDriveFile[]; error?: string }> {
    try {
      const q = query ? `name contains '${query.replace(/'/g, "\\'")}' and trashed = false` : "trashed = false";
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink)&pageSize=25`;
      const resp = await fetch(url, { headers: this.getHeaders() });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Drive API error HTTP ${resp.status}`);
      }
      const data = await resp.json();
      return { ok: true, files: data.files || [] };
    } catch (e: any) {
      return { ok: false, files: [], error: e?.message || "Failed to search Google Drive." };
    }
  }

  public async getDriveFileMetadata(fileId: string): Promise<{ ok: boolean; file?: GoogleDriveFile; error?: string }> {
    try {
      const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,modifiedTime,webViewLink`;
      const resp = await fetch(url, { headers: this.getHeaders() });
      if (!resp.ok) throw new Error(`Drive API error HTTP ${resp.status}`);
      const file = await resp.json();
      return { ok: true, file };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Failed to read file metadata." };
    }
  }

  // --- Google Docs ---
  public async getDocContent(documentId: string): Promise<{ ok: boolean; title?: string; text?: string; error?: string }> {
    try {
      const url = `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`;
      const resp = await fetch(url, { headers: this.getHeaders() });
      if (!resp.ok) throw new Error(`Docs API error HTTP ${resp.status}`);
      const doc = await resp.json();

      let extractedText = "";
      if (Array.isArray(doc.body?.content)) {
        for (const elem of doc.body.content) {
          if (elem.paragraph?.elements) {
            for (const pe of elem.paragraph.elements) {
              if (pe.textRun?.content) {
                extractedText += pe.textRun.content;
              }
            }
          }
        }
      }

      return { ok: true, title: doc.title, text: extractedText };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Failed to read Google Doc." };
    }
  }

  public async createDoc(title: string, bodyText?: string): Promise<{ ok: boolean; documentId?: string; title?: string; error?: string }> {
    try {
      const url = "https://docs.googleapis.com/v1/documents";
      const resp = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ title }),
      });
      if (!resp.ok) throw new Error(`Docs API error HTTP ${resp.status}`);
      const doc = await resp.json();

      if (bodyText && doc.documentId) {
        await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify({
            requests: [
              {
                insertText: {
                  location: { index: 1 },
                  text: bodyText,
                },
              },
            ],
          }),
        }).catch(() => {});
      }

      return { ok: true, documentId: doc.documentId, title: doc.title };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Failed to create Google Doc." };
    }
  }

  // --- Google Slides ---
  public async getPresentation(presentationId: string): Promise<{ ok: boolean; title?: string; slideCount?: number; slidesText?: string[]; error?: string }> {
    try {
      const url = `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(presentationId)}`;
      const resp = await fetch(url, { headers: this.getHeaders() });
      if (!resp.ok) throw new Error(`Slides API error HTTP ${resp.status}`);
      const pres = await resp.json();

      const slidesText: string[] = [];
      if (Array.isArray(pres.slides)) {
        pres.slides.forEach((slide: any, idx: number) => {
          let sText = `Slide ${idx + 1}:`;
          if (Array.isArray(slide.pageElements)) {
            for (const pe of slide.pageElements) {
              if (pe.shape?.text?.textElements) {
                for (const te of pe.shape.text.textElements) {
                  if (te.textRun?.content) sText += " " + te.textRun.content.trim();
                }
              }
            }
          }
          slidesText.push(sText);
        });
      }

      return { ok: true, title: pres.title, slideCount: pres.slides?.length || 0, slidesText };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Failed to read Google Slides presentation." };
    }
  }

  public async createPresentation(title: string): Promise<{ ok: boolean; presentationId?: string; title?: string; error?: string }> {
    try {
      const url = "https://slides.googleapis.com/v1/presentations";
      const resp = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ title }),
      });
      if (!resp.ok) throw new Error(`Slides API error HTTP ${resp.status}`);
      const pres = await resp.json();
      return { ok: true, presentationId: pres.presentationId, title: pres.title };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Failed to create presentation." };
    }
  }

  // --- Google Sheets ---
  public async getSheetValues(spreadsheetId: string, range = "A1:Z50"): Promise<{ ok: boolean; values?: any[][]; error?: string }> {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
      const resp = await fetch(url, { headers: this.getHeaders() });
      if (!resp.ok) throw new Error(`Sheets API error HTTP ${resp.status}`);
      const data = await resp.json();
      return { ok: true, values: data.values || [] };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Failed to read Google Sheet." };
    }
  }

  public async createSpreadsheet(title: string): Promise<{ ok: boolean; spreadsheetId?: string; error?: string }> {
    try {
      const url = "https://sheets.googleapis.com/v4/spreadsheets";
      const resp = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ properties: { title } }),
      });
      if (!resp.ok) throw new Error(`Sheets API error HTTP ${resp.status}`);
      const data = await resp.json();
      return { ok: true, spreadsheetId: data.spreadsheetId };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Failed to create Google Sheet." };
    }
  }

  // --- Google Calendar ---
  public async listCalendarEvents(maxResults = 10): Promise<{ ok: boolean; events: any[]; error?: string }> {
    try {
      const timeMin = new Date().toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`;
      const resp = await fetch(url, { headers: this.getHeaders() });
      if (!resp.ok) throw new Error(`Calendar API error HTTP ${resp.status}`);
      const data = await resp.json();
      return { ok: true, events: data.items || [] };
    } catch (e: any) {
      return { ok: false, events: [], error: e?.message || "Failed to list calendar events." };
    }
  }

  public async createCalendarEvent(event: { summary: string; description?: string; startTime: string; endTime: string }): Promise<{ ok: boolean; eventId?: string; error?: string }> {
    try {
      const url = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
      const resp = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          start: { dateTime: event.startTime },
          end: { dateTime: event.endTime },
        }),
      });
      if (!resp.ok) throw new Error(`Calendar API error HTTP ${resp.status}`);
      const data = await resp.json();
      return { ok: true, eventId: data.id };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Failed to create calendar event." };
    }
  }

  // --- Google Tasks ---
  public async listTasks(): Promise<{ ok: boolean; tasks: any[]; error?: string }> {
    try {
      const url = "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=false";
      const resp = await fetch(url, { headers: this.getHeaders() });
      if (!resp.ok) throw new Error(`Tasks API error HTTP ${resp.status}`);
      const data = await resp.json();
      return { ok: true, tasks: data.items || [] };
    } catch (e: any) {
      return { ok: false, tasks: [], error: e?.message || "Failed to list tasks." };
    }
  }

  public async createTask(title: string, notes?: string, due?: string): Promise<{ ok: boolean; taskId?: string; error?: string }> {
    try {
      const url = "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks";
      const resp = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ title, notes, due }),
      });
      if (!resp.ok) throw new Error(`Tasks API error HTTP ${resp.status}`);
      const data = await resp.json();
      return { ok: true, taskId: data.id };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Failed to create task." };
    }
  }

  // --- Google Forms ---
  public async createForm(title: string): Promise<{ ok: boolean; formId?: string; responderUri?: string; error?: string }> {
    try {
      const url = "https://forms.googleapis.com/v1/forms";
      const resp = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ info: { title, documentTitle: title } }),
      });
      if (!resp.ok) throw new Error(`Forms API error HTTP ${resp.status}`);
      const data = await resp.json();
      return { ok: true, formId: data.formId, responderUri: data.responderUri };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Failed to create Google Form." };
    }
  }

  // --- Google Classroom ---
  public async listClassroomCourses(): Promise<{ ok: boolean; courses: any[]; error?: string }> {
    try {
      const url = "https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE";
      const resp = await fetch(url, { headers: this.getHeaders() });
      if (!resp.ok) throw new Error(`Classroom API error HTTP ${resp.status}`);
      const data = await resp.json();
      return { ok: true, courses: data.courses || [] };
    } catch (e: any) {
      return { ok: false, courses: [], error: e?.message || "Failed to list Classroom courses." };
    }
  }
}

export const googleWorkspaceService = new GoogleWorkspaceService();
