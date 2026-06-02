import { motion } from "framer-motion";
import { Link } from "wouter";
import { PlanSummary } from "@workspace/api-client-react";
import { MapPin, Calendar, Users } from "lucide-react";
import { format } from "date-fns";

export function PlanCard({ plan, index = 0 }: { plan: PlanSummary; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="shrink-0 w-80 md:w-96 group cursor-pointer snap-center"
    >
      <Link href={`/plan/${plan.id}/view`} className="block h-full relative overflow-hidden bg-card border border-border">
        <div className="h-64 relative overflow-hidden">
          {plan.photoUrl ? (
            <img 
              src={plan.photoUrl} 
              alt={`${plan.city} cover`}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <MapPin className="w-12 h-12 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
          
          <div className="absolute bottom-0 left-0 w-full p-6 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
            <h3 className="font-serif text-3xl text-white mb-1">{plan.city}</h3>
            <p className="text-primary text-sm font-medium tracking-widest uppercase">{plan.country}</p>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <Calendar className="w-4 h-4 text-primary" />
            <span>{format(new Date(plan.startDate), "MMM d")} - {format(new Date(plan.endDate), "MMM d, yyyy")}</span>
          </div>
          
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <Users className="w-4 h-4 text-primary" />
            <span className="capitalize">{plan.travellerType} Trip</span>
            {plan.budget && (
              <>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span className="capitalize">{plan.budget} Budget</span>
              </>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
