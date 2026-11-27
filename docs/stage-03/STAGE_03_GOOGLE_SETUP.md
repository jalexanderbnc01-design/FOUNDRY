# FOUNDRY — STAGE 3 GOOGLE WORKSPACE SETUP GUIDE

## Prerequisites
To enable live Google Workspace synchronization with Foundry, configure a Google Cloud Project with the required OAuth consent screen and APIs.

---

## Step 1: Configure Google Cloud Console
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your project (currently configured as `pics-4a87b` in `firebase-applet-config.json`).
3. Enable the following APIs:
   - Google Drive API
   - Google Docs API
   - Google Slides API
   - Google Sheets API
   - Google Calendar API
   - Tasks API
   - Google Forms API
   - Google Classroom API

---

## Step 2: Configure OAuth Consent Screen
1. Set User Type to **External** (or Internal for Google Workspace domains).
2. Add the following authorized OAuth scopes:
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/documents.readonly`
   - `https://www.googleapis.com/auth/documents`
   - `https://www.googleapis.com/auth/presentations.readonly`
   - `https://www.googleapis.com/auth/presentations`
   - `https://www.googleapis.com/auth/spreadsheets.readonly`
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/calendar.events.readonly`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/tasks.readonly`
   - `https://www.googleapis.com/auth/tasks`
   - `https://www.googleapis.com/auth/forms.body`
   - `https://www.googleapis.com/auth/forms.responses.readonly`
   - `https://www.googleapis.com/auth/classroom.courses.readonly`
   - `https://www.googleapis.com/auth/classroom.coursework.me.readonly`
   - `https://www.googleapis.com/auth/classroom.coursework.students.readonly`
3. Add the authorized redirect URI: `http://localhost:5175` and Firebase authentication handler.

---

## Step 3: Connect within Foundry
1. Open Foundry in the browser at `http://localhost:5175`.
2. Open **Settings** (gear icon in header or bottom toolbar) -> navigate to **Google Workspace**.
3. Click **Connect Google Account**.
4. In the Google popup, authorize the requested permissions.
5. All 8 service cards (Drive, Docs, Slides, Sheets, Calendar, Tasks, Forms, Classroom) will display verified connection statuses with authorized scope details.
