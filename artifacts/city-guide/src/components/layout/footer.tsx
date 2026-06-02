import { Link } from "wouter";

const InstagramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
  </svg>
);

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const TikTokIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.26 6.26 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z" />
  </svg>
);

export function Footer() {
  return (
    <footer style={{ backgroundColor: "#05080a" }} className="border-t border-border/30 text-muted-foreground">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Column 1 — Branding */}
          <div className="space-y-5">
            <div>
              <h3 className="font-serif text-2xl text-foreground tracking-wide">City Guide</h3>
              <p className="text-sm text-muted-foreground/70 mt-1.5 font-light">
                Cinematic itineraries crafted by AI.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <a href="#" aria-label="Instagram" className="text-muted-foreground/50 hover:text-primary transition-colors">
                <InstagramIcon />
              </a>
              <a href="#" aria-label="X / Twitter" className="text-muted-foreground/50 hover:text-primary transition-colors">
                <XIcon />
              </a>
              <a href="#" aria-label="TikTok" className="text-muted-foreground/50 hover:text-primary transition-colors">
                <TikTokIcon />
              </a>
            </div>
          </div>

          {/* Column 2 — Product */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-widest text-foreground/60 font-medium">Product</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/" className="hover:text-foreground transition-colors">Home</Link></li>
              <li><Link href="/#how-it-works" className="hover:text-foreground transition-colors">How it works</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
              <li><Link href="/plan/Tokyo" className="hover:text-foreground transition-colors">Generate a plan</Link></li>
            </ul>
          </div>

          {/* Column 3 — Legal & Info */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-widest text-foreground/60 font-medium">Legal</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link href="/conduct" className="hover:text-foreground transition-colors">Community Guidelines</Link></li>
              <li>
                <a href="mailto:hello@cityguide.app" className="hover:text-foreground transition-colors">
                  Contact us
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4 — Account */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-widest text-foreground/60 font-medium">Account</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/register" className="hover:text-foreground transition-colors">Sign up</Link></li>
              <li><Link href="/login" className="hover:text-foreground transition-colors">Log in</Link></li>
              <li><Link href="/profile" className="hover:text-foreground transition-colors">Profile</Link></li>
              <li><Link href="/profile" className="hover:text-foreground transition-colors">My plans</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-border/20">
          <p className="text-xs text-muted-foreground/40 text-center md:text-left">
            © 2025 City Guide. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
