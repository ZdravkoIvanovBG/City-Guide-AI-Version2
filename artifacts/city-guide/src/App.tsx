import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useRefreshToken } from "@workspace/api-client-react";
import { useEffect, useRef } from "react";
import { CustomCursor } from "@/components/cursor";

import Home from "@/pages/home";
import PlanBuilder from "@/pages/plan-builder";
import PlanView from "@/pages/plan-view";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Profile from "@/pages/profile";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

// On initial load, attempt a silent token refresh using the httpOnly refresh cookie.
// If it succeeds, we get a new access token + user; otherwise, user stays logged out.
function AuthInit({ children }: { children: React.ReactNode }) {
  const { login, logout } = useAuth();
  const attempted = useRef(false);
  const { mutate: refresh } = useRefreshToken({});

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    refresh(undefined, {
      onSuccess: (data) => {
        if (data.accessToken && data.user) {
          login(data.user, data.accessToken);
        } else {
          logout();
        }
      },
      onError: () => {
        logout();
      },
    });
  }, [login, logout, refresh]);

  return <>{children}</>;
}

function Router() {
  return (
    <div className="min-h-[100dvh] flex flex-col w-full relative">
      <div className="bg-noise" />
      <CustomCursor />

      <main className="flex-1 w-full flex flex-col relative z-10">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/profile" component={Profile} />
          <Route path="/plan/:city" component={PlanBuilder} />
          <Route path="/plan/:id/view" component={PlanView} />
          <Route path="/plan/share/:shareCode" component={PlanView} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AuthInit>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </AuthInit>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
