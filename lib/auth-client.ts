"use client";

import { createAuthClient } from "better-auth/react";

// No explicit `baseURL`: Better Auth then resolves it to the *current* origin
// (`window.location.origin` + /api/auth) in the browser, so sign-in / session
// calls are always same-origin. This works whether the app is served from the
// custom domain (courant.nagara.cloud) or the workers.dev subdomain. Pinning
// `baseURL` to `NEXT_PUBLIC_APP_URL` (an absolute custom-domain URL) broke
// sign-in when the page was served from workers.dev (cross-origin fetch →
// CORS preflight failure).
export const authClient = createAuthClient({});

export const { signIn, signUp, signOut, useSession } = authClient;