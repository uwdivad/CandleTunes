import { GoogleLogin, googleLogout } from "@react-oauth/google";
import { useEffect } from "react";

import { useMe } from "../api/queries";
import { useAuthStore } from "../state/authStore";

export function AuthButton() {
  const idToken = useAuthStore((s) => s.idToken);
  const user = useAuthStore((s) => s.user);
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);
  const clearSession = useAuthStore((s) => s.clearSession);

  // Once we hold a token but no profile yet, validate it with the backend and
  // load the verified user. A 401 here clears the session via the axios interceptor.
  const { data } = useMe(!!idToken && !user);

  useEffect(() => {
    if (data) setUser(data);
  }, [data, setUser]);

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
      <GoogleLogin
        onSuccess={(res) => {
          if (res.credential) setToken(res.credential);
        }}
        onError={() => clearSession()}
        theme="filled_black"
        size="medium"
        shape="pill"
      />
    </div>
  );
}
