import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/layout/navbar";
import { PlanCard } from "@/components/plan-card";
import { useToast } from "@/hooks/use-toast";
import { 
  useGetProfile, 
  useUpdateProfile,
  useGetTravelStats, 
  useGetPlans,
  useGetCityAutocomplete,
  getGetProfileQueryKey,
  getGetTravelStatsQueryKey,
  getGetPlansQueryKey,
  getGetCityAutocompleteQueryKey,
  CityOption,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Globe, Map, Calendar, Navigation, Edit2, Check, X, MapPin, Search } from "lucide-react";

const TravelGlobe = lazy(() =>
  import("@/components/travel-globe").then((m) => ({ default: m.TravelGlobe }))
);

function HomeCityInput({ value, country, onSelect }: {
  value: string;
  country: string;
  onSelect: (city: string, country: string) => void;
}) {
  const [query, setQuery] = useState(value ? `${value}${country ? ", " + country : ""}` : "");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value ? `${value}${country ? ", " + country : ""}` : ""); }, [value, country]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const { data: suggestions, isLoading } = useGetCityAutocomplete(
    { q: debounced },
    { query: { enabled: debounced.length > 1, queryKey: getGetCityAutocompleteQueryKey({ q: debounced }) } }
  );

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          placeholder="Where are you based?"
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full pl-9 pr-4 py-2.5 bg-background border border-border/60 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
        />
      </div>
      <AnimatePresence>
        {open && query.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute top-full mt-1 w-full bg-card border border-border z-50 shadow-xl max-h-48 overflow-y-auto"
          >
            {isLoading ? (
              <p className="p-3 text-sm text-muted-foreground text-center">Searching…</p>
            ) : suggestions && suggestions.length > 0 ? (
              <ul>
                {suggestions.map((city: CityOption, i: number) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => { onSelect(city.city, city.country); setQuery(`${city.city}, ${city.country}`); setOpen(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-center gap-3 transition-colors text-sm"
                    >
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      <div>
                        <span className="font-medium">{city.city}</span>
                        <span className="text-muted-foreground ml-1.5">{city.country}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-3 text-sm text-muted-foreground text-center">No cities found</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Profile() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState("");
  const [formBio, setFormBio] = useState("");
  const [formHomeCity, setFormHomeCity] = useState("");
  const [formHomeCountry, setFormHomeCountry] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  
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

  const { mutate: updateProfile, isPending: isUpdating } = useUpdateProfile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        setIsEditing(false);
        toast({ title: "Profile updated", description: "Your changes have been saved." });
      },
      onError: () => {
        toast({ title: "Update failed", description: "Please try again.", variant: "destructive" });
      }
    }
  });

  useEffect(() => {
    if (profile && !isEditing) {
      setFormName(profile.name ?? "");
      setFormBio(profile.bio ?? "");
      setFormHomeCity(profile.homeCity ?? "");
      setFormHomeCountry(profile.homeCountry ?? "");
    }
  }, [profile, isEditing]);

  const handleSave = () => {
    updateProfile({
      data: {
        name: formName || undefined,
        bio: formBio || null,
        homeCity: formHomeCity || null,
        homeCountry: formHomeCountry || null,
      }
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (profile) {
      setFormName(profile.name ?? "");
      setFormBio(profile.bio ?? "");
      setFormHomeCity(profile.homeCity ?? "");
      setFormHomeCountry(profile.homeCountry ?? "");
    }
  };

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
              {isEditing ? (
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-widest block mb-1.5">Name</label>
                    <input
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="w-full bg-background border border-border/60 px-3 py-2.5 text-lg focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-widest block mb-1.5">Bio</label>
                    <textarea
                      value={formBio}
                      onChange={e => setFormBio(e.target.value)}
                      rows={2}
                      placeholder="Wandering the globe, one city at a time."
                      className="w-full bg-background border border-border/60 px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-widest block mb-1.5">
                      Home city <span className="normal-case text-muted-foreground/50">— used to pre-fill departure on travel plans</span>
                    </label>
                    <HomeCityInput
                      value={formHomeCity}
                      country={formHomeCountry}
                      onSelect={(city, country) => { setFormHomeCity(city); setFormHomeCountry(country); }}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={handleSave}
                      disabled={isUpdating}
                      className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      {isUpdating ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={handleCancel}
                      className="flex items-center gap-2 border border-border px-5 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="font-serif text-5xl md:text-6xl mb-2">{profile.name}</h1>
                  <p className="text-muted-foreground text-lg font-light max-w-xl">
                    {profile.bio || "Wandering the globe, one city at a time."}
                  </p>
                  {profile.homeCity && (
                    <p className="text-sm text-muted-foreground/70 mt-2 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      Based in {profile.homeCity}{profile.homeCountry ? `, ${profile.homeCountry}` : ""}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-4">
                    <p className="text-xs text-muted-foreground/60 uppercase tracking-widest">
                      Explorer since {new Date(profile.createdAt).getFullYear()}
                    </p>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-primary transition-colors uppercase tracking-widest"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit profile
                    </button>
                  </div>
                </>
              )}
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
            <div className="flex items-end justify-between mb-6">
              <h2 className="font-serif text-4xl">Your Itineraries</h2>
            </div>

            {/* Status filter */}
            {plans && plans.length > 0 && (() => {
              const statuses = Array.from(new Set((plans ?? []).map(p => p.status ?? "planning")));
              const STATUS_LABELS: Record<string, string> = { planning: "Planning", booked: "Booked", ongoing: "Ongoing", completed: "Completed", wishlist: "Wishlist" };
              return (
                <div className="flex gap-3 mb-6 flex-wrap">
                  <button onClick={() => setStatusFilter(null)} className={`text-xs font-medium uppercase tracking-widest px-3 py-1.5 border transition-colors ${!statusFilter ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`}>All</button>
                  {statuses.map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)} className={`text-xs font-medium uppercase tracking-widest px-3 py-1.5 border transition-colors ${statusFilter === s ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      {STATUS_LABELS[s] ?? s}
                    </button>
                  ))}
                </div>
              );
            })()}
            
            {plans && plans.length > 0 ? (
              <motion.div
                layout
                className="flex overflow-x-auto gap-6 pb-8 snap-x snap-mandatory hide-scrollbar"
              >
                <AnimatePresence mode="popLayout">
                  {(plans ?? []).filter(p => !statusFilter || (p.status ?? "planning") === statusFilter).map((plan, idx) => (
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
