"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { mockAddressFromEmail } from "@/lib/utils";

export type AuthStatus =
  | "signed-out"
  | "sending-code"
  | "awaiting-code"
  | "verifying"
  | "signed-in";

export interface UserAccount {
  email: string;
  walletAddress: string;
  balanceUSD: number;
  tickets: number;
  consecutiveCycles: number;
  historicalCycles: number;
  joinedAt: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: UserAccount | null;
  error: string | null;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (code: string) => Promise<void>;
  signOut: () => void;
  deposit: (amountUSD: number) => void;
  withdraw: (amountUSD: number) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "n0loss_beta_session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("signed-out");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [user, setUser] = useState<UserAccount | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Persist the mocked session across reloads for a smoother beta demo.
  useEffect(() => {
    const raw =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem(STORAGE_KEY)
        : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUser(parsed);
        setStatus("signed-in");
      } catch {
        // ignore corrupted session
      }
    }
  }, []);

  const persist = (u: UserAccount | null) => {
    if (typeof window === "undefined") return;
    if (u) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  };

  // MOCK: in production this calls the AA provider (thirdweb/Privy) which
  // emails a real one-time code and, on verification, silently deploys or
  // resolves the user's ERC-4337 smart wallet.
  const sendCode = useCallback(async (email: string) => {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Introduce un email válido.");
      return;
    }
    setStatus("sending-code");
    setPendingEmail(email);
    await new Promise((r) => setTimeout(r, 700));
    setStatus("awaiting-code");
  }, []);

  const verifyCode = useCallback(
    async (code: string) => {
      if (!pendingEmail) return;
      setError(null);
      if (code.length !== 6) {
        setError("El código tiene 6 dígitos.");
        return;
      }
      setStatus("verifying");
      await new Promise((r) => setTimeout(r, 900));
      // MOCK "beta funds": every new account starts funded on the Polygon
      // fork so testers can try deposits/draws without a faucet.
      const newUser: UserAccount = {
        email: pendingEmail,
        walletAddress: mockAddressFromEmail(pendingEmail),
        balanceUSD: 250,
        tickets: 25,
        consecutiveCycles: 1,
        historicalCycles: 1,
        joinedAt: new Date().toISOString(),
      };
      setUser(newUser);
      persist(newUser);
      setStatus("signed-in");
    },
    [pendingEmail]
  );

  const signOut = useCallback(() => {
    setUser(null);
    setPendingEmail(null);
    setStatus("signed-out");
    persist(null);
  }, []);

  const deposit = useCallback((amountUSD: number) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        balanceUSD: prev.balanceUSD + amountUSD,
        tickets: prev.tickets + Math.floor(amountUSD / 10),
      };
      persist(next);
      return next;
    });
  }, []);

  const withdraw = useCallback((amountUSD: number) => {
    setUser((prev) => {
      if (!prev) return prev;
      const clamped = Math.min(amountUSD, prev.balanceUSD);
      const next = {
        ...prev,
        balanceUSD: prev.balanceUSD - clamped,
        tickets: Math.max(0, prev.tickets - Math.floor(clamped / 10)),
      };
      persist(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      error,
      sendCode,
      verifyCode,
      signOut,
      deposit,
      withdraw,
    }),
    [status, user, error, sendCode, verifyCode, signOut, deposit, withdraw]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
