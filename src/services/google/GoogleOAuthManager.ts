/**
 * Foundry Stage 3 — Centralized Google OAuth Manager (Phase 17)
 * Implements client-side Google OAuth 2.0 via Firebase Auth with GoogleAuthProvider.
 * STRICT SECURITY: Access tokens are stored exclusively in-memory (never in localStorage/sessionStorage).
 */
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import firebaseConfig from "../../../firebase-applet-config.json";

export interface GoogleServiceAuthorization {
  id: string;
  name: string;
  description: string;
  scopes: string[];
  authorized: boolean;
}

export interface GoogleAccountState {
  connected: boolean;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  scopes: string[];
  tokenExpiresAt: number | null;
  tokenExpired: boolean;
}

export const WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/presentations.readonly",
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/tasks.readonly",
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/forms.body",
  "https://www.googleapis.com/auth/forms.responses.readonly",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
];

export const WORKSPACE_SERVICES: Record<string, { name: string; description: string; requiredScopes: string[] }> = {
  drive: {
    name: "Google Drive",
    description: "Browse, select, and import authorized files into Knowledge Base.",
    requiredScopes: ["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/drive.file"],
  },
  docs: {
    name: "Google Docs",
    description: "Read study materials and create structured notes or study guides.",
    requiredScopes: ["https://www.googleapis.com/auth/documents.readonly", "https://www.googleapis.com/auth/documents"],
  },
  slides: {
    name: "Google Slides",
    description: "Read presentations and export generated slides from Essay to Slides.",
    requiredScopes: ["https://www.googleapis.com/auth/presentations.readonly", "https://www.googleapis.com/auth/presentations"],
  },
  sheets: {
    name: "Google Sheets",
    description: "Read survey responses, study metrics, and structured tabular data.",
    requiredScopes: ["https://www.googleapis.com/auth/spreadsheets.readonly", "https://www.googleapis.com/auth/spreadsheets"],
  },
  calendar: {
    name: "Google Calendar",
    description: "Sync course deadlines, study blocks, and milestone schedules.",
    requiredScopes: ["https://www.googleapis.com/auth/calendar.events.readonly", "https://www.googleapis.com/auth/calendar.events"],
  },
  tasks: {
    name: "Google Tasks",
    description: "Manage academic tasks and sync with Countdown.",
    requiredScopes: ["https://www.googleapis.com/auth/tasks.readonly", "https://www.googleapis.com/auth/tasks"],
  },
  forms: {
    name: "Google Forms",
    description: "Create Choice Board student preference surveys and review responses.",
    requiredScopes: ["https://www.googleapis.com/auth/forms.body", "https://www.googleapis.com/auth/forms.responses.readonly"],
  },
  classroom: {
    name: "Google Classroom",
    description: "Associate Foundry courses with Google Classroom coursework and deadlines.",
    requiredScopes: [
      "https://www.googleapis.com/auth/classroom.courses.readonly",
      "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
      "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
    ],
  },
};

export class GoogleOAuthManager {
  private app: any = null;
  private auth: any = null;
  // STRICT IN-MEMORY TOKEN CACHE: Never stored in localStorage
  private inMemoryAccessToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private authorizedScopes: Set<string> = new Set();
  private currentUser: User | null = null;
  private listeners: Set<(state: GoogleAccountState) => void> = new Set();

  constructor() {
    this.initFirebase();
  }

  private initFirebase() {
    try {
      this.app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      this.auth = getAuth(this.app);

      onAuthStateChanged(this.auth, (user) => {
        this.currentUser = user;
        if (!user) {
          // Immediately wipe in-memory credentials on sign out
          this.inMemoryAccessToken = null;
          this.tokenExpiresAt = null;
          this.authorizedScopes.clear();
        }
        this.notify();
      });
    } catch (err) {
      console.warn("[GoogleOAuthManager] Firebase initialization error:", err);
    }
  }

  public subscribe(cb: (state: GoogleAccountState) => void): () => void {
    this.listeners.add(cb);
    cb(this.getState());
    return () => this.listeners.delete(cb);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((cb) => {
      try {
        cb(state);
      } catch {}
    });
  }

  public getState(): GoogleAccountState {
    const isExpired = this.tokenExpiresAt !== null && Date.now() > this.tokenExpiresAt;
    return {
      connected: Boolean(this.currentUser && this.inMemoryAccessToken && !isExpired),
      email: this.currentUser?.email || null,
      displayName: this.currentUser?.displayName || null,
      photoUrl: this.currentUser?.photoURL || null,
      scopes: Array.from(this.authorizedScopes),
      tokenExpiresAt: this.tokenExpiresAt,
      tokenExpired: isExpired,
    };
  }

  /**
   * Get the verified in-memory access token (or null if unauthenticated or expired)
   */
  public getAccessToken(): string | null {
    if (this.tokenExpiresAt !== null && Date.now() > this.tokenExpiresAt) {
      return null;
    }
    return this.inMemoryAccessToken;
  }

  /**
   * Sign in with Google using popup and request authorized Workspace scopes
   */
  public async signIn(): Promise<{ ok: boolean; state: GoogleAccountState; error?: string }> {
    if (!this.auth) {
      return { ok: false, state: this.getState(), error: "Firebase Auth is not initialized" };
    }

    try {
      const provider = new GoogleAuthProvider();
      // Add all authorized Workspace scopes
      for (const scope of WORKSPACE_SCOPES) {
        provider.addScope(scope);
      }
      provider.setCustomParameters({
        prompt: "select_account",
        access_type: "offline",
      });

      const result = await signInWithPopup(this.auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      if (credential?.accessToken) {
        // Cache token in memory for 1 hour (Google OAuth default)
        this.inMemoryAccessToken = credential.accessToken;
        this.tokenExpiresAt = Date.now() + 3500 * 1000;
        this.authorizedScopes = new Set(WORKSPACE_SCOPES);
      }

      this.currentUser = result.user;
      this.notify();

      return { ok: true, state: this.getState() };
    } catch (e: any) {
      console.error("[GoogleOAuthManager] Sign in failed:", e);
      return {
        ok: false,
        state: this.getState(),
        error: e?.message || "Google authentication was cancelled or failed.",
      };
    }
  }

  /**
   * Disconnect and clear in-memory token cache
   */
  public async signOut(): Promise<void> {
    try {
      if (this.auth) {
        await firebaseSignOut(this.auth);
      }
    } catch {}
    this.inMemoryAccessToken = null;
    this.tokenExpiresAt = null;
    this.authorizedScopes.clear();
    this.currentUser = null;
    this.notify();
  }

  /**
   * Inspect service authorization status
   */
  public getServiceAuthorizations(): GoogleServiceAuthorization[] {
    const hasToken = Boolean(this.getAccessToken());
    return Object.entries(WORKSPACE_SERVICES).map(([id, meta]) => {
      const isAuth = hasToken && meta.requiredScopes.every((s) => this.authorizedScopes.has(s));
      return {
        id,
        name: meta.name,
        description: meta.description,
        scopes: meta.requiredScopes,
        authorized: isAuth,
      };
    });
  }

  public isServiceAuthorized(serviceId: string): boolean {
    const meta = WORKSPACE_SERVICES[serviceId];
    if (!meta) return false;
    const hasToken = Boolean(this.getAccessToken());
    return hasToken && meta.requiredScopes.every((s) => this.authorizedScopes.has(s));
  }
}

export const googleOAuthManager = new GoogleOAuthManager();
