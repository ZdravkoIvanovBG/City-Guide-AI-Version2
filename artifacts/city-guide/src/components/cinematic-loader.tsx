import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const phrases = [
  "Wandering the alleyways of {city}...",
  "Negotiating at the spice market...",
  "Finding the best table in the house...",
  "Consulting the locals...",
  "Mapping secret shortcuts...",
  "Scanning the horizon from above..."
];

export function CinematicLoader({ 
  isVisible, 
  city = "the city", 
  progress = 0 
}: { 
  isVisible: boolean; 
  city?: string;
  progress?: number;
}) {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % phrases.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm"
        >
          <div className="w-full max-w-md px-6 text-center space-y-12">
            <div className="h-16 relative flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.h2
                  key={phraseIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5 }}
                  className="absolute text-xl md:text-2xl font-serif text-primary/80 font-medium"
                >
                  {phrases[phraseIndex].replace("{city}", city)}
                </motion.h2>
              </AnimatePresence>
            </div>

            <div className="w-full h-1 bg-muted rounded-full overflow-hidden relative">
              <motion.div
                className="absolute top-0 left-0 h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            
            <div className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
              {Math.round(progress)}%
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
