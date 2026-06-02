import { motion } from "framer-motion";
import { Link } from "wouter";
import { useGetFeaturedCities } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { CitySearch } from "@/components/city-search";
import { Check } from "lucide-react";

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Choose your city",
    desc: "Search any destination in the world — from Tokyo to Tangier.",
  },
  {
    step: "2",
    title: "Set your preferences",
    desc: "Pick your dates, travel style, and budget in seconds.",
  },
  {
    step: "3",
    title: "Get your AI plan",
    desc: "Receive a fully curated itinerary with hotels, restaurants, and insider tips.",
  },
];

const FREE_FEATURES = [
  "3 AI plans per month",
  "Up to 4 days per plan",
  "Itinerary + Restaurants tabs",
  "Save plans to profile",
];

const PRO_FEATURES = [
  "Unlimited AI plans",
  "Up to 7 days per plan",
  "All tabs — Itinerary, Hotels, Restaurants, Misc",
  "3D world map on profile",
  "Export to PDF",
  "Share plan via public link",
  "Priority generation",
];

const TESTIMONIALS = [
  {
    quote: "Planned my entire Tokyo trip in 30 seconds. The insider tips were spot on.",
    name: "Marco",
    country: "Italy",
    flag: "🇮🇹",
    initials: "M",
  },
  {
    quote: "Finally visited cities I'd never have discovered on my own. This completely changed how I travel.",
    name: "Priya",
    country: "United Kingdom",
    flag: "🇬🇧",
    initials: "P",
  },
  {
    quote: "The restaurant picks alone were worth it. Every single one was exceptional.",
    name: "James",
    country: "Canada",
    flag: "🇨🇦",
    initials: "J",
  },
];

export default function Home() {
  const { data: featuredCities, isLoading } = useGetFeaturedCities();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-background text-foreground"
    >
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative h-[80vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-background/80" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[120px]" />
        </div>

        <div className="container relative z-10 mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 1 }}
            className="space-y-6 max-w-4xl mx-auto"
          >
            <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-tight">
              Design your <br />
              <span className="text-primary italic">perfect escape.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground font-light max-w-2xl mx-auto">
              Curated, cinematic itineraries for the world's most captivating cities, crafted by AI in seconds.
            </p>
            <div className="pt-8">
              <CitySearch />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Featured Cities ── */}
      <section className="py-24 bg-card">
        <div className="container mx-auto px-6">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="font-serif text-4xl mb-4">Featured Destinations</h2>
              <p className="text-muted-foreground">Handpicked cities for your next adventure.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-96 bg-muted animate-pulse" />
                ))
              : featuredCities?.map((city, idx) => (
                  <motion.div
                    key={`${city.city}-${city.country}`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ delay: idx * 0.1, duration: 0.8 }}
                  >
                    <Link
                      href={`/plan/${encodeURIComponent(city.city)}?country=${encodeURIComponent(city.country)}`}
                      className="group block relative h-96 overflow-hidden"
                    >
                      <img
                        src={city.photoUrl}
                        alt={city.city}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-500" />
                      <div className="absolute inset-0 p-8 flex flex-col justify-end">
                        <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                          <span className="text-primary text-sm font-bold tracking-widest uppercase mb-2 block">
                            {city.country}
                          </span>
                          <h3 className="font-serif text-4xl text-white mb-2">{city.city}</h3>
                          <p className="text-gray-300 font-light opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                            {city.tagline}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-28 bg-background">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <p className="text-xs uppercase tracking-widest text-primary mb-4">Simple. Fast. Beautiful.</p>
            <h2 className="font-serif text-4xl md:text-5xl">How it works</h2>
          </motion.div>

          <div className="relative">
            {/* Connecting line — desktop only */}
            <div className="hidden md:block absolute top-9 left-[calc(16.67%+2.5rem)] right-[calc(16.67%+2.5rem)] h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8">
              {HOW_IT_WORKS.map((item, idx) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: idx * 0.15, duration: 0.7 }}
                  className="text-center relative z-10"
                >
                  {/* Outlined serif number */}
                  <div className="w-20 h-20 mx-auto mb-8 flex items-center justify-center bg-background border border-border/40">
                    <span
                      className="font-serif text-5xl leading-none"
                      style={{ WebkitTextStroke: "1px rgba(212, 168, 67, 0.55)", color: "transparent" }}
                    >
                      {item.step}
                    </span>
                  </div>
                  <h3 className="font-serif text-2xl mb-3 text-foreground">{item.title}</h3>
                  <p className="text-muted-foreground font-light leading-relaxed max-w-xs mx-auto">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Plans & Pricing ── */}
      <section className="py-28 bg-card">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-widest text-primary mb-4">No credit card required</p>
            <h2 className="font-serif text-4xl md:text-5xl">Plans for every traveller</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free plan */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7 }}
              className="bg-background border border-border p-10 flex flex-col"
            >
              <div className="mb-8">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Explorer</p>
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-5xl text-foreground">Free</span>
                </div>
                <p className="text-muted-foreground text-sm mt-3 font-light">Everything you need to start exploring.</p>
              </div>

              <ul className="space-y-4 mb-10 flex-1">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className="block text-center py-3.5 px-8 border border-border text-foreground hover:border-primary/60 hover:text-primary transition-colors text-sm font-medium tracking-wide"
              >
                Get started free
              </Link>
            </motion.div>

            {/* Pro plan */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7 }}
              className="relative p-10 flex flex-col pro-card-glow"
              style={{ background: "linear-gradient(135deg, #0d1117 0%, #0f1318 100%)" }}
            >
              {/* Amber border via outline */}
              <div className="absolute inset-0 border border-primary/40 pointer-events-none" />

              <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs uppercase tracking-widest text-primary">Voyager</p>
                  <span className="text-[10px] uppercase tracking-widest bg-primary text-primary-foreground px-2 py-0.5 font-medium">
                    Pro
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-5xl text-foreground">$9</span>
                  <span className="text-muted-foreground text-sm font-light">/month</span>
                </div>
                <p className="text-muted-foreground text-sm mt-3 font-light">Unlimited exploration, zero limits.</p>
              </div>

              <ul className="space-y-4 mb-10 flex-1">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/pricing"
                className="block text-center py-3.5 px-8 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium tracking-wide"
              >
                Upgrade to Pro
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-28 bg-background">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-widest text-primary mb-4">From our travellers</p>
            <h2 className="font-serif text-4xl md:text-5xl">Stories from the road</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t, idx) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: idx * 0.12, duration: 0.7 }}
                className="bg-card/50 p-8 flex flex-col gap-6"
              >
                {/* Quote mark */}
                <span className="font-serif text-5xl text-primary/30 leading-none select-none">"</span>

                <p className="text-foreground/80 font-light leading-relaxed text-[15px] -mt-4 flex-1">
                  {t.quote}
                </p>

                <div className="flex items-center gap-4 pt-2 border-t border-border/30">
                  <div className="w-10 h-10 rounded-full bg-muted border border-border/50 flex items-center justify-center font-serif text-primary text-lg shrink-0">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-medium">{t.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {t.flag} {t.country}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <Footer />
    </motion.div>
  );
}
