export const MANAGER_SETTINGS_STORAGE_KEY = "manager_workspace_settings";

export type ManagerWorkspaceSettings = {
  recognitionHighQuality: boolean;
};

const defaultManagerWorkspaceSettings: ManagerWorkspaceSettings = {
  recognitionHighQuality: false,
};

function safeGetItem(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors in private mode or restricted environments.
  }
}

function safeRemoveItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors in private mode or restricted environments.
  }
}

export function loadManagerWorkspaceSettings(): ManagerWorkspaceSettings {
  const raw = safeGetItem(MANAGER_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return defaultManagerWorkspaceSettings;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ManagerWorkspaceSettings>;
    return {
      recognitionHighQuality:
        parsed.recognitionHighQuality ?? defaultManagerWorkspaceSettings.recognitionHighQuality,
    };
  } catch {
    return defaultManagerWorkspaceSettings;
  }
}

export function saveManagerWorkspaceSettings(settings: ManagerWorkspaceSettings) {
  safeSetItem(MANAGER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function resetManagerWorkspaceSettings() {
  safeRemoveItem(MANAGER_SETTINGS_STORAGE_KEY);
}
