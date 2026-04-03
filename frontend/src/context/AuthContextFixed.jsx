import { createContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { auth, provider } from "../services/firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";

/* eslint-disable react-refresh/only-export-components */
export const AuthContext = createContext();

function normalizeUser(user, token) {
  return {
    id: user?.id,
    email: user?.email,
    name: user?.name || user?.displayName || user?.username || user?.email?.split("@")[0] || "User",
    username: user?.username || user?.name || user?.email?.split("@")[0] || "user",
    picture: user?.picture || "",
    provider: user?.provider || "google",
    token,
  };
}

function googleErrorMessage(error) {
  const apiMessage = error?.response?.data?.detail;
  if (apiMessage) return apiMessage;

  switch (error?.code) {
    case "auth/popup-closed-by-user":
      return "Google sign-in was closed before completion.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in popup. Please allow popups and try again.";
    case "auth/cancelled-popup-request":
      return "Google sign-in is already in progress.";
    default:
      return "Google sign-in failed. Please try again.";
  }
}

export default function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const persistAuth = (payload) => {
    const nextUser = normalizeUser(payload?.user || {}, payload?.access_token || "");
    localStorage.setItem("user", JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  };

  const clearSession = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  const exchangeGoogleSession = async (firebaseUser) => {
    const idToken = await firebaseUser.getIdToken();
    const response = await api.post("/auth/google", { idToken });
    return response.data;
  };

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return;
      setLoading(true);

      try {
        const stored = localStorage.getItem("user");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.token) {
            const response = await api.get("/auth/me");
            if (cancelled) return;
            const nextUser = normalizeUser(response.data?.user || parsed, parsed.token);
            localStorage.setItem("user", JSON.stringify(nextUser));
            setUser(nextUser);
            return;
          }
        }

        if (firebaseUser) {
          const payload = await exchangeGoogleSession(firebaseUser);
          if (!cancelled) {
            persistAuth(payload);
          }
          return;
        }

        if (!cancelled) {
          clearSession();
        }
      } catch {
        if (!cancelled) {
          clearSession();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const loginWithEmail = async () => {
    const requestError = new Error("Email and password sign-in has been removed. Please continue with Google.");
    setError(requestError.message);
    throw requestError;
  };

  const registerWithEmail = async () => {
    const requestError = new Error("Account creation has been removed. Please continue with Google.");
    setError(requestError.message);
    throw requestError;
  };

  const googleLogin = async ({ redirectTo = "/dashboard" } = {}) => {
    setLoading(true);
    try {
      setError("");
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const payload = await exchangeGoogleSession(result.user);
      persistAuth(payload);
      if (redirectTo) {
        navigate(redirectTo, { replace: true });
      }
      return payload;
    } catch (requestError) {
      const message = googleErrorMessage(requestError);
      setError(message);
      throw requestError;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } finally {
      clearSession();
      setError("");
      setLoading(false);
      navigate("/", { replace: true });
    }
  };

  const clearError = () => setError("");

  return (
    <AuthContext.Provider
      value={{
        user,
        googleLogin,
        loginWithEmail,
        registerWithEmail,
        logout,
        loading,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
