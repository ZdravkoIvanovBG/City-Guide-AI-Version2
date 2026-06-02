import { useState } from "react";
import { useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { 
  useGetPlan, 
  getGetPlanQueryKey,
  useGetWeather,
  TravelPlan,
  PlanDay,
  Destination,
  DayWeather,
  TransportMode
} from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/navbar";
import {
  MapPin, Clock, Info, ExternalLink, Share2, Download,
  Footprints, Bus, Train, TramFront, Car, Bike, InfoIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { LucideIcon } from "lucide-react";

// ── Transport config ────────────────────────────────────────────────────────

interface ModeConfig {
  label: string;
  Icon: LucideIcon;
  pillDefault: string;
  pillActive: string;
  panelBorder: string;
}

const MODE_CONFIG: Record<string, ModeConfig> = {
  walking: {
    label: "Walking",
    Icon: Footprints,
    pillDefault: "border-green-400/25 text-green-400/60 hover:border-green-400/50 hover:text-green-400",
    pillActive: "border-green-400 text-green-400 bg-green-950/40",
    panelBorder: "border-l-green-400/70",
  },
  bus: {
    label: "Bus",
    Icon: Bus,
    pillDefault: "border-blue-400/25 text-blue-400/60 hover:border-blue-400/50 hover:text-blue-400",
    pillActive: "border-blue-400 text-blue-400 bg-blue-950/40",
    panelBorder: "border-l-blue-400/70",
  },
  subway: {
    label: "Metro",
    Icon: Train,
    pillDefault: "border-purple-400/25 text-purple-400/60 hover:border-purple-400/50 hover:text-purple-400",
    pillActive: "border-purple-400 text-purple-400 bg-purple-950/40",
    panelBorder: "border-l-purple-400/70",
  },
  tram: {
    label: "Tram",
    Icon: TramFront,
    pillDefault: "border-indigo-400/25 text-indigo-400/60 hover:border-indigo-400/50 hover:text-indigo-400",
    pillActive: "border-indigo-400 text-indigo-400 bg-indigo-950/40",
    panelBorder: "border-l-indigo-400/70",
  },
  taxi: {
    label: "Taxi",
    Icon: Car,
    pillDefault: "border-amber-400/25 text-amber-400/60 hover:border-amber-400/50 hover:text-amber-400",
    pillActive: "border-amber-400 text-amber-400 bg-amber-950/40",
    panelBorder: "border-l-amber-400/70",
  },
  bicycle: {
    label: "Bicycle",
    Icon: Bike,
    pillDefault: "border-teal-400/25 text-teal-400/60 hover:border-teal-400/50 hover:text-teal-400",
    pillActive: "border-teal-400 text-teal-400 bg-teal-950/40",
    panelBorder: "border-l-teal-400/70",
  },
};

const MODE_ORDER = ["walking", "bus", "subway", "tram", "taxi", "bicycle"];

// Handles both legacy string format and new object format from DB
function parseMode(raw: unknown): (TransportMode & { available: true }) | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    return { available: true, instructions: raw };
  }
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (obj.available === false) return null;
    return {
      available: true,
      duration: typeof obj.duration === "string" ? obj.duration : undefined,
      from: typeof obj.from === "string" ? obj.from : undefined,
      line: typeof obj.line === "string" ? obj.line : undefined,
      stop: typeof obj.stop === "string" ? obj.stop : undefined,
      cost: typeof obj.cost === "string" ? obj.cost : undefined,
      instructions: typeof obj.instructions === "string" ? obj.instructions : undefined,
    };
  }
  return null;
}

// ── Components ──────────────────────────────────────────────────────────────

function TransportDetail({ info }: { info: TransportMode & { available: true } }) {
  return (
    <div className="space-y-1.5 text-[11px] text-muted-foreground leading-relaxed">
      {(info.duration || info.from) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {info.duration && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 shrink-0" />
              {info.duration}
            </span>
          )}
          {info.from && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              From: {info.from}
            </span>
          )}
        </div>
      )}
      {info.line && <div className="font-medium text-foreground/70">{info.line}</div>}
      {info.stop && <div>Exit: {info.stop}</div>}
      {info.cost && <div>💰 {info.cost}</div>}
      {info.instructions && (
        <div className="text-muted-foreground/60 italic">{info.instructions}</div>
      )}
    </div>
  );
}

