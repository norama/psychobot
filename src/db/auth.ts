import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "./supabase";

export function useAuth(callbackExpected = false) {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === "INITIAL_SESSION" && !nextSession && callbackExpected) {
        setError(t("auth.signInFailed"));
      }
      setSession(nextSession);
    });

    // Reuse the client's initialization promise; do not exchange the PKCE code
    // again. INITIAL_SESSION alone does not expose callback-processing errors.
    void db.auth.initialize().then(({ error: initializationError }) => {
      if (!active) return;
      if (initializationError) setError(t("auth.signInFailed"));
      setInitialized(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [callbackExpected, t]);

  async function signIn(redirectTo: string) {
    setBusy(true);
    setError("");
    try {
      const { error: signInError } = await db.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { prompt: "select_account" },
        },
      });
      if (signInError) throw signInError;
    } catch {
      setError(t("auth.signInFailed"));
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const { error: signOutError } = await db.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;
      return true;
    } catch {
      setError(t("auth.signOutFailed"));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { session, initialized, busy, error, signIn, signOut };
}
