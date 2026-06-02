import { useState } from "react";
import { useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { 
  useGetPlan, 
  getGetPlanQueryKey,
  TravelPlan,
  PlanDay,
  Destination,
  Hotel,
  Restaurant
} from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/navbar";
import { MapPin, Clock, Info, ExternalLink, Calendar, Map, Check, Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PlanView() {
  const [, params] = useRoute("/plan/:id/view");
  const id = parseInt(params?.id || "0", 10);
  
  const { data: plan, isLoading, error } = useGetPlan(id, {
    query: {
      enabled: !!id,
      queryKey: getGetPlanQueryKey(id)
    }
  });

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
      
      {/* Hero Section */}
      <section className="relative h-[60vh] min-h-[500px] flex items-end pb-16">
        <div className="absolute inset-0 z-0">
          {plan.photoUrl && (
            <img 
              src={plan.photoUrl} 
              alt={plan.city}
              className="w-full h-full object-cover"
            />
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
              <span>{format(new Date(plan.startDate), "MMM d")} - {format(new Date(plan.endDate), "MMM d, yyyy")}</span>
            </div>
            
            <h1 className="font-serif text-6xl md:text-8xl mb-6 text-white leading-none">
              {plan.city}
            </h1>
            
            <p className="text-lg md:text-xl text-gray-300 font-light max-w-2xl leading-relaxed">
              {plan.tripSummary}
            </p>
            
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

      {/* Main Content */}
      <main className="flex-1 relative z-10 container mx-auto px-6 py-12">
        <Tabs defaultValue="itinerary" className="w-full">
          <div className="sticky top-20 z-40 bg-background/90 backdrop-blur-md pt-4 pb-4 border-b border-border/50 mb-12">
            <TabsList className="bg-transparent h-auto p-0 flex gap-8 border-none justify-start overflow-x-auto">
              <TabsTrigger value="itinerary" className="font-serif text-xl md:text-2xl data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none pb-2 px-0">
                Itinerary
              </TabsTrigger>
              <TabsTrigger value="hotels" className="font-serif text-xl md:text-2xl data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none pb-2 px-0">
                Hotels
              </TabsTrigger>
              <TabsTrigger value="restaurants" className="font-serif text-xl md:text-2xl data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none pb-2 px-0">
                Dining
              </TabsTrigger>
              <TabsTrigger value="misc" className="font-serif text-xl md:text-2xl data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none pb-2 px-0">
                Good to Know
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="itinerary" className="space-y-24 mt-0 outline-none">
            {plan.days.map((day, idx) => (
              <DaySection key={idx} day={day} />
            ))}
          </TabsContent>

          <TabsContent value="hotels" className="mt-0 outline-none">
            <HotelsSection hotels={plan.hotels} />
          </TabsContent>

          <TabsContent value="restaurants" className="mt-0 outline-none">
            <RestaurantsSection restaurants={plan.restaurants} />
          </TabsContent>

          <TabsContent value="misc" className="mt-0 outline-none">
            {/* Misc content... */}
            <div className="max-w-3xl">
              <h3 className="font-serif text-3xl mb-8 text-primary">Practical Info</h3>
              <div className="space-y-8 border-l border-border pl-8 relative">
                {plan.misc.map((item, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[37px] top-1 w-4 h-4 bg-background border-2 border-primary rounded-full" />
                    <h4 className="font-serif text-xl mb-1">{item.name}</h4>
                    <p className="text-sm text-primary mb-3">{item.dateOrFrequency} • {item.location}</p>
                    <p className="text-muted-foreground">{item.description}</p>
                    {item.isFree && <span className="inline-block mt-2 text-xs font-medium text-secondary border border-secondary/30 bg-secondary/10 px-2 py-1">Free</span>}
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

function DaySection({ day }: { day: PlanDay }) {
  return (
    <div className="relative">
      <div className="absolute -left-4 -top-12 md:-left-12 md:-top-20 text-[120px] md:text-[200px] font-serif font-bold text-muted/20 select-none pointer-events-none leading-none z-0">
        {day.dayNumber}
      </div>
      
      <div className="relative z-10 mb-12">
        <h3 className="font-serif text-4xl md:text-5xl text-primary mb-2">Day {day.dayNumber}</h3>
        <p className="text-muted-foreground uppercase tracking-widest text-sm">{format(new Date(day.date), "EEEE, MMMM do")}</p>
      </div>
      
      <div className="space-y-8 relative z-10 pl-2 md:pl-8 border-l border-border/50">
        {day.destinations.map((dest, i) => (
          <DestinationCard key={i} dest={dest} />
        ))}
      </div>
    </div>
  );
}

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
          <div className="md:w-2/5 h-64 md:h-auto overflow-hidden relative">
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
        
        <div className="p-8 flex-1 flex flex-col justify-center">
          <div className="flex items-start justify-between mb-4">
            <h4 className="font-serif text-3xl text-foreground">{dest.name}</h4>
            <span className={`text-xs font-medium px-2 py-1 whitespace-nowrap ${dest.entryCost.toLowerCase().includes('free') ? 'text-secondary border border-secondary/30 bg-secondary/10' : 'text-primary border border-primary/30 bg-primary/10'}`}>
              {dest.entryCost}
            </span>
          </div>
          
          <p className="text-muted-foreground leading-relaxed mb-6">
            {dest.summary}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-auto">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                <Clock className="w-4 h-4 text-primary" /> Best time
              </div>
              <p className="text-sm text-muted-foreground">{dest.bestTimeToVisit}</p>
            </div>
            
            {dest.howToGetThere && Object.keys(dest.howToGetThere).length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <MapPin className="w-4 h-4 text-primary" /> Getting there
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(dest.howToGetThere).map(([mode, info]) => (
                    <span key={mode} className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-sm" title={info}>
                      {mode}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {dest.insiderTips && dest.insiderTips.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border/50">
              <div className="flex items-center gap-2 text-sm font-medium text-primary mb-3">
                <Info className="w-4 h-4" /> Insider Tips
              </div>
              <ul className="space-y-2">
                {dest.insiderTips.map((tip, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-1">•</span> {tip}
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

function HotelsSection({ hotels }: { hotels: TravelPlan["hotels"] }) {
  const [activeTier, setActiveTier] = useState<"budget" | "midRange" | "luxury">("midRange");
  
  const currentHotels = hotels[activeTier] || [];
  
  return (
    <div>
      <div className="flex gap-4 mb-12 border-b border-border/50 pb-4 overflow-x-auto hide-scrollbar">
        <button 
          onClick={() => setActiveTier("budget")}
          className={`font-medium uppercase tracking-widest text-sm pb-4 border-b-2 transition-colors whitespace-nowrap ${activeTier === "budget" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`}
        >
          Boutique & Budget
        </button>
        <button 
          onClick={() => setActiveTier("midRange")}
          className={`font-medium uppercase tracking-widest text-sm pb-4 border-b-2 transition-colors whitespace-nowrap ${activeTier === "midRange" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`}
        >
          Comfort & Style
        </button>
        <button 
          onClick={() => setActiveTier("luxury")}
          className={`font-medium uppercase tracking-widest text-sm pb-4 border-b-2 transition-colors whitespace-nowrap ${activeTier === "luxury" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`}
        >
          Luxury & Iconic
        </button>
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
            {/* Mouse tracking tilt would go here, using simple hover for now */}
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
              
              <p className="text-muted-foreground text-sm mb-6 flex-1 leading-relaxed">
                {hotel.description}
              </p>
              
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
            
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">
              {rest.cuisine} • {rest.neighbourhood}
            </p>
            
            <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
              {rest.description}
            </p>
            
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
