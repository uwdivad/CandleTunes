import { googleLogout, useGoogleLogin } from "@react-oauth/google";
import { useEffect } from "react";

import { useGoogleAuth, useMe } from "../api/queries";
import { useAuthStore } from "../state/authStore";

/** Official multicolor Google "G", inlined so the button is styled entirely by
 *  our CSS (no white logo tile like Google's rendered button forces). */
function GoogleGIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function AuthButton() {
  const idToken = useAuthStore((s) => s.idToken);
  const user = useAuthStore((s) => s.user);
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);
  const clearSession = useAuthStore((s) => s.clearSession);

  // Once we hold a token but no profile yet, validate it with the backend and
  // load the verified user. A 401 here clears the session via the axios interceptor.
  const { data } = useMe(!!idToken && !user);
  const exchange = useGoogleAuth();

  useEffect(() => {
    if (data) setUser(data);
  }, [data, setUser]);

  // Auth-code popup flow: Google hands back a one-time code, which the backend
  // exchanges (with the client secret) for an ID token we store as before. This
  // lets us render our own button instead of Google's iframe-rendered one.
  const login = useGoogleLogin({
    flow: "auth-code",
    scope: "openid email profile",
    onSuccess: async ({ code }) => {
      try {
        const { id_token } = await exchange.mutateAsync(code);
        setToken(id_token);
      } catch {
        clearSession();
      }
    },
    onError: () => clearSession(),
  });

  const signOut = () => {
    googleLogout();
    clearSession();
  };

  if (idToken) {
    return (
      <div className="auth-bar">
        {user?.picture && (
          <img className="auth-avatar" src={user.picture} alt="" referrerPolicy="no-referrer" />
        )}
        <span className="auth-name">Hi, {user?.name ?? user?.email ?? "there"}</span>
        <button type="button" className="auth-signout" onClick={signOut}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="auth-bar">
      <button
        type="button"
        className="auth-signin"
        onClick={() => login()}
        disabled={exchange.isPending}
      >
        <GoogleGIcon />
        <span>{exchange.isPending ? "Signing in…" : "Sign in with Google"}</span>
      </button>
    </div>
  );
}
