import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useGetCityAutocomplete, getGetCityAutocompleteQueryKey, CityOption } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";

export function CitySearch() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: suggestions, isLoading } = useGetCityAutocomplete(
    { q: debouncedQuery },
    { query: { enabled: debouncedQuery.length > 1, queryKey: getGetCityAutocompleteQueryKey({ q: debouncedQuery }) } }
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (city: CityOption) => {
    setIsOpen(false);
    setLocation(`/plan/${encodeURIComponent(city.city)}?country=${encodeURIComponent(city.country)}&countryCode=${encodeURIComponent(city.countryCode)}`);
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto" ref={containerRef}>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        </div>
        <Input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Where to next? Try 'Tokyo' or 'Rome'..."
          className="w-full pl-12 pr-4 py-6 text-lg bg-background/40 backdrop-blur-md border-border/50 text-foreground rounded-none focus-visible:ring-primary/50 focus-visible:border-primary placeholder:text-muted-foreground shadow-2xl"
        />
      </div>

      <AnimatePresence>
        {isOpen && query.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full mt-2 w-full bg-card border border-border rounded-none shadow-2xl z-50 max-h-80 overflow-y-auto"
          >
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Consulting the maps...</div>
            ) : suggestions && suggestions.length > 0 ? (
              <ul className="py-2">
                {suggestions.map((city, idx) => (
                  <li key={`${city.city}-${city.countryCode}-${idx}`}>
                    <button
                      onClick={() => handleSelect(city)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-center gap-3 transition-colors"
                    >
                      <MapPin className="h-4 w-4 text-primary" />
                      <div>
                        <div className="font-medium text-foreground">{city.city}</div>
                        <div className="text-sm text-muted-foreground">{city.country}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-muted-foreground text-sm">No cities found matching that name.</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
