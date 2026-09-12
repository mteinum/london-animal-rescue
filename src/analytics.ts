import './analytics.css';
import {
  ANALYTICS_CONSENT_KEY,
  readAnalyticsConsent,
  saveAnalyticsConsent,
  type AnalyticsConsent,
} from './analytics-consent';
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

// Public GA4 measurement ID, shared with teinum.no. This is not an API secret.
export const GA_MEASUREMENT_ID = 'G-FC34S4J2L2';
type GoogleWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  [key: `ga-disable-${string}`]: boolean | undefined;
};

/** Standalone-page analytics; embedding mount does not install it. */
export function mountAnalytics(host: HTMLElement): () => void {
  const root = host;
  const settings = root.querySelector<HTMLButtonElement>('[data-analytics-settings]')!;
  const google = window as unknown as GoogleWindow;
  const disabledKey = `ga-disable-${GA_MEASUREMENT_ID}` as const;
  const abort = new AbortController();
  const cookiePath = new URL(import.meta.env.BASE_URL, document.baseURI).pathname;
  let record: AnalyticsConsent | null = null;
  let script: HTMLScriptElement | null = null;
  let configured = false;
  let pageViewSent = false;
  let disposed = false;

  google.dataLayer ??= [];
  google.gtag ??= function () {
    google.dataLayer!.push(arguments);
  };
  const gtag = google.gtag;
  const consentState = (allowed: boolean) => ({
    analytics_storage: allowed ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  google[disabledKey] = true;
  gtag('consent', 'default', consentState(false));

  const panel = element('section', 'analytics-consent');
  panel.setAttribute('aria-label', 'Analytics preferences');
  panel.innerHTML = `<div class="analytics-copy"><h2 tabindex="-1">Optional analytics</h2><p>Allow Google Analytics to help Morten understand how this site is used? It loads only if you agree.</p><p class="analytics-note">Your notebook works either way. Change your choice anytime in Privacy settings. <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a></p></div><div class="analytics-actions"><button type="button" class="analytics-deny" data-analytics="deny">Necessary only</button><button type="button" class="analytics-allow" data-analytics="allow">Allow analytics</button></div><button type="button" class="analytics-close" aria-label="Close privacy settings">×</button>`;
  root.append(panel);
  const status = element('p', 'analytics-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  settings.after(status);
  settings.hidden = false;
  settings.setAttribute('aria-expanded', 'false');

  function showPanel() {
    panel.hidden = false;
    settings.setAttribute('aria-expanded', 'true');
  }
  function hidePanel() {
    const restoreFocus = panel.contains(document.activeElement);
    panel.hidden = true;
    settings.setAttribute('aria-expanded', 'false');
    if (restoreFocus) {
      const target = settings.getClientRects().length
        ? settings
        : root.querySelector<HTMLElement>('#open-filters');
      target?.focus({ preventScroll: true });
    }
  }
  function removeAnalyticsCookies() {
    // This app uses its own prefix and host/path scope, leaving other sites alone.
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.trim().split('=')[0];
      if (!/^lar_ga(?:_|$)/.test(name)) continue;
      for (const path of new Set([cookiePath, '/'])) {
        document.cookie = `${name}=; Max-Age=0; Path=${path}; SameSite=Lax`;
        document.cookie = `${name}=; Max-Age=0; Path=${path}; Domain=${location.hostname}; SameSite=Lax`;
      }
    }
  }
  function apply() {
    const allowed = record?.allowed === true && !disposed;
    google[disabledKey] = !allowed;
    gtag('consent', 'update', consentState(allowed));
    status.textContent = allowed ? 'Analytics allowed.' : 'Analytics off.';
    if (!allowed) {
      removeAnalyticsCookies();
      return;
    }
    let referrer = '';
    try {
      const url = new URL(document.referrer);
      referrer = url.origin + url.pathname;
    } catch {
      /* Direct visit. */
    }
    if (!configured) {
      configured = true;
      gtag('js', new Date());
      gtag('config', GA_MEASUREMENT_ID, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        cookie_prefix: 'lar',
        cookie_domain: location.hostname,
        cookie_path: cookiePath,
        page_referrer: referrer,
        page_location: location.origin + location.pathname,
      });
    }
    if (!pageViewSent) {
      pageViewSent = true;
      gtag('event', 'page_view', {
        send_to: GA_MEASUREMENT_ID,
        page_title: document.title,
        page_location: location.origin + location.pathname,
        page_referrer: referrer,
      });
    }
    if (!script) {
      script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      script.addEventListener(
        'error',
        () => {
          if (record?.allowed && !disposed)
            status.textContent = 'Analytics could not load. The explorer still works normally.';
        },
        { signal: abort.signal },
      );
      document.head.append(script);
    }
  }
  function choose(allowed: boolean) {
    record = { version: 1, allowed, savedAt: Date.now() };
    let saved = false;
    try {
      saved = saveAnalyticsConsent(localStorage, record);
    } catch {
      /* Visit-only choice. */
    }
    apply();
    if (!saved) status.textContent += ' Your choice lasts for this visit only.';
    hidePanel();
  }
  settings.addEventListener(
    'click',
    () => {
      showPanel();
      panel.querySelector<HTMLElement>('h2')!.focus({ preventScroll: true });
    },
    { signal: abort.signal },
  );
  panel.addEventListener(
    'click',
    (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button');
      if (button?.dataset.analytics) choose(button.dataset.analytics === 'allow');
      else if (button?.classList.contains('analytics-close')) hidePanel();
    },
    { signal: abort.signal },
  );
  panel.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        hidePanel();
      }
    },
    { signal: abort.signal },
  );
  window.addEventListener(
    'storage',
    (event) => {
      if (event.key !== null && event.key !== ANALYTICS_CONSENT_KEY) return;
      try {
        record = readAnalyticsConsent(localStorage);
      } catch {
        record = null;
      }
      apply();
      if (record) hidePanel();
      else showPanel();
    },
    { signal: abort.signal },
  );
  try {
    record = readAnalyticsConsent(localStorage);
  } catch {
    /* Start with analytics off. */
  }
  apply();
  if (record) hidePanel();
  else showPanel();

  return () => {
    disposed = true;
    google[disabledKey] = true;
    gtag('consent', 'update', consentState(false));
    abort.abort();
    script?.remove();
    panel.remove();
    status.remove();
    settings.hidden = true;
    settings.removeAttribute('aria-expanded');
  };
}
