import { useState, useCallback, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays } from "date-fns";
import { 
  useGetPlan, 
  getGetPlanQueryKey,
  useGetWeather,
  useGetProfile,
  useSearchRoutes,
  useGetCityAutocomplete,
  useRenamePlan,
  useUpdatePlanNotes,
  useUpdatePlanStatus,
  useReorderDays,
  useReorderDestinations,
  useRemoveDestination,
  useGetAllDestinationNotes,
  useUpsertDestinationNote,
  getGetAllDestinationNotesQueryKey,
  getGetProfileQueryKey,
  getGetCityAutocompleteQueryKey,
  TravelPlan,
  PlanDay,
  Destination,
  DayWeather,
  TransportMode,
  PackingList,
  PackingCategory,
  PackingItem,
  BudgetEstimate,
  BudgetDay,
  BudgetLine,
  FixedCost,
  TripChecklist,
  ChecklistCategory,
  ChecklistItem,
  RouteOption,
  CityOption,
  DestinationNote,
} from "@workspace/api-client-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import {
  MapPin, Clock, Info, ExternalLink, Share2, Download,
  Footprints, Bus, Train, TramFront, Car, Bike, InfoIcon,
  ChevronDown, Package, Wallet, ClipboardList,
  Plane, Ship, Lightbulb, ArrowRight, Search,
  Edit2, Check, X, GripVertical, Trash2, ChevronUp, ChevronDown as ChevronDownIcon,
  StickyNote, Tag, Sunrise, Sun, Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
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

