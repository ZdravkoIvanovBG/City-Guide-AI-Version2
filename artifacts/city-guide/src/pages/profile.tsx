import { lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/layout/navbar";
import { PlanCard } from "@/components/plan-card";
import { 
  useGetProfile, 
  useGetTravelStats, 
  useGetPlans,
  getGetProfileQueryKey,
  getGetTravelStatsQueryKey,
  getGetPlansQueryKey
} from "@workspace/api-client-react";
import { Globe, Map, Calendar, Navigation } from "lucide-react";

const TravelGlobe = lazy(() =>
  import("@/components/travel-globe").then((m) => ({ default: m.TravelGlobe }))
);

export default function Profile() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const { data: profile, isLoading: profileLoading } = useGetProfile({
    query: {
      enabled: isAuthenticated,
      queryKey: getGetProfileQueryKey()
    }
  });

  const { data: stats, isLoading: statsLoading } = useGetTravelStats({
    query: {
      enabled: !!profile?.id,
      queryKey: getGetTravelStatsQueryKey()
    }
  });

  const { data: plans, isLoading: plansLoading } = useGetPlans({
    query: {
      enabled: !!profile?.id,
      queryKey: getGetPlansQueryKey()
    }
  });

  if (authLoading || profileLoading || statsLoading || plansLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col pt-20">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse space-y-8 w-full max-w-4xl px-6">
            <div className="h-32 bg-muted rounded-none" />
            <div className="h-64 bg-muted rounded-none" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !profile) {
    if (!authLoading) setLocation("/login");
    return null;
  }

  const visitedCities = stats?.visitedCities ?? [];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-background flex flex-col"
    >
      <Navbar />
      
      <main className="flex-1 pt-24 pb-20">
        <div className="container mx-auto px-6">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row items-center md:items-end gap-8 mb-20 border-b border-border/50 pb-12">
            <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-primary/50 relative bg-muted shrink-0">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-serif text-4xl text-primary">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="text-center md:text-left flex-1">
              <h1 className="font-serif text-5xl md:text-6xl mb-2">{profile.name}</h1>
              <p className="text-muted-foreground text-lg font-light max-w-xl">
                {profile.bio || "Wandering the globe, one city at a time."}
              </p>
              <p className="text-xs text-muted-foreground/60 uppercase tracking-widest mt-4">
                Explorer since {new Date(profile.createdAt).getFullYear()}
              </p>
            </div>
          </div>

          {/* Globe Section */}
          {visitedCities.length > 0 && (
            <div className="mb-16">
              <div className="flex items-end justify-between mb-6">
                <h2 className="font-serif text-4xl">Your World</h2>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {stats?.totalCountries ?? 0} {(stats?.totalCountries ?? 0) === 1 ? "country" : "countries"} explored
                </p>
              </div>
              <div className="bg-card border border-border overflow-hidden">
                <Suspense
                  fallback={
                    <div className="h-[420px] bg-muted animate-pulse flex items-center justify-center">
                      <Globe className="w-10 h-10 text-muted-foreground/30 animate-spin" style={{ animationDuration: "3s" }} />
                    </div>
                  }
                >
                  <TravelGlobe visitedCities={visitedCities} />
                </Suspense>
              </div>
            </div>
          )}

          {/* Stats Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-24">
            <div className="bg-card border border-border p-8 text-center group hover:border-primary/50 transition-colors">
              <Globe className="w-6 h-6 text-primary mx-auto mb-4 group-hover:scale-110 transition-transform" />
              <div className="font-serif text-5xl md:text-6xl text-foreground mb-2">{stats?.totalCountries || 0}</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Countries</div>
            </div>
            <div className="bg-card border border-border p-8 text-center group hover:border-primary/50 transition-colors">
              <Map className="w-6 h-6 text-primary mx-auto mb-4 group-hover:scale-110 transition-transform" />
              <div className="font-serif text-5xl md:text-6xl text-foreground mb-2">{stats?.totalCities || 0}</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Cities</div>
            </div>
            <div className="bg-card border border-border p-8 text-center group hover:border-primary/50 transition-colors">
              <Calendar className="w-6 h-6 text-primary mx-auto mb-4 group-hover:scale-110 transition-transform" />
              <div className="font-serif text-5xl md:text-6xl text-foreground mb-2">{stats?.totalDays || 0}</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Days Traveling</div>
            </div>
            <div className="bg-card border border-border p-8 text-center group hover:border-primary/50 transition-colors">
              <Navigation className="w-6 h-6 text-primary mx-auto mb-4 group-hover:scale-110 transition-transform" />
              <div className="font-serif text-3xl md:text-4xl text-foreground mb-4 h-[60px] flex items-center justify-center leading-none">
                {stats?.favouriteContinent || "Unknown"}
              </div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Fav Continent</div>
            </div>
          </div>

          {/* Itineraries Filmstrip */}
          <div>
            <div className="flex items-end justify-between mb-8">
              <h2 className="font-serif text-4xl">Your Itineraries</h2>
            </div>
            
            {plans && plans.length > 0 ? (
              <motion.div
                layout
                className="flex overflow-x-auto gap-6 pb-8 snap-x snap-mandatory hide-scrollbar"
              >
                <AnimatePresence mode="popLayout">
                  {plans.map((plan, idx) => (
                    <PlanCard key={plan.id} plan={plan} index={idx} />
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <div className="bg-card border border-border p-12 text-center">
                <Map className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-xl font-serif mb-2">No plans yet</h3>
                <p className="text-muted-foreground mb-6">Your travel canvas is empty. Let's change that.</p>
                <button 
                  onClick={() => setLocation("/")}
                  className="bg-primary text-primary-foreground px-8 py-3 font-medium hover:bg-primary/90 transition-colors"
                >
                  Create a Plan
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </motion.div>
  );
}
