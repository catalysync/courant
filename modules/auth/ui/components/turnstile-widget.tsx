"use client";
import { useEffect, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void },
      ) => string;
      remove: (id: string) => void;
    };
  }
}

/**
 * Cloudflare Turnstile widget. Renders nothing unless a site key is configured,
 * so the auth form is unchanged in dev / before the key is set. When configured,
 * it loads the Turnstile script, renders the challenge, and reports the token.
 */
export const TurnstileWidget = ({ onToken }: { onToken: (t: string) => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;
    let id = "";
    const loadScript = () =>
      new Promise<void>((resolve) => {
        if (window.turnstile) return resolve();
        const s = document.createElement("script");
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        s.async = true;
        s.onload = () => resolve();
        document.head.appendChild(s);
      });
    loadScript().then(() => {
      if (ref.current && window.turnstile) {
        id = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          callback: (token) => onTokenRef.current(token),
        });
      }
    });
    return () => {
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={ref} className="flex justify-center" />;
};
