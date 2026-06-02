import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { addDays, format } from "date-fns";
import { 
  useGetCityPhoto, 
  useGeneratePlan,
  getGetCityPhotoQueryKey
} from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/navbar";
import { CinematicLoader } from "@/components/cinematic-loader";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const formSchema = z.object({
  dateRange: z.object({
    from: z.date({
      required_error: "A start date is required.",
    }),
    to: z.date({
      required_error: "An end date is required.",
    }),
  }).refine((data) => data.from <= data.to, {
    message: "End date cannot be before start date.",
    path: ["to"],
  }),
  budget: z.string().optional(),
  preferences: z.string().optional(),
  travellerType: z.string().min(1, "Please select who is travelling"),
});

export default function PlanBuilder() {
  const [, params] = useRoute("/plan/:city");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const city = decodeURIComponent(params?.city || "");
  const searchParams = new URLSearchParams(window.location.search);
  const country = searchParams.get("country") || "";

  const { data: cityPhoto } = useGetCityPhoto(
    { q: `${city} ${country} city landmark high quality` },
    { 
      query: { 
        enabled: !!city,
        queryKey: getGetCityPhotoQueryKey({ q: `${city} ${country} city landmark high quality` })
      } 
    }
  );

  const generateMutation = useGeneratePlan();
  const [showLoader, setShowLoader] = useState(false);
  const [progress, setProgress] = useState(0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      travellerType: "solo",
      budget: "mid-range",
      preferences: "",
    },
  });

  // Simulate progress bar during generation
  useEffect(() => {
    if (showLoader && generateMutation.isPending) {
      const interval = setInterval(() => {
        setProgress(p => Math.min(p + (90 - p) * 0.05, 90));
      }, 100);
      return () => clearInterval(interval);
    }
  }, [showLoader, generateMutation.isPending]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setShowLoader(true);
    setProgress(0);
    
    try {
      const result = await generateMutation.mutateAsync({
        data: {
          city,
          country,
          startDate: format(values.dateRange.from, "yyyy-MM-dd"),
          endDate: format(values.dateRange.to, "yyyy-MM-dd"),
          budget: values.budget,
          preferences: values.preferences,
          travellerType: values.travellerType,
        }
      });
      
      setProgress(100);
      
      // Brief pause to show 100%
      setTimeout(() => {
        setLocation(`/plan/${result.id}/view`);
      }, 800);
      
    } catch (error: any) {
      setShowLoader(false);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate your itinerary. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <CinematicLoader isVisible={showLoader} city={city} progress={progress} />
      
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-background relative flex flex-col"
      >
        {/* Full bleed background photo */}
        <div className="absolute inset-0 z-0">
          {cityPhoto?.photoUrl && (
            <motion.img 
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.6 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              src={cityPhoto.photoUrl} 
              alt={city}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/30" />
        </div>

        <Navbar />
        
        <main className="flex-1 flex items-center relative z-10 container mx-auto px-6 py-24">
          <div className="w-full max-w-xl">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              <h1 className="font-serif text-6xl md:text-7xl mb-2 text-white">
                {city}
              </h1>
              <p className="text-primary tracking-widest uppercase text-sm mb-12">
                {country}
              </p>

              <div className="bg-card/40 backdrop-blur-xl border border-border/50 p-8 shadow-2xl">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="dateRange"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Dates</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={`w-full justify-start text-left font-normal bg-background/50 border-border/50 rounded-none h-12 ${!field.value ? "text-muted-foreground" : ""}`}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                  {field.value?.from ? (
                                    field.value.to ? (
                                      <>
                                        {format(field.value.from, "LLL dd, y")} -{" "}
                                        {format(field.value.to, "LLL dd, y")}
                                      </>
                                    ) : (
                                      format(field.value.from, "LLL dd, y")
                                    )
                                  ) : (
                                    <span>Select your dates</span>
                                  )}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={field.value?.from}
                                selected={{ from: field.value?.from, to: field.value?.to }}
                                onSelect={(range) => field.onChange(range)}
                                numberOfMonths={2}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="travellerType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Who's going?</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-background/50 border-border/50 rounded-none h-12">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="solo">Solo</SelectItem>
                                <SelectItem value="couple">Couple</SelectItem>
                                <SelectItem value="family">Family</SelectItem>
                                <SelectItem value="group">Friends / Group</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="budget"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Style</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-background/50 border-border/50 rounded-none h-12">
                                  <SelectValue placeholder="Select budget" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="budget">Budget / Backpacker</SelectItem>
                                <SelectItem value="mid-range">Mid-range / Comfort</SelectItem>
                                <SelectItem value="luxury">Luxury / Premium</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="preferences"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Special Interests (Optional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="e.g. Specialty coffee, brutalist architecture, hidden speakeasies..." 
                              className="bg-background/50 border-border/50 rounded-none resize-none h-24 focus-visible:ring-primary" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-none h-14 text-lg font-serif tracking-wide"
                    >
                      Craft Itinerary
                    </Button>
                  </form>
                </Form>
              </div>
            </motion.div>
          </div>
        </main>
      </motion.div>
    </>
  );
}
