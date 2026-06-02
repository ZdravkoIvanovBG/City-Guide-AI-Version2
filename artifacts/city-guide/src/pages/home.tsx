import { motion } from "framer-motion";
import { Link } from "wouter";
import { useGetFeaturedCities } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/navbar";
import { CitySearch } from "@/components/city-search";
import { ArrowRight } from "lucide-react";

export default function Home() {
  const { data: featuredCities, isLoading } = useGetFeaturedCities();

  return (
    <motion.div 
      initial="initial"
      animate="in"
      exit="out"
      variants={{
        initial: { opacity: 0 },
        in: { opacity: 1, transition: { duration: 0.6 } },
        out: { opacity: 0 }
      }}
      className="min-h-screen bg-background text-foreground"
    >
      <Navbar />

      {/* Hero Section */}
      <section className="relative h-[80vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Abstract background gradient to simulate city lights / atmospheric fog */}
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
              Design your <br/>
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

      {/* Featured Cities */}
      <section className="py-24 bg-card">
        <div className="container mx-auto px-6">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="font-serif text-4xl mb-4">Featured Destinations</h2>
              <p className="text-muted-foreground">Handpicked cities for your next adventure.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              // Skeletons
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-96 bg-muted animate-pulse rounded-none" />
              ))
            ) : (
              featuredCities?.map((city, idx) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: idx * 0.1, duration: 0.8 }}
                  key={`${city.city}-${city.country}`}
                >
                  <Link href={`/plan/${encodeURIComponent(city.city)}?country=${encodeURIComponent(city.country)}`} className="group block relative h-96 overflow-hidden">
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
              ))
            )}
          </div>
        </div>
      </section>
    </motion.div>
  );
}
