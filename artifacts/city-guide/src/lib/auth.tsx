import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { UserProfile } from "@workspace/api-client-react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (user: UserProfile, token: string) => void;
  logout: () => void;
  updateUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    setAuthTokenGetter(() => state.accessToken);
  }, [state.accessToken]);

  const login = useCallback((user: UserProfile, token: string) => {
    setState({
      user,
      accessToken: token,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(() => {
    setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const updateUser = useCallback((user: UserProfile) => {
    setState((prev) => ({ ...prev, user }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
