import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
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

  // Setup the token getter for the API client
  useEffect(() => {
    setAuthTokenGetter(() => state.accessToken);
  }, [state.accessToken]);

  // Initial auth check happens in App.tsx using useGetProfile

  const login = (user: UserProfile, token: string) => {
    setState({
      user,
      accessToken: token,
      isAuthenticated: true,
      isLoading: false,
    });
  };

  const logout = () => {
    setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const updateUser = (user: UserProfile) => {
    setState((prev) => ({ ...prev, user }));
  };

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
