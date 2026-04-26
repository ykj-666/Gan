const LOCAL_AUTH_TOKEN_KEY = "local_auth_token";
const WECHAT_AUTH_TOKEN_KEY = "wechat_auth_token";

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
    // Ignore storage failures.
  }
}

function safeRemoveItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

export function getLocalAuthToken() {
  return safeGetItem(LOCAL_AUTH_TOKEN_KEY);
}

export function getWechatAuthToken() {
  return safeGetItem(WECHAT_AUTH_TOKEN_KEY);
}

export function setLocalAuthToken(token: string) {
  safeSetItem(LOCAL_AUTH_TOKEN_KEY, token);
  safeRemoveItem(WECHAT_AUTH_TOKEN_KEY);
}

export function setWechatAuthToken(token: string) {
  safeSetItem(WECHAT_AUTH_TOKEN_KEY, token);
  safeRemoveItem(LOCAL_AUTH_TOKEN_KEY);
}

export function clearAuthTokens() {
  safeRemoveItem(LOCAL_AUTH_TOKEN_KEY);
  safeRemoveItem(WECHAT_AUTH_TOKEN_KEY);
}
