import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

function PlaceholderPage({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-6 pt-24 pb-20">
        <div className="text-center max-w-lg">
          <p className="text-xs uppercase tracking-widest text-primary mb-6">City Guide</p>
          <h1 className="font-serif text-5xl md:text-6xl mb-6">{title}</h1>
          <p className="text-muted-foreground text-lg font-light">
            {subtitle ?? "This page is coming soon."}
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export function PricingPage() {
  return <PlaceholderPage title="Pricing" subtitle="Our Pro plan is coming soon. Stay tuned for updates." />;
}

export function TermsPage() {
  return <PlaceholderPage title="Terms of Service" />;
}

export function PrivacyPage() {
  return <PlaceholderPage title="Privacy Policy" />;
}

export function ConductPage() {
  return <PlaceholderPage title="Community Guidelines" />;
}
