"use client";

const STAFF_TOKEN_KEY = "ayub_staff_token_v1";
const CUSTOMER_TOKEN_KEY = "ayub_customer_token_v1";

let memoryStaffToken: string | null = null;
let memoryCustomerToken: string | null = null;

export function getStoredStaffToken(): string | null {
  if (memoryStaffToken) return memoryStaffToken;
  if (typeof window === "undefined") return null;

  try {
    const urlTok = new URLSearchParams(window.location.search).get("_st");
    if (urlTok) {
      memoryStaffToken = urlTok;
      return urlTok;
    }
  } catch {
    // Ignore
  }

  try {
    const sVal = window.sessionStorage.getItem(STAFF_TOKEN_KEY);
    if (sVal) {
      memoryStaffToken = sVal;
      return sVal;
    }
  } catch {
    // Ignore
  }

  try {
    const lVal = window.localStorage.getItem(STAFF_TOKEN_KEY);
    if (lVal) {
      memoryStaffToken = lVal;
      return lVal;
    }
  } catch {
    // Ignore
  }

  return memoryStaffToken;
}

export function setStoredStaffToken(token: string | null | undefined): void {
  const validToken = typeof token === "string" && token ? token : null;
  memoryStaffToken = validToken;
  if (typeof window === "undefined") return;
  try {
    if (validToken) {
      window.sessionStorage.setItem(STAFF_TOKEN_KEY, validToken);
    } else {
      window.sessionStorage.removeItem(STAFF_TOKEN_KEY);
    }
  } catch {
    // Ignore
  }
  try {
    if (validToken) {
      window.localStorage.setItem(STAFF_TOKEN_KEY, validToken);
    } else {
      window.localStorage.removeItem(STAFF_TOKEN_KEY);
    }
  } catch {
    // Ignore
  }
}

export function clearStoredStaffToken(): void {
  setStoredStaffToken(null);
}

export function getStoredCustomerToken(): string | null {
  if (memoryCustomerToken) return memoryCustomerToken;
  if (typeof window === "undefined") return null;

  try {
    const urlTok = new URLSearchParams(window.location.search).get("_ct");
    if (urlTok) {
      memoryCustomerToken = urlTok;
      return urlTok;
    }
  } catch {
    // Ignore
  }

  try {
    const sVal = window.sessionStorage.getItem(CUSTOMER_TOKEN_KEY);
    if (sVal) {
      memoryCustomerToken = sVal;
      return sVal;
    }
  } catch {
    // Ignore
  }

  try {
    const lVal = window.localStorage.getItem(CUSTOMER_TOKEN_KEY);
    if (lVal) {
      memoryCustomerToken = lVal;
      return lVal;
    }
  } catch {
    // Ignore
  }

  return memoryCustomerToken;
}

export function setStoredCustomerToken(token: string | null | undefined): void {
  const validToken = typeof token === "string" && token ? token : null;
  memoryCustomerToken = validToken;
  if (typeof window === "undefined") return;
  try {
    if (validToken) {
      window.sessionStorage.setItem(CUSTOMER_TOKEN_KEY, validToken);
    } else {
      window.sessionStorage.removeItem(CUSTOMER_TOKEN_KEY);
    }
  } catch {
    // Ignore
  }
  try {
    if (validToken) {
      window.localStorage.setItem(CUSTOMER_TOKEN_KEY, validToken);
    } else {
      window.localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    }
  } catch {
    // Ignore
  }
}

export function clearStoredCustomerToken(): void {
  setStoredCustomerToken(null);
}

function appendQueryToken(url: string, paramName: string, token: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${paramName}=${encodeURIComponent(token)}`;
}

async function fetchWithSafeTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 20000
): Promise<Response> {
  if (init.signal || typeof AbortController === "undefined") {
    return fetch(url, init);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function staffFetch(
  input: string,
  init: RequestInit = {},
  explicitToken?: string | null
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const safeExplicit =
    typeof explicitToken === "string" && explicitToken ? explicitToken : null;
  const token = safeExplicit || getStoredStaffToken();
  let finalUrl = input;

  if (token) {
    headers.set("x-ayub-staff-token", token);
    finalUrl = appendQueryToken(input, "_st", token);
  }

  return fetchWithSafeTimeout(finalUrl, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
}

export async function customerFetch(
  input: string,
  init: RequestInit = {},
  explicitToken?: string | null
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const safeExplicit =
    typeof explicitToken === "string" && explicitToken ? explicitToken : null;
  const token = safeExplicit || getStoredCustomerToken();
  let finalUrl = input;

  if (token) {
    headers.set("x-ayub-customer-token", token);
    finalUrl = appendQueryToken(input, "_ct", token);
  }

  return fetchWithSafeTimeout(finalUrl, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
}
