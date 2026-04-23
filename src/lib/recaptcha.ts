export const RECAPTCHA_SITE_KEY = "6Ld9TcYsAAAAAMEDUiTck3OS4RKCJYCBs-fR69Kf";

/**
 * Returns true only when running on the production domain (theoia.com.br).
 * In Lovable preview, lovable.app subdomains and localhost it returns false,
 * so reCAPTCHA stays disabled while iterating.
 */
export function isRecaptchaEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "theoia.com.br" || host === "www.theoia.com.br";
}

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

/**
 * Generates a reCAPTCHA v3 token for the given action.
 * Returns null if reCAPTCHA isn't loaded — caller decides how strict to be.
 */
export function getRecaptchaToken(action: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.grecaptcha) {
      resolve(null);
      return;
    }
    try {
      window.grecaptcha.ready(() => {
        window
          .grecaptcha!.execute(RECAPTCHA_SITE_KEY, { action })
          .then((token) => resolve(token))
          .catch(() => resolve(null));
      });
    } catch {
      resolve(null);
    }
  });
}