function TransportSection({ howToGetThere }: { howToGetThere: Destination["howToGetThere"] }) {
  const raw = howToGetThere as unknown as Record<string, unknown> | undefined;

  const available = MODE_ORDER.flatMap((mode) => {
    if (!raw || !(mode in raw)) return [];
    const info = parseMode(raw[mode]);
    return info ? [{ mode, info }] : [];
  });

  const defaultMode = available.find((m) => m.mode === "walking")?.mode ?? available[0]?.mode ?? null;
  const [selected, setSelected] = useState<string | null>(defaultMode);

  if (available.length === 0) return null;

  const selectedEntry = available.find((m) => m.mode === selected);

  return (
    <div>
      {/* Mode pills */}
      <div className="flex flex-wrap gap-1.5">
        {available.map(({ mode, info }) => {
          const cfg = MODE_CONFIG[mode];
          if (!cfg) return null;
          const { Icon, label, pillDefault, pillActive } = cfg;
          const isActive = selected === mode;
          return (
            <button
              key={mode}
              onClick={() => setSelected(isActive ? null : mode)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] border transition-all ${isActive ? pillActive : pillDefault}`}
            >
              <Icon className="w-3 h-3 shrink-0" />
              <span className="font-medium">{label}</span>
              {info.duration && (
                <span className="opacity-60 font-normal">· {info.duration}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Expandable detail panel */}
      <AnimatePresence mode="wait">
        {selected && selectedEntry && MODE_CONFIG[selected] && (
          <motion.div
            key={selected}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className={`border-l-2 pl-3 mt-2 py-1.5 ${MODE_CONFIG[selected]!.panelBorder}`}>
              <TransportDetail info={selectedEntry.info} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Weather strip ─────────────────────────────────────────────────────────

function WeatherStrip({ day, weatherByDate }: { day: PlanDay; weatherByDate: Map<string, DayWeather> }) {
  const w = weatherByDate.get(day.date);
  if (!w) return null;

  const useFahrenheit = false; // already converted server-side based on countryCode
  const unitLabel = useFahrenheit ? "°F" : "°C";
  const iconUrl = `https://openweathermap.org/img/wn/${w.icon}@2x.png`;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2 bg-white/[0.03] border border-white/[0.06] text-[11px] text-muted-foreground mt-3 mb-1">
      {/* Icon + condition */}
      <span className="flex items-center gap-1 font-medium text-foreground/70">
        <img src={iconUrl} alt={w.condition} className="w-5 h-5 -ml-1" />
        <span className="capitalize">{w.condition}</span>
      </span>

      {/* Temp range */}
      <span className="flex items-center gap-1">
        <span className="text-blue-400/80">{w.tempMin}{unitLabel}</span>
        <span className="text-muted-foreground/30">–</span>
        <span className="text-amber-400/80">{w.tempMax}{unitLabel}</span>
      </span>

      {/* Rain */}
      <span className="flex items-center gap-1">
        💧 <span>{w.chanceOfRain}% rain</span>
      </span>

      {/* Wind */}
      <span className="flex items-center gap-1">
        💨 <span>{w.windSpeed} km/h</span>
      </span>

      {/* Historical badge */}
      {w.isHistorical && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 text-muted-foreground/50 cursor-default">
                <InfoIcon className="w-3 h-3" />
                <span className="italic">Typical</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs">
              Forecast not available yet — showing typical weather for this season.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function PlanView() {
  const [, params] = useRoute("/plan/:id/view");
  const id = parseInt(params?.id || "0", 10);
  
  const { data: plan, isLoading, error } = useGetPlan(id, {
    query: {
      enabled: !!id,
      queryKey: getGetPlanQueryKey(id)
    }
  });

  // Fetch weather in parallel — never blocks plan from rendering
  const weatherParams = {
    city: plan?.city ?? "",
    country: plan?.country ?? "",
    countryCode: plan?.countryCode || "US",
    startDate: plan?.startDate ?? "",
    endDate: plan?.endDate ?? "",
  };
  const { data: weatherData } = useGetWeather(weatherParams, {
    query: {
      enabled: !!plan,
      retry: false,
      staleTime: 3 * 60 * 60 * 1000,
      queryKey: ["/api/weather", weatherParams] as const,
    },
  });

  const weatherByDate = new Map<string, DayWeather>(
    (weatherData ?? []).map((d) => [d.date, d])
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <Navbar />
        <div className="container mx-auto px-6 py-20 flex justify-center">
          <div className="animate-pulse space-y-8 w-full max-w-4xl">
            <div className="h-64 bg-muted rounded-none" />
            <div className="h-12 w-64 bg-muted rounded-none mx-auto" />
            <div className="space-y-4">
              <div className="h-32 bg-muted rounded-none" />
              <div className="h-32 bg-muted rounded-none" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <Navbar />
        <div className="container mx-auto px-6 py-20 text-center">
          <h2 className="font-serif text-3xl mb-4">Plan not found</h2>
          <p className="text-muted-foreground">This itinerary may have been deleted or doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <Navbar />
      
      {/* Hero */}
      <section className="relative h-[60vh] min-h-[500px] flex items-end pb-16">
        <div className="absolute inset-0 z-0">
          {plan.photoUrl && (
            <img src={plan.photoUrl} alt={plan.city} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>
        
        <div className="container relative z-10 mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl"
          >
            <div className="flex items-center gap-4 mb-4 text-sm font-medium tracking-widest uppercase text-primary">
              <span>{plan.country}</span>
              <span className="w-1 h-1 rounded-full bg-primary" />
              <span>{format(new Date(plan.startDate), "MMM d")} – {format(new Date(plan.endDate), "MMM d, yyyy")}</span>
            </div>
            <h1 className="font-serif text-6xl md:text-8xl mb-6 text-white leading-none">{plan.city}</h1>
            <p className="text-lg md:text-xl text-gray-300 font-light max-w-2xl leading-relaxed">{plan.tripSummary}</p>
            <div className="flex gap-4 mt-8">
              <Button variant="outline" className="bg-background/20 backdrop-blur-md border-border/50 hover:bg-background/40 rounded-none">
                <Share2 className="w-4 h-4 mr-2" /> Share Plan
              </Button>
              <Button variant="outline" className="bg-background/20 backdrop-blur-md border-border/50 hover:bg-background/40 rounded-none" onClick={() => window.print()}>
                <Download className="w-4 h-4 mr-2" /> Export PDF
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <main className="flex-1 relative z-10 container mx-auto px-6 py-12">
        <Tabs defaultValue="itinerary" className="w-full">
          <div className="sticky top-20 z-40 bg-background/90 backdrop-blur-md pt-4 pb-4 border-b border-border/50 mb-12">
            <TabsList className="bg-transparent h-auto p-0 flex gap-8 border-none justify-start overflow-x-auto">
              {["itinerary", "hotels", "restaurants", "misc"].map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="font-serif text-xl md:text-2xl data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none pb-2 px-0 capitalize"
                >
                  {tab === "misc" ? "Good to Know" : tab === "restaurants" ? "Dining" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="itinerary" className="space-y-24 mt-0 outline-none">
            {plan.days.map((day, idx) => (
              <DaySection key={idx} day={day} weatherByDate={weatherByDate} />
            ))}
          </TabsContent>

          <TabsContent value="hotels" className="mt-0 outline-none">
            <HotelsSection hotels={plan.hotels} />
          </TabsContent>

          <TabsContent value="restaurants" className="mt-0 outline-none">
            <RestaurantsSection restaurants={plan.restaurants} />
          </TabsContent>

          <TabsContent value="misc" className="mt-0 outline-none">
            <div className="max-w-3xl">
              <h3 className="font-serif text-3xl mb-8 text-primary">Practical Info</h3>
              <div className="space-y-8 border-l border-border pl-8 relative">
                {plan.misc.map((item, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[37px] top-1 w-4 h-4 bg-background border-2 border-primary rounded-full" />
                    <h4 className="font-serif text-xl mb-1">{item.name}</h4>
                    <p className="text-sm text-primary mb-3">{item.dateOrFrequency} • {item.location}</p>
                    <p className="text-muted-foreground">{item.description}</p>
                    {item.isFree && (
                      <span className="inline-block mt-2 text-xs font-medium text-secondary border border-secondary/30 bg-secondary/10 px-2 py-1">Free</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ── Day section ─────────────────────────────────────────────────────────────

function DaySection({ day, weatherByDate }: { day: PlanDay; weatherByDate: Map<string, DayWeather> }) {
  return (
    <div className="relative">
      <div className="absolute -left-4 -top-12 md:-left-12 md:-top-20 text-[120px] md:text-[200px] font-serif font-bold text-muted/20 select-none pointer-events-none leading-none z-0">
        {day.dayNumber}
      </div>
      <div className="relative z-10 mb-8">
        <h3 className="font-serif text-4xl md:text-5xl text-primary mb-2">Day {day.dayNumber}</h3>
        <p className="text-muted-foreground uppercase tracking-widest text-sm">
          {format(new Date(day.date), "EEEE, MMMM do")}
        </p>
        <WeatherStrip day={day} weatherByDate={weatherByDate} />
      </div>
      <div className="space-y-8 relative z-10 pl-2 md:pl-8 border-l border-border/50">
        {day.destinations.map((dest, i) => (
          <DestinationCard key={i} dest={dest} />
        ))}
      </div>
    </div>
  );
}

// ── Destination card ─────────────────────────────────────────────────────────

function DestinationCard({ dest }: { dest: Destination }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      className="bg-card border border-border overflow-hidden relative group"
    >
      <div className="absolute -left-[5px] top-8 w-2 h-12 bg-primary rounded-r-sm" />

      <div className="flex flex-col md:flex-row">
        {dest.photoUrl && (
          <div className="md:w-2/5 h-64 md:h-auto overflow-hidden relative shrink-0">
            <img
              src={dest.photoUrl}
              alt={dest.name}
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute top-4 left-4">
              <span className="bg-background/80 backdrop-blur text-foreground text-xs uppercase tracking-widest px-3 py-1 font-medium">
                {dest.category}
              </span>
            </div>
          </div>
        )}

        <div className="p-8 flex-1 flex flex-col gap-5">
          {/* Title + cost */}
          <div className="flex items-start justify-between gap-4">
            <h4 className="font-serif text-3xl text-foreground">{dest.name}</h4>
            <span className={`text-xs font-medium px-2 py-1 whitespace-nowrap shrink-0 ${dest.entryCost.toLowerCase().includes("free") ? "text-secondary border border-secondary/30 bg-secondary/10" : "text-primary border border-primary/30 bg-primary/10"}`}>
              {dest.entryCost}
            </span>
          </div>

          {/* Summary */}
          <p className="text-muted-foreground leading-relaxed">{dest.summary}</p>

          {/* Best time */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4 text-primary shrink-0" />
            <span>{dest.bestTimeToVisit}</span>
          </div>

          {/* Transport */}
          {dest.howToGetThere && Object.keys(dest.howToGetThere).length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2.5">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                Getting there
              </div>
              <TransportSection howToGetThere={dest.howToGetThere} />
            </div>
          )}

          {/* Insider tips */}
          {dest.insiderTips && dest.insiderTips.length > 0 && (
            <div className="pt-5 border-t border-border/50">
              <div className="flex items-center gap-2 text-sm font-medium text-primary mb-3">
                <Info className="w-4 h-4" /> Insider Tips
              </div>
              <ul className="space-y-2">
                {dest.insiderTips.map((tip, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-1 shrink-0">•</span> {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Hotels section ───────────────────────────────────────────────────────────

function HotelsSection({ hotels }: { hotels: TravelPlan["hotels"] }) {
  const [activeTier, setActiveTier] = useState<"budget" | "midRange" | "luxury">("midRange");
  const currentHotels = hotels[activeTier] || [];

  return (
    <div>
      <div className="flex gap-4 mb-12 border-b border-border/50 pb-4 overflow-x-auto hide-scrollbar">
        {(["budget", "midRange", "luxury"] as const).map((tier) => (
          <button
            key={tier}
            onClick={() => setActiveTier(tier)}
            className={`font-medium uppercase tracking-widest text-sm pb-4 border-b-2 transition-colors whitespace-nowrap ${activeTier === tier ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`}
          >
            {tier === "budget" ? "Boutique & Budget" : tier === "midRange" ? "Comfort & Style" : "Luxury & Iconic"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {currentHotels.map((hotel, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group relative"
          >
            <div className="bg-card border border-border p-6 h-full flex flex-col transition-transform duration-300 group-hover:-translate-y-2">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-serif text-2xl mb-1 group-hover:text-primary transition-colors">{hotel.name}</h4>
                  <p className="text-sm text-muted-foreground">{hotel.neighbourhood} • {hotel.type}</p>
                </div>
                <span className="font-mono font-medium text-primary bg-primary/10 px-2 py-1 text-sm">{hotel.priceRange}</span>
              </div>

              {hotel.photoUrl && (
                <div className="h-48 mb-6 overflow-hidden bg-muted">
                  <img src={hotel.photoUrl} alt={hotel.name} className="w-full h-full object-cover" loading="lazy" />
                </div>
              )}

              <p className="text-muted-foreground text-sm mb-6 flex-1 leading-relaxed">{hotel.description}</p>

              <div className="flex flex-wrap gap-3 mt-auto pt-4 border-t border-border/50">
                {hotel.bookingUrl && (
                  <a href={hotel.bookingUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium uppercase tracking-widest flex items-center gap-1 hover:text-primary transition-colors">
                    Book <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {hotel.mapsUrl && (
                  <a href={hotel.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium uppercase tracking-widest flex items-center gap-1 hover:text-primary transition-colors text-muted-foreground">
                    Map <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Restaurants section ──────────────────────────────────────────────────────

function RestaurantsSection({ restaurants }: { restaurants: TravelPlan["restaurants"] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {restaurants.map((rest, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex border border-border bg-card overflow-hidden group hover:border-primary/50 transition-colors"
        >
          {rest.photoUrl && (
            <div className="w-1/3 h-full min-h-[200px] overflow-hidden">
              <img src={rest.photoUrl} alt={rest.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
            </div>
          )}
          <div className="flex-1 p-6 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-serif text-2xl">{rest.name}</h4>
              <span className="font-mono text-sm text-primary">{rest.priceRange}</span>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">{rest.cuisine} • {rest.neighbourhood}</p>
            <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{rest.description}</p>
            <div className="mt-auto bg-muted/30 p-3 border-l-2 border-primary">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">Must Try</p>
              <p className="text-sm text-foreground">{rest.mustTryDish}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
