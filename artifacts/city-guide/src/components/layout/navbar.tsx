import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useLogout } from "@workspace/api-client-react";
import { LogOut, User, Map, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      logout();
    } catch (e) {
      console.error(e);
    }
  };

  const isHome = location === "/";

  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-500 ${isHome ? 'bg-transparent' : 'bg-background/80 backdrop-blur-md border-b border-border/40'}`}
    >
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Compass className="w-6 h-6 text-primary group-hover:rotate-45 transition-transform duration-700" />
          <span className="font-serif text-2xl tracking-wide text-foreground">City Guide</span>
        </Link>

        <nav className="flex items-center gap-6">
          <AnimatePresence mode="wait">
            {isAuthenticated ? (
              <motion.div 
                key="auth-nav"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-4"
              >
                <Link href="/profile" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{user?.name}</span>
                </Link>
                <button 
                  onClick={handleLogout}
                  className="text-sm font-medium text-muted-foreground hover:text-destructive transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="unauth-nav"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-4"
              >
                <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Sign In
                </Link>
                <Link href="/register">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-none px-6">
                    Start Journey
                  </Button>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
      </div>
    </motion.header>
  );
}