const TRANSPORT_MODE_ORDER = ["walking", "bus", "subway", "tram", "taxi", "bicycle"];

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string; dot?: string }> = {
  planning:  { label: "Planning",  className: "border-blue-400/40 text-blue-400 bg-blue-950/30", dot: "bg-blue-400" },
  booked:    { label: "Booked",    className: "border-amber-400/40 text-amber-400 bg-amber-950/30", dot: "bg-amber-400" },
  ongoing:   { label: "Ongoing",   className: "border-green-400/40 text-green-400 bg-green-950/30", dot: "bg-green-400 animate-pulse" },
  completed: { label: "Completed", className: "border-emerald-600/40 text-emerald-500 bg-emerald-950/20", dot: "bg-emerald-500" },
  wishlist:  { label: "Wishlist",  className: "border-purple-400/40 text-purple-400 bg-purple-950/30", dot: "bg-purple-400" },
};

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

  const available = TRANSPORT_MODE_ORDER.flatMap((mode) => {
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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: plan, isLoading, error } = useGetPlan(id, {
    query: { enabled: !!id, queryKey: getGetPlanQueryKey(id) }
  });

  // Who owns this plan?
  const { data: profile } = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });
  const isOwner = !!profile && !!plan && (plan as unknown as { userId?: number }).userId === profile.id;

  // Edit state
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);

  // Local day order (for optimistic DnD)
  const [localDayOrder, setLocalDayOrder] = useState<number[] | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  useEffect(() => { setLocalDayOrder(null); setReorderMode(false); }, [plan?.id]);

  // Mutations
  const { mutate: renamePlan } = useRenamePlan();
  const { mutate: updateNotes } = useUpdatePlanNotes();
  const { mutate: updateStatus } = useUpdatePlanStatus();
  const { mutate: reorderDaysMut } = useReorderDays();
  const { mutate: reorderDestsMut } = useReorderDestinations();
  const { mutate: removeDestMut } = useRemoveDestination();

  // Destination notes
  const { data: allDestNotes } = useGetAllDestinationNotes(id, {
    query: { enabled: !!id && isOwner, queryKey: getGetAllDestinationNotesQueryKey(id) }
  });
  const destNoteMap = new Map<string, string>(
    (allDestNotes ?? []).map((n: DestinationNote) => [`${n.dayIndex}-${n.destIndex}`, n.note])
  );

  const invalidatePlan = () => queryClient.invalidateQueries({ queryKey: getGetPlanQueryKey(id) });

  const handleRename = () => {
    const trimmed = nameInput.trim().slice(0, 60);
    renamePlan({ id, data: { customName: trimmed || null } }, {
      onSuccess: () => { setEditingName(false); invalidatePlan(); },
      onError: () => toast({ title: "Rename failed", variant: "destructive" }),
    });
  };

  const handleNotesSave = () => {
    updateNotes({ id, data: { tripNotes: notesInput || null } }, {
      onSuccess: () => { setEditingNotes(false); invalidatePlan(); },
      onError: () => toast({ title: "Save failed", variant: "destructive" }),
    });
  };

  const handleStatus = (status: string) => {
    setStatusOpen(false);
    updateStatus({ id, data: { status } }, {
      onSuccess: invalidatePlan,
      onError: () => toast({ title: "Status update failed", variant: "destructive" }),
    });
  };

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Ordered days — apply order, then reassign dates sequentially from startDate
  const orderedDays = (() => {
    if (!plan) return [];
    const days = plan.days as PlanDay[];
    const order = localDayOrder ?? (plan.dayOrder as number[] | null);
    const reordered = (!order || order.length !== days.length)
      ? days
      : (order.map(i => days[i]).filter(Boolean) as PlanDay[]);
    return reordered.map((day, idx) => ({
      ...day,
      dayNumber: idx + 1,
      date: format(addDays(new Date(plan.startDate), idx), "yyyy-MM-dd"),
    }));
  })();

  const handleDayDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !plan) return;
    const days = plan.days as PlanDay[];
    const currentOrder = localDayOrder ?? (plan.dayOrder as number[] | null) ?? days.map((_, i) => i);
    const oldIdx = currentOrder.findIndex(i => i === Number(active.id));
    const newIdx = currentOrder.findIndex(i => i === Number(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const newOrder = arrayMove(currentOrder, oldIdx, newIdx);
    setLocalDayOrder(newOrder);
    // In reorder mode: accumulate changes, save only on Done
    if (!reorderMode) {
      reorderDaysMut({ id, data: { dayOrder: newOrder } }, {
        onSuccess: invalidatePlan,
        onError: () => { setLocalDayOrder(null); toast({ title: "Reorder failed", variant: "destructive" }); },
      });
    }
  };

  const exitReorderMode = () => {
    setReorderMode(false);
    const days = plan?.days as PlanDay[] | undefined;
    const finalOrder = localDayOrder ?? (plan?.dayOrder as number[] | null) ?? (days ?? []).map((_, i) => i);
    reorderDaysMut({ id, data: { dayOrder: finalOrder } }, {
      onSuccess: () => { invalidatePlan(); toast({ title: "Order saved" }); },
      onError: () => toast({ title: "Save failed", variant: "destructive" }),
    });
  };

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

              {/* Status pill */}
              {isOwner && (
                <div className="relative">
                  <button
                    onClick={() => setStatusOpen(o => !o)}
                    className={`flex items-center gap-1.5 px-2.5 py-0.5 border text-[11px] font-medium uppercase tracking-widest transition-all ${STATUS_CONFIG[plan.status ?? "planning"]?.className ?? STATUS_CONFIG.planning.className}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[plan.status ?? "planning"]?.dot ?? "bg-blue-400"}`} />
                    {STATUS_CONFIG[plan.status ?? "planning"]?.label ?? "Planning"}
                    <Tag className="w-3 h-3 ml-0.5 opacity-60" />
                  </button>
                  {statusOpen && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border shadow-xl min-w-[140px]">
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => handleStatus(key)}
                          className={`w-full text-left px-3 py-2 text-xs font-medium uppercase tracking-widest flex items-center gap-2 hover:bg-muted transition-colors ${plan.status === key ? "text-primary" : "text-muted-foreground"}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} /> {cfg.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!isOwner && plan.status && plan.status !== "planning" && (
                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 border text-[11px] font-medium uppercase tracking-widest ${STATUS_CONFIG[plan.status]?.className ?? ""}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[plan.status]?.dot}`} />
                  {STATUS_CONFIG[plan.status]?.label}
                </span>
              )}
            </div>

            {/* Title — editable if owner */}
            {editingName ? (
              <div className="flex items-center gap-3 mb-6">
                <input
                  autoFocus
                  value={nameInput}
                  maxLength={60}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditingName(false); }}
                  className="font-serif text-4xl md:text-5xl bg-transparent border-b-2 border-primary text-white outline-none w-full max-w-xl placeholder-white/30"
                  placeholder={plan.city}
                />
                <button onClick={handleRename} className="p-2 text-primary hover:text-white transition-colors"><Check className="w-5 h-5" /></button>
                <button onClick={() => setEditingName(false)} className="p-2 text-muted-foreground hover:text-white transition-colors"><X className="w-5 h-5" /></button>
              </div>
            ) : (
              <div className="group flex items-start gap-3 mb-6">
                <h1 className="font-serif text-6xl md:text-8xl text-white leading-none">
                  {plan.customName ?? plan.city}
                  {plan.customName && <span className="text-white/40 ml-3 text-3xl md:text-4xl">{plan.city}</span>}
                </h1>
                {isOwner && (
                  <button
                    onClick={() => { setNameInput(plan.customName ?? ""); setEditingName(true); }}
                    className="opacity-0 group-hover:opacity-100 mt-3 p-1.5 text-white/40 hover:text-white transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            <p className="text-lg md:text-xl text-gray-300 font-light max-w-2xl leading-relaxed">{plan.tripSummary}</p>

            {/* Trip notes */}
            {isOwner && (
              <div className="mt-6 max-w-2xl">
                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={notesInput}
                      onChange={e => setNotesInput(e.target.value)}
                      rows={3}
                      className="w-full bg-background/30 backdrop-blur border border-primary/50 text-white/90 placeholder-white/30 text-sm p-3 resize-none outline-none focus:border-primary"
                      placeholder="Add trip notes, reminders, or anything personal…"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleNotesSave} className="text-xs font-medium uppercase tracking-widest text-primary hover:text-white flex items-center gap-1 px-3 py-1.5 border border-primary/50 hover:border-primary transition-all"><Check className="w-3 h-3" /> Save</button>
                      <button onClick={() => setEditingNotes(false)} className="text-xs font-medium uppercase tracking-widest text-muted-foreground hover:text-white flex items-center gap-1 px-3 py-1.5 border border-border/50 hover:border-border transition-all"><X className="w-3 h-3" /> Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setNotesInput(plan.tripNotes ?? ""); setEditingNotes(true); }}
                    className="group/notes flex items-start gap-2 text-left text-sm text-white/50 hover:text-white/80 transition-colors"
                  >
                    <StickyNote className="w-3.5 h-3.5 shrink-0 mt-0.5 group-hover/notes:text-primary transition-colors" />
                    <span className="italic">{plan.tripNotes ?? "Add trip notes…"}</span>
                  </button>
                )}
              </div>
            )}
            {!isOwner && plan.tripNotes && (
              <p className="mt-4 text-sm text-white/60 italic max-w-2xl flex items-start gap-2">
                <StickyNote className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {plan.tripNotes}
              </p>
            )}

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
        <Tabs defaultValue="getting-there" className="w-full" onValueChange={(val) => { if (val !== "itinerary" && reorderMode) exitReorderMode(); }}>
          <div className="sticky top-20 z-40 bg-background/90 backdrop-blur-md pt-4 pb-4 border-b border-border/50 mb-12">
            <TabsList className="bg-transparent h-auto p-0 flex gap-8 border-none justify-start overflow-x-auto">
              {["getting-there", "itinerary", "hotels", "restaurants", "misc", "before-you-go"].map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="font-serif text-xl md:text-2xl data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none pb-2 px-0 capitalize whitespace-nowrap"
                >
                  {tab === "getting-there" ? "Getting There" : tab === "misc" ? "Bonus Activities" : tab === "restaurants" ? "Dining" : tab === "before-you-go" ? "Before You Go" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="getting-there" className="mt-0 outline-none">
            <GettingThereTab plan={plan} />
          </TabsContent>

          <TabsContent value="itinerary" className="mt-0 outline-none">
            {isOwner && (
              <div className="mb-8">
                <button
                  onClick={() => reorderMode ? exitReorderMode() : setReorderMode(true)}
                  className={`flex items-center gap-2 text-xs font-medium uppercase tracking-widest px-3 py-2 border transition-all ${reorderMode ? "border-primary text-primary bg-primary/10" : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"}`}
                >
                  {reorderMode ? <Check className="w-3.5 h-3.5" /> : <GripVertical className="w-3.5 h-3.5" />}
                  {reorderMode ? "Done reordering" : "Reorder days"}
                </button>
                {reorderMode && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-xs text-muted-foreground/50"
                  >
                    Drag days into your preferred order — destinations are temporarily hidden
                  </motion.p>
                )}
              </div>
            )}
            {isOwner ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDayDragEnd}>
                <SortableContext
                  items={(orderedDays as PlanDay[]).map((_, i) => {
                    const days = plan.days as PlanDay[];
                    const order = localDayOrder ?? (plan.dayOrder as number[] | null);
                    return order && order.length === days.length ? order[i] : i;
                  })}
                  strategy={verticalListSortingStrategy}
                >
                  <motion.div
                    layout
                    className={reorderMode ? "space-y-2" : "space-y-24"}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    {(orderedDays as PlanDay[]).map((day, idx) => {
                      const days = plan.days as PlanDay[];
                      const order = localDayOrder ?? (plan.dayOrder as number[] | null);
                      const originalIdx = order && order.length === days.length ? order[idx] : idx;
                      return (
                        <SortableDay key={originalIdx} dayOriginalIndex={originalIdx} reorderMode={reorderMode} day={day}>
                          {!reorderMode && (
                            <DaySection
                              day={day}
                              dayOriginalIndex={originalIdx}
                              weatherByDate={weatherByDate}
                              isOwner={isOwner}
                              planId={id}
                              destNoteMap={destNoteMap}
                              revealDelay={idx * 0.06}
                              onReorderDests={(destOrder) => reorderDestsMut({ id, data: { dayIndex: originalIdx, destOrder } }, { onSuccess: invalidatePlan })}
                              onRemoveDest={(destIndex) => removeDestMut({ id, data: { dayIndex: originalIdx, destIndex } }, { onSuccess: invalidatePlan })}
                            />
                          )}
                        </SortableDay>
                      );
                    })}
                  </motion.div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="space-y-24">
                {(plan.days as PlanDay[]).map((day, idx) => (
                  <DaySection key={idx} day={day} dayOriginalIndex={idx} weatherByDate={weatherByDate} isOwner={false} planId={id} destNoteMap={destNoteMap} revealDelay={0} onReorderDests={() => {}} onRemoveDest={() => {}} />
                ))}
              </div>
            )}
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

          <TabsContent value="before-you-go" className="mt-0 outline-none">
            <BeforeYouGoTab plan={plan} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ── Getting There ────────────────────────────────────────────────────────────

