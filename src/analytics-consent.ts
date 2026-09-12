export const ANALYTICS_CONSENT_KEY = 'london-animal-rescue:analytics-consent:v1';
export const CONSENT_MAX_AGE = 365 * 24 * 60 * 60 * 1000;
export interface AnalyticsConsent {
  version: 1;
  allowed: boolean;
  savedAt: number;
}

export function readAnalyticsConsent(
  storage: Pick<Storage, 'getItem'>,
  now = Date.now(),
): AnalyticsConsent | null {
  try {
    const value = JSON.parse(
      storage.getItem(ANALYTICS_CONSENT_KEY) ?? 'null',
    ) as Partial<AnalyticsConsent> | null;
    if (
      !value ||
      value.version !== 1 ||
      typeof value.allowed !== 'boolean' ||
      typeof value.savedAt !== 'number' ||
      !Number.isFinite(value.savedAt) ||
      value.savedAt > now ||
      now - value.savedAt >= CONSENT_MAX_AGE
    )
      return null;
    return { version: 1, allowed: value.allowed, savedAt: value.savedAt };
  } catch {
    return null;
  }
}

export function saveAnalyticsConsent(
  storage: Pick<Storage, 'setItem'>,
  consent: AnalyticsConsent,
): boolean {
  try {
    storage.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify(consent));
    return true;
  } catch {
    return false;
  }
}
