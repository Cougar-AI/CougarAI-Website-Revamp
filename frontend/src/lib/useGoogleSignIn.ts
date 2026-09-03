import { useEffect, useRef } from "react";

export type GoogleCredentialResponse = { credential?: string };

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>
          ) => void;
          cancel: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID ?? "";
const BUTTON_OPTIONS = {
  theme: "outline",
  size: "large",
  text: "continue_with",
  shape: "pill",
  width: "320",
} as const;

/**
 * Renders a Google Identity Services button into `buttonRef` and wires
 * it up to call `onCredential` with the latest closure every time.
 * Handles cleanup, SPA route changes, and iOS Safari bfcache restores.
 */
export function useGoogleSignIn(
  buttonRef: React.RefObject<HTMLDivElement | null>,
  onCredential: (response: GoogleCredentialResponse) => void,
  options?: { disabled?: boolean }
) {
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    if (options?.disabled || !GOOGLE_CLIENT_ID || !buttonRef.current) return;

    let cancelled = false;
    let appendedScript: HTMLScriptElement | null = null;

    const renderButton = () => {
      if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return;

      buttonRef.current.innerHTML = "";

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredentialRef.current(response),
      });

      window.google.accounts.id.renderButton(buttonRef.current, BUTTON_OPTIONS);
    };

    const cleanup = () => {
      cancelled = true;
      window.google?.accounts?.id?.cancel();
    };

    if (window.google?.accounts?.id) {
      renderButton();
      return cleanup;
    }

    const existingScript = document.querySelector(
      'script[data-google-identity="true"]'
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", renderButton, { once: true });
      return () => {
        existingScript.removeEventListener("load", renderButton);
        cleanup();
      };
    }

    appendedScript = document.createElement("script");
    appendedScript.src = "https://accounts.google.com/gsi/client";
    appendedScript.async = true;
    appendedScript.defer = true;
    appendedScript.dataset.googleIdentity = "true";
    appendedScript.addEventListener("load", renderButton, { once: true });
    document.head.appendChild(appendedScript);

    return () => {
      appendedScript?.removeEventListener("load", renderButton);
      cleanup();
    };
  }, [options?.disabled]);

  // Handles real browser back/forward (bfcache restore), separate from
  // the SPA route-change case handled above.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && window.google?.accounts?.id && buttonRef.current) {
        buttonRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(buttonRef.current, BUTTON_OPTIONS);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);
}

export { GOOGLE_CLIENT_ID };