const ROUTE_MODE_ORDER = ["flight", "train", "bus", "ferry", "drive"] as const;

function modeIcon(mode: string) {
  switch (mode.toLowerCase()) {
    case "flight": return <Plane className="w-5 h-5" />;
    case "train": return <Train className="w-5 h-5" />;
    case "bus": return <Bus className="w-5 h-5" />;
    case "ferry": return <Ship className="w-5 h-5" />;
    case "drive": return <Car className="w-5 h-5" />;
    default: return <MapPin className="w-5 h-5" />;
  }
}

function modeLabel(mode: string): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function RouteOptionCard({ option, isPrimary }: { option: RouteOption; isPrimary: boolean }) {
  const price = option.priceRange;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border p-6 flex flex-col gap-4 ${isPrimary ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
    >
      {/* Header row: mode badge (left) + duration (right) — the ONLY flex-row in the card */}
      <div className="flex items-center justify-between gap-4 flex-wrap w-full">
        <div className="flex items-center gap-2 min-w-0 flex-shrink-1">
          <span className="text-primary shrink-0">{modeIcon(option.mode)}</span>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{modeLabel(option.mode)}</p>
        </div>
        {option.duration && (
          <span className="font-serif text-3xl text-primary leading-none whitespace-nowrap flex-shrink-0">
            {option.duration}
          </span>
        )}
      </div>

      {/* Summary — full width block below the header */}
      <p className="text-base leading-snug w-full break-words">{option.summary}</p>

      {/* Details — frequency + route/stops, full width */}
      {(option.frequency || option.route || option.stops) && (
        <div className="space-y-1 text-sm text-muted-foreground w-full">
          {option.frequency && <p>{option.frequency}</p>}
          {option.route && (
            <p className="font-mono text-xs break-all">
              {option.route}{option.stops ? ` · ${option.stops}` : ""}
            </p>
          )}
        </div>
      )}

      {/* Price — full width block */}
      {price && (
        <div className="w-full">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Estimated price</p>
          <p className="text-amber-400 font-medium">
            {price.currency} {price.low.toLocaleString()} – {price.high.toLocaleString()}
          </p>
          {price.note && <p className="text-xs text-muted-foreground/60 mt-0.5">{price.note}</p>}
        </div>
      )}

      {/* Operators — wrapping pills, full width */}
      {option.operators && option.operators.length > 0 && (
        <div className="flex flex-wrap gap-1.5 w-full">
          {option.operators.map((op, i) => (
            <span key={i} className="text-xs border border-border/60 px-2 py-0.5 text-muted-foreground">{op}</span>
          ))}
        </div>
      )}

      {/* Tips — each is a full-width row with icon inline */}
      {option.tips && option.tips.length > 0 && (
        <div className="space-y-1.5 w-full">
          {option.tips.map((tip, i) => (
            <div key={i} className="flex gap-2 text-sm text-muted-foreground w-full">
              <Lightbulb className="w-4 h-4 text-amber-400/70 shrink-0 mt-0.5" />
              <span className="min-w-0 break-words">{tip}</span>
            </div>
          ))}
        </div>
      )}

      {/* Booking links — wrapping row */}
      {option.bookingLinks && option.bookingLinks.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-2 border-t border-border/40 w-full">
          {option.bookingLinks.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest px-4 py-2 transition-colors ${
                i === 0
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border border-border text-muted-foreground hover:text-foreground hover:border-foreground"
              }`}
            >
              {link.label} <ExternalLink className="w-3 h-3" />
            </a>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground/50 pt-1">
        Estimated — click to check live prices
      </p>
    </motion.div>
  );
}

function RouteSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map(i => (
        <div key={i} className="border border-border p-6 space-y-4 animate-pulse">
          <div className="flex justify-between">
            <div className="flex gap-3">
              <div className="w-5 h-5 bg-muted rounded-sm" />
              <div className="space-y-2">
                <div className="h-3 w-16 bg-muted rounded" />
                <div className="h-4 w-48 bg-muted rounded" />
              </div>
            </div>
            <div className="h-8 w-16 bg-muted rounded" />
          </div>
          <div className="h-3 w-32 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="flex gap-2">
            <div className="h-8 w-28 bg-muted rounded" />
            <div className="h-8 w-28 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function OriginCityInput({ value, countryValue, onChange, onCountryChange, placeholder }: {
  value: string;
  countryValue: string;
  onChange: (city: string) => void;
  onCountryChange: (country: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [debounced, setDebounced] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

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

  const { data: suggestions, isLoading: suggestionsLoading } = useGetCityAutocomplete(
    { q: debounced },
    { query: { enabled: debounced.length > 1, queryKey: getGetCityAutocompleteQueryKey({ q: debounced }) } }
  );

  const handleSelect = (city: CityOption) => {
    setQuery(`${city.city}, ${city.country}`);
    onChange(city.city);
    onCountryChange(city.country);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          placeholder={placeholder ?? "Where are you travelling from?"}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full pl-9 pr-4 py-3 bg-background border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
        />
      </div>
      <AnimatePresence>
        {open && query.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute top-full mt-1 w-full bg-card border border-border z-50 shadow-xl max-h-56 overflow-y-auto"
          >
            {suggestionsLoading ? (
              <p className="p-3 text-sm text-muted-foreground text-center">Searching…</p>
            ) : suggestions && suggestions.length > 0 ? (
              <ul>
                {suggestions.map((city, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => handleSelect(city)}
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

function GettingThereTab({ plan }: { plan: TravelPlan }) {
  const { data: profile } = useGetProfile({ query: { enabled: true, queryKey: getGetProfileQueryKey() } });

  const [originCity, setOriginCity] = useState<string>("");
  const [originCountry, setOriginCountry] = useState<string>("");
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (profile?.homeCity && !originCity) {
      setOriginCity(profile.homeCity);
      setOriginCountry(profile.homeCountry ?? "");
    }
  }, [profile]);

  const { mutate, data: routeResult, isPending, isError } = useSearchRoutes();

  const isSameCity = originCity.toLowerCase().trim() === plan.city.toLowerCase().trim();

  const handleSearch = () => {
    if (!originCity) return;
    setHasSearched(true);
    mutate({
      data: {
        originCity,
        originCountry,
        destinationCity: plan.city,
        destinationCountry: plan.country,
        startDate: plan.startDate,
        endDate: plan.endDate,
      },
    });
  };

  const sortedOptions = routeResult?.options
    ? [...routeResult.options].sort((a, b) => {
        const ai = ROUTE_MODE_ORDER.indexOf(a.mode.toLowerCase() as typeof ROUTE_MODE_ORDER[number]);
        const bi = ROUTE_MODE_ORDER.indexOf(b.mode.toLowerCase() as typeof ROUTE_MODE_ORDER[number]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
    : [];

  const availableOptions = sortedOptions.filter(o => o.available);
  const onlyOneMode = availableOptions.length === 1;

  return (
    <div className="max-w-3xl space-y-8">
      {/* Origin / Destination selector */}
      <div className="border border-border p-6 space-y-5 bg-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Travelling from</p>
            <OriginCityInput
              value={originCity ? `${originCity}${originCountry ? ", " + originCountry : ""}` : ""}
              countryValue={originCountry}
              onChange={setOriginCity}
              onCountryChange={setOriginCountry}
            />
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground/40 shrink-0 mt-6 hidden sm:block" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">To</p>
            <div className="flex items-center gap-2 py-3 px-4 border border-border/40 bg-muted/20">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm">{plan.city}, {plan.country}</span>
            </div>
          </div>
        </div>

        {isSameCity && originCity && (
          <p className="text-sm text-amber-400">You're already there!</p>
        )}

        <button
          onClick={handleSearch}
          disabled={!originCity || isSameCity || isPending}
          className="bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Searching…" : "Search routes"}
        </button>

        {!profile?.homeCity && (
          <p className="text-xs text-muted-foreground/50">
            Tip: Set your home city on your profile to auto-fill this field.
          </p>
        )}
      </div>

      {/* Results */}
      {isPending && <RouteSkeleton />}

      {isError && hasSearched && (
        <div className="border border-border p-6 text-center text-muted-foreground">
          <p className="mb-2">Something went wrong fetching routes. Please try again.</p>
          <a href={`https://www.rome2rio.com/s/${encodeURIComponent(originCity)}/${encodeURIComponent(plan.city)}`} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline flex items-center gap-1 justify-center">
            Search on Rome2rio <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {!isPending && hasSearched && routeResult && (
        <>
          {onlyOneMode && (
            <p className="text-sm text-muted-foreground border-l-2 border-primary/40 pl-3">
              For this route, {availableOptions[0]?.mode ?? "flying"} is the only practical option.
            </p>
          )}

          {availableOptions.length === 0 ? (
            <div className="border border-border p-8 text-center space-y-3 text-muted-foreground">
              <p>We couldn't find route options for this journey.</p>
              <a
                href={`https://www.rome2rio.com/s/${encodeURIComponent(originCity)}/${encodeURIComponent(plan.city)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-primary text-sm hover:underline"
              >
                Try all options on Rome2rio <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {availableOptions.map((opt, i) => (
                <RouteOptionCard key={i} option={opt} isPrimary={i === 0} />
              ))}
            </div>
          )}
        </>
      )}

      {!hasSearched && !isPending && (
        <div className="text-center py-16 text-muted-foreground/40 space-y-2">
          <Plane className="w-10 h-10 mx-auto" />
          <p className="text-sm">Enter your departure city and search for routes</p>
        </div>
      )}
    </div>
  );
}

// ── Before You Go ────────────────────────────────────────────────────────────

function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as T) : initial; }
    catch { return initial; }
  });
  const set = useCallback((v: T | ((p: T) => T)) => {
    setState(prev => {
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);
  return [state, set];
}

function CollapsibleSection({ title, icon: Icon, children, storageKey }: {
  title: string; icon: LucideIcon; children: React.ReactNode; storageKey: string;
}) {
  const [collapsed, setCollapsed] = useLocalStorage(storageKey, false);
  return (
    <div className="border border-border/60 rounded-sm">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-primary shrink-0" />
          <span className="font-serif text-2xl">{title}</span>
        </div>
        <motion.div animate={{ rotate: collapsed ? -90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Packing list ----------------------------------------------------------------

function PackingCategoryGroup({ category, checkedSet, onToggle }: {
  category: PackingCategory; checkedSet: Set<string>; onToggle: (label: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left mb-1 group"
      >
        <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.18 }}>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/70" />
        </motion.div>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
          {category.name}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-0 pl-5 mb-4">
              {category.items.map((item: PackingItem, i: number) => {
                const isChecked = checkedSet.has(item.label);
                return (
                  <label
                    key={i}
                    className={`flex items-start gap-3 py-2.5 min-h-[44px] cursor-pointer border-b border-border/30 last:border-0 ${isChecked ? "opacity-40" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggle(item.label)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${isChecked ? "line-through text-muted-foreground" : ""}`}>{item.label}</span>
                        {item.essential && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Essential" />}
                      </div>
                      {item.note && <p className="text-xs text-muted-foreground/60 mt-0.5">{item.note}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PackingListSection({ planId, packingList }: { planId: number; packingList: PackingList }) {
  const [checked, setChecked] = useLocalStorage<string[]>(`packing-checked-${planId}`, []);
  const checkedSet = new Set(checked);
  const allItems = packingList.categories.flatMap(c => c.items);
  const total = allItems.length;
  const doneCount = allItems.filter(item => checkedSet.has(item.label)).length;
  const progress = total > 0 ? (doneCount / total) * 100 : 0;

  const toggleItem = (label: string) => {
    setChecked(prev => {
      const s = new Set(prev);
      if (s.has(label)) s.delete(label); else s.add(label);
      return Array.from(s);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{doneCount} of {total} items packed</span>
        <button onClick={() => setChecked([])} className="text-xs text-muted-foreground/50 hover:text-muted-foreground underline underline-offset-2 transition-colors">
          Reset all
        </button>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden mb-5">
        <motion.div className="h-full bg-primary" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
      </div>
      {packingList.categories.map((cat: PackingCategory, ci: number) => (
        <PackingCategoryGroup key={ci} category={cat} checkedSet={checkedSet} onToggle={toggleItem} />
      ))}
    </div>
  );
}

// Budget estimator ------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  "entry": "border-l-amber-400",
  "transport": "border-l-blue-400",
  "lunch": "border-l-green-400",
  "dinner": "border-l-green-400",
  "snack": "border-l-green-400",
  "food": "border-l-green-400",
  "accommodation": "border-l-purple-400",
};

function categoryBorderColor(cat: string): string {
  const lower = cat.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_COLORS)) {
    if (lower.includes(key)) return val;
  }
  return "border-l-border";
}

function groupSizeFromTravellerType(tt: string): number {
  if (tt === "couple") return 2;
  if (tt === "family" || tt === "group") return 4;
  return 1;
}

function BudgetDayRow({ day, sym, multiplier, edits, onEdit, onReset }: {
  day: BudgetDay; sym: string; multiplier: number;
  edits: Record<string, number>; onEdit: (k: string, v: number) => void; onReset: (k: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const dayTotal = day.items.reduce((sum, item) => {
    const key = `${day.day}-${item.description}`;
    const cost = edits[key] ?? item.estimatedCost;
    return sum + cost;
  }, 0) * multiplier;

  return (
    <div className="border border-border/50">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.18 }}>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </motion.div>
          <span className="font-medium text-sm">
            Day {day.day}
            {day.date && <span className="text-muted-foreground font-normal"> · {day.date}</span>}
          </span>
        </div>
        <span className="font-mono text-sm text-primary">~{sym}{Math.round(dayTotal)}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {day.items.map((item: BudgetLine, i: number) => {
                const key = `${day.day}-${item.description}`;
                const editedCost = edits[key] ?? item.estimatedCost;
                return (
                  <div key={i} className={`flex items-start gap-3 p-3 border-l-2 bg-muted/10 ${categoryBorderColor(item.category)}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{item.description}</p>
                      {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
                      <p className="text-xs text-muted-foreground/60 uppercase tracking-wider mt-1">{item.category}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-muted-foreground">{sym}</span>
                      <input
                        type="number"
                        value={Math.round(editedCost * multiplier)}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v)) onEdit(key, v / multiplier);
                        }}
                        className="w-16 text-right text-sm bg-transparent border-b border-border/50 focus:border-primary outline-none font-mono"
                        min={0}
                      />
                      {edits[key] !== undefined && (
                        <button onClick={() => onReset(key)} className="text-muted-foreground/40 hover:text-muted-foreground text-xs" title="Reset">↺</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BudgetEstimatorSection({ planId, budgetEstimate, travellerType }: {
  planId: number; budgetEstimate: BudgetEstimate; travellerType: string;
}) {
  const groupSize = groupSizeFromTravellerType(travellerType);
  const [perPerson, setPerPerson] = useLocalStorage(`budget-perperson-${planId}`, false);
  const [edits, setEdits] = useLocalStorage<Record<string, number>>(`budget-edits-${planId}`, {});

  const multiplier = perPerson ? 1 : groupSize;
  const sym = budgetEstimate.currencySymbol;

  const onEdit = (key: string, val: number) => setEdits(prev => ({ ...prev, [key]: val }));
  const onReset = (key: string) => setEdits(prev => { const n = { ...prev }; delete n[key]; return n; });
  const onResetAll = () => setEdits({});

  const totalDailyBase = budgetEstimate.dailyBreakdown.reduce((sum, day) => {
    return sum + day.items.reduce((ds, item) => {
      const key = `${day.day}-${item.description}`;
      return ds + (edits[key] ?? item.estimatedCost);
    }, 0);
  }, 0);

  const totalFixed = budgetEstimate.fixedCosts.reduce((sum, fc) => {
    const key = `fixed-${fc.description}`;
    return sum + (edits[key] ?? fc.totalEstimated);
  }, 0);

  const totalLow = Math.round((totalDailyBase + totalFixed) * multiplier * 0.9);
  const totalMid = Math.round((totalDailyBase + totalFixed) * multiplier);
  const totalHigh = Math.round((totalDailyBase + totalFixed) * multiplier * 1.2);

  const tierBadgeColor = budgetEstimate.budgetTier === "budget"
    ? "text-green-400 border-green-400/30 bg-green-400/10"
    : budgetEstimate.budgetTier === "luxury"
    ? "text-purple-400 border-purple-400/30 bg-purple-400/10"
    : "text-blue-400 border-blue-400/30 bg-blue-400/10";

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium uppercase tracking-widest px-2 py-1 border ${tierBadgeColor}`}>
            {budgetEstimate.budgetTier}
          </span>
          <span className="text-muted-foreground text-sm">
            Estimated: {sym}{totalLow.toLocaleString()} – {sym}{totalHigh.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {Object.keys(edits).length > 0 && (
            <button onClick={onResetAll} className="text-xs text-muted-foreground/50 hover:text-muted-foreground underline underline-offset-2 transition-colors">
              Reset to estimates
            </button>
          )}
          {groupSize > 1 && (
            <div className="flex border border-border overflow-hidden text-xs">
              <button
                onClick={() => setPerPerson(true)}
                className={`px-3 py-1.5 transition-colors ${perPerson ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Per person
              </button>
              <button
                onClick={() => setPerPerson(false)}
                className={`px-3 py-1.5 transition-colors ${!perPerson ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Total
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Daily breakdown */}
      <div className="space-y-2">
        {budgetEstimate.dailyBreakdown.map((day: BudgetDay, i: number) => (
          <BudgetDayRow key={i} day={day} sym={sym} multiplier={multiplier} edits={edits} onEdit={onEdit} onReset={onReset} />
        ))}
      </div>

      {/* Fixed costs */}
      {budgetEstimate.fixedCosts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Fixed Costs</p>
          {budgetEstimate.fixedCosts.map((fc: FixedCost, i: number) => {
            const key = `fixed-${fc.description}`;
            const editedTotal = edits[key] ?? fc.totalEstimated;
            return (
              <div key={i} className={`flex items-start gap-3 p-3 border-l-2 bg-muted/10 ${categoryBorderColor(fc.category)}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{fc.description}</p>
                  {fc.notes && <p className="text-xs text-muted-foreground mt-0.5">{fc.notes}</p>}
                  <p className="text-xs text-muted-foreground/60 uppercase tracking-wider mt-1">{sym}{fc.estimatedCostPerNight}/night</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground">{sym}</span>
                  <input
                    type="number"
                    value={Math.round(editedTotal * multiplier)}
                    onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onEdit(key, v / multiplier); }}
                    className="w-20 text-right text-sm bg-transparent border-b border-border/50 focus:border-primary outline-none font-mono"
                    min={0}
                  />
                  {edits[key] !== undefined && (
                    <button onClick={() => onReset(key)} className="text-muted-foreground/40 hover:text-muted-foreground text-xs" title="Reset">↺</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary card */}
      <div className="border border-border p-5 bg-muted/10 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Accommodation</span>
          <span className="font-mono">{sym}{Math.round(totalFixed * multiplier).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Daily expenses</span>
          <span className="font-mono">~{sym}{Math.round(totalDailyBase * multiplier).toLocaleString()}</span>
        </div>
        <div className="border-t border-border/50 pt-2 mt-2 flex justify-between font-medium">
          <span>Estimated total</span>
          <span className="font-mono text-primary">{sym}{totalLow.toLocaleString()} – {sym}{totalHigh.toLocaleString()}</span>
        </div>
        {groupSize > 1 && !perPerson && (
          <p className="text-xs text-muted-foreground/50 text-right">For {groupSize} people</p>
        )}
      </div>

      {/* Local tips */}
      {budgetEstimate.localTips.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Money-saving Tips</p>
          {budgetEstimate.localTips.map((tip: string, i: number) => (
            <div key={i} className="flex gap-3 text-sm text-muted-foreground py-2 border-b border-border/30 last:border-0">
              <span className="text-primary shrink-0 mt-0.5">→</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Trip checklist -------------------------------------------------------------

function ChecklistCategoryGroup({ category, checkedSet, onToggle }: {
  category: ChecklistCategory; checkedSet: Set<string>; onToggle: (label: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left mb-1 group"
      >
        <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.18 }}>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/70" />
        </motion.div>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
          {category.name}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden"
          >
            <div className="pl-5 mb-4">
              {category.items.map((item: ChecklistItem, i: number) => {
                const isChecked = checkedSet.has(item.label);
                return (
                  <label
                    key={i}
                    className={`flex items-start gap-3 py-2.5 min-h-[44px] cursor-pointer border-b border-border/30 last:border-0 ${isChecked ? "opacity-40" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggle(item.label)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm ${isChecked ? "line-through text-muted-foreground" : ""}`}>{item.label}</span>
                        {item.essential && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Essential" />}
                        {item.link && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
                          >
                            {item.linkLabel ?? "Visit"} <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      {item.detail && <p className="text-xs text-muted-foreground/60 mt-0.5">{item.detail}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TripChecklistSection({ planId, tripChecklist }: { planId: number; tripChecklist: TripChecklist }) {
  const [checked, setChecked] = useLocalStorage<string[]>(`checklist-checked-${planId}`, []);
  const checkedSet = new Set(checked);
  const allItems = tripChecklist.categories.flatMap(c => c.items);
  const total = allItems.length;
  const doneCount = allItems.filter(item => checkedSet.has(item.label)).length;
  const progress = total > 0 ? (doneCount / total) * 100 : 0;

  const toggleItem = (label: string) => {
    setChecked(prev => {
      const s = new Set(prev);
      if (s.has(label)) s.delete(label); else s.add(label);
      return Array.from(s);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{doneCount} of {total} tasks done</span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden mb-5">
        <motion.div className="h-full bg-primary" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
      </div>
      {tripChecklist.categories.map((cat: ChecklistCategory, ci: number) => (
        <ChecklistCategoryGroup key={ci} category={cat} checkedSet={checkedSet} onToggle={toggleItem} />
      ))}
    </div>
  );
}

// Top-level tab component ----------------------------------------------------

function BeforeYouGoTab({ plan }: { plan: TravelPlan }) {
  const { tripChecklist, budgetEstimate, packingList } = plan as TravelPlan & {
    tripChecklist?: TripChecklist | null;
    budgetEstimate?: BudgetEstimate | null;
    packingList?: PackingList | null;
  };

  if (!tripChecklist && !budgetEstimate && !packingList) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
        <p className="text-lg mb-2">No "Before You Go" data yet.</p>
        <p className="text-sm">Regenerate the plan to get a packing list, budget estimate and trip checklist.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      {tripChecklist && (
        <CollapsibleSection title="Trip Checklist" icon={ClipboardList} storageKey={`btg-collapse-checklist-${plan.id}`}>
          <TripChecklistSection planId={plan.id} tripChecklist={tripChecklist} />
        </CollapsibleSection>
      )}
      {budgetEstimate && (
        <CollapsibleSection title="Budget Estimator" icon={Wallet} storageKey={`btg-collapse-budget-${plan.id}`}>
          <BudgetEstimatorSection planId={plan.id} budgetEstimate={budgetEstimate} travellerType={plan.travellerType} />
        </CollapsibleSection>
      )}
      {packingList && (
        <CollapsibleSection title="Packing List" icon={Package} storageKey={`btg-collapse-packing-${plan.id}`}>
          <PackingListSection planId={plan.id} packingList={packingList} />
        </CollapsibleSection>
      )}
    </div>
  );
}

// ── Sortable day wrapper ──────────────────────────────────────────────────────

function SortableDay({ dayOriginalIndex, reorderMode, day, children }: {
  dayOriginalIndex: number;
  reorderMode?: boolean;
  day?: PlanDay;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dayOriginalIndex });

  if (reorderMode && day) {
    return (
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        {...attributes}
        {...listeners}
        className={`flex items-center gap-3 px-4 py-3.5 border cursor-grab active:cursor-grabbing select-none transition-all ${
          isDragging
            ? "border-amber-400/60 bg-amber-950/30 shadow-lg shadow-amber-400/10 z-50 relative opacity-90"
            : "border-border bg-card hover:border-primary/40 hover:bg-card/80"
        }`}
      >
        <GripVertical className="w-5 h-5 text-muted-foreground/50 shrink-0" />
        <span className="font-serif text-lg text-primary shrink-0">Day {day.dayNumber}</span>
        <span className="text-muted-foreground/40 text-sm">—</span>
        <span className="text-sm text-foreground/70 truncate">{format(new Date(day.date), "EEEE, MMMM d")}</span>
        <span className="ml-auto text-xs text-muted-foreground/40 shrink-0 pl-4">
          {day.destinations.length} {day.destinations.length === 1 ? "stop" : "stops"}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="relative"
    >
      <button
        {...attributes}
        {...listeners}
        className="absolute -left-8 top-2 z-20 p-1 text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-colors touch-none"
        aria-label="Drag to reorder day"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      {children}
    </div>
  );
}

// ── Day section ─────────────────────────────────────────────────────────────

interface DaySectionProps {
  day: PlanDay;
  dayOriginalIndex: number;
  weatherByDate: Map<string, DayWeather>;
  isOwner: boolean;
  planId: number;
  destNoteMap: Map<string, string>;
  revealDelay?: number;
  onReorderDests: (destOrder: number[]) => void;
  onRemoveDest: (destIndex: number) => void;
}

function DaySection({ day, dayOriginalIndex, weatherByDate, isOwner, planId, destNoteMap, revealDelay = 0, onReorderDests, onRemoveDest }: DaySectionProps) {
  const handleMoveUp = (i: number) => {
    if (i === 0) return;
    const order = day.destinations.map((_, idx) => idx);
    [order[i - 1], order[i]] = [order[i], order[i - 1]];
    onReorderDests(order);
  };
  const handleMoveDown = (i: number) => {
    if (i >= day.destinations.length - 1) return;
    const order = day.destinations.map((_, idx) => idx);
    [order[i], order[i + 1]] = [order[i + 1], order[i]];
    onReorderDests(order);
  };

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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: revealDelay, duration: 0.3 }}
        className="space-y-8 relative z-10 pl-2 md:pl-8 border-l border-border/50"
      >
        {day.destinations.map((dest, i) => (
          <DestinationCard
            key={i}
            dest={dest}
            destIndex={i}
            dayIndex={dayOriginalIndex}
            planId={planId}
            isOwner={isOwner}
            savedNote={destNoteMap.get(`${dayOriginalIndex}-${i}`) ?? ""}
            isFirst={i === 0}
            isLast={i === day.destinations.length - 1}
            onMoveUp={() => handleMoveUp(i)}
            onMoveDown={() => handleMoveDown(i)}
            onRemove={() => onRemoveDest(i)}
          />
        ))}
      </motion.div>
    </div>
  );
}

// ── Destination card ─────────────────────────────────────────────────────────

interface DestinationCardProps {
  dest: Destination;
  destIndex: number;
  dayIndex: number;
  planId: number;
  isOwner: boolean;
  savedNote: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function DestinationCard({ dest, destIndex, dayIndex, planId, isOwner, savedNote, isFirst, isLast, onMoveUp, onMoveDown, onRemove }: DestinationCardProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState(savedNote);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { mutate: saveNote, isPending: savingNote } = useUpsertDestinationNote();

  useEffect(() => { setNoteText(savedNote); }, [savedNote]);

  const handleSaveNote = () => {
    saveNote({ id: planId, dayIndex, destIndex, data: { note: noteText } }, {
      onSuccess: () => setNoteOpen(false),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      className="bg-card border border-border overflow-hidden relative group"
    >
      <div className="absolute -left-[5px] top-8 w-2 h-12 bg-primary rounded-r-sm" />

      {/* Owner controls */}
      {isOwner && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onMoveUp} disabled={isFirst} className="p-1.5 rounded-sm bg-background/70 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-all">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={onMoveDown} disabled={isLast} className="p-1.5 rounded-sm bg-background/70 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-all">
            <ChevronDownIcon className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setNoteOpen(o => !o)} className={`p-1.5 rounded-sm bg-background/70 backdrop-blur-sm border transition-all ${noteOpen || savedNote ? "border-primary/50 text-primary" : "border-border/50 text-muted-foreground hover:text-foreground"}`}>
            <StickyNote className="w-3.5 h-3.5" />
          </button>
          {confirmRemove ? (
            <>
              <button onClick={onRemove} className="px-2 py-1 text-[10px] font-medium uppercase tracking-widest rounded-sm bg-red-600/80 text-white border border-red-500">Remove</button>
              <button onClick={() => setConfirmRemove(false)} className="p-1.5 rounded-sm bg-background/70 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-foreground transition-all"><X className="w-3.5 h-3.5" /></button>
            </>
          ) : (
            <button onClick={() => setConfirmRemove(true)} className="p-1.5 rounded-sm bg-background/70 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-red-400 hover:border-red-400/50 hover:bg-red-950/50 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

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
          {/* Title + cost + time-of-day */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2 min-w-0">
              {dest.timeOfDay && (() => {
                const tod = dest.timeOfDay as string;
                const configs: Record<string, { label: string; Icon: typeof Sunrise; cls: string }> = {
                  morning: { label: "Morning", Icon: Sunrise, cls: "text-amber-300 border-amber-300/30 bg-amber-950/30" },
                  midday:  { label: "Midday",  Icon: Sun,     cls: "text-yellow-300 border-yellow-300/30 bg-yellow-950/30" },
                  evening: { label: "Evening", Icon: Moon,    cls: "text-indigo-300 border-indigo-300/30 bg-indigo-950/30" },
                };
                const cfg = configs[tod];
                if (!cfg) return null;
                const { label, Icon, cls } = cfg;
                return (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest px-2 py-0.5 border w-fit ${cls}`}>
                    <Icon className="w-3 h-3" />
                    {label}
                  </span>
                );
              })()}
              <h4 className="font-serif text-3xl text-foreground">{dest.name}</h4>
            </div>
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

          {/* Per-destination notes */}
          <AnimatePresence>
            {(noteOpen || savedNote) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2 text-xs font-medium text-primary uppercase tracking-widest mb-2">
                    <StickyNote className="w-3.5 h-3.5" /> My Notes
                  </div>
                  {isOwner && noteOpen ? (
                    <div className="space-y-2">
                      <textarea
                        autoFocus
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        rows={3}
                        className="w-full bg-muted/30 border border-border/50 text-foreground placeholder-muted-foreground text-sm p-3 resize-none outline-none focus:border-primary/50 transition-colors"
                        placeholder="Jot a personal note for this stop…"
                      />
                      <div className="flex gap-2">
                        <button onClick={handleSaveNote} disabled={savingNote} className="text-xs font-medium uppercase tracking-widest text-primary hover:text-foreground flex items-center gap-1 px-3 py-1.5 border border-primary/50 hover:border-primary transition-all disabled:opacity-50">
                          <Check className="w-3 h-3" /> {savingNote ? "Saving…" : "Save"}
                        </button>
                        <button onClick={() => { setNoteOpen(false); setNoteText(savedNote); }} className="text-xs font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 py-1.5 border border-border/50 hover:border-border transition-all">
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : savedNote ? (
                    <p className="text-sm text-muted-foreground italic">{savedNote}</p>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
