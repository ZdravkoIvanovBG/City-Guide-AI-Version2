import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { PlanSummary, useDeletePlan } from "@workspace/api-client-react";
import { MapPin, Calendar, Users, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { getGetPlansQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function PlanCard({ plan, index = 0 }: { plan: PlanSummary; index?: number }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mutate: deletePlan, isPending } = useDeletePlan();

  const handleDelete = () => {
    deletePlan(
      { id: plan.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPlansQueryKey() });
          toast({ title: "Plan deleted", description: `${plan.city} itinerary removed.` });
        },
        onError: () => {
          toast({ title: "Delete failed", description: "Could not delete the plan. Please try again.", variant: "destructive" });
        },
      },
    );
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.35, delay: index * 0.05 }}
        className="shrink-0 w-80 md:w-96 group snap-center relative"
      >
        {/* Delete button */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmOpen(true); }}
          className="absolute top-3 right-3 z-20 p-1.5 rounded-sm bg-background/70 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-red-400 hover:border-red-400/50 hover:bg-red-950/50 transition-all opacity-0 group-hover:opacity-100"
          aria-label="Delete plan"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <Link href={`/plan/${plan.id}/view`} className="block h-full relative overflow-hidden bg-card border border-border hover:border-primary/40 transition-colors">
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-card border-border rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-2xl">Delete this plan?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Your <span className="text-foreground font-medium">{plan.city}</span> itinerary will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none border-border hover:bg-muted">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-none bg-red-600 hover:bg-red-700 text-white border-0"
            >
              {isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
