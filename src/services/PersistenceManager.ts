/**
 * Foundry Persistence Manager for centralized local storage, layout validation,
 * and runtime storage verification (Phase 1.4 & 3.8).
 */

export const STORAGE_KEYS = {
  SETTINGS: "foundry_settings",
  WINDOW_LAYOUT: "foundry-window-layout-v1",
  PERMISSIONS: "foundry-permissions-v1",
  CONTROLLER_RECT: "slate-whiteboard-controller-v1",
  MIDDLE_DIVIDER: "slate-education-middle-split-v1",
  DARK_MODE: "whiteboard_dark_mode",
} as const;

export interface StorageVerificationResult {
  available: boolean;
  writable: boolean;
  keyCount: number;
  verifiedAt: number;
  error?: string;
}

class PersistenceManagerService {
  private lastVerification: StorageVerificationResult | null = null;

  verifyStorage(): StorageVerificationResult {
    const probeKey = "__foundry_storage_probe__";
    const probeVal = String(Date.now());
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        const res: StorageVerificationResult = {
          available: false,
          writable: false,
          keyCount: 0,
          verifiedAt: Date.now(),
          error: "localStorage is not available in this environment",
        };
        this.lastVerification = res;
        return res;
      }
      window.localStorage.setItem(probeKey, probeVal);
      const readBack = window.localStorage.getItem(probeKey);
      window.localStorage.removeItem(probeKey);
      const writable = readBack === probeVal;
      const res: StorageVerificationResult = {
        available: true,
        writable,
        keyCount: window.localStorage.length,
        verifiedAt: Date.now(),
        error: writable ? undefined : "Storage roundtrip readback mismatch",
      };
      this.lastVerification = res;
      return res;
    } catch (err: any) {
      const res: StorageVerificationResult = {
        available: false,
        writable: false,
        keyCount: 0,
        verifiedAt: Date.now(),
        error: err?.message || "Storage access denied or quota exceeded",
      };
      this.lastVerification = res;
      return res;
    }
  }

  getLastVerification(): StorageVerificationResult | null {
    return this.lastVerification;
  }

  getJson<T>(key: string, validate?: (value: unknown) => value is T): T | null {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (validate && !validate(parsed)) {
        return null;
      }
      return parsed as T;
    } catch {
      return null;
    }
  }

  setJson<T>(key: string, value: T): boolean {
    try {
      if (typeof window === "undefined" || !window.localStorage) return false;
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  remove(key: string): boolean {
    try {
      if (typeof window === "undefined" || !window.localStorage) return false;
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
}

export const persistenceManager = new PersistenceManagerService();
