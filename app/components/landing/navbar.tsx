"use client";

import { useState } from "react";
import Link from "next/link";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-card-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-lg">Autonomous</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-muted hover:text-foreground transition-colors text-sm">
              Features
            </a>
            <a href="#pricing" className="text-muted hover:text-foreground transition-colors text-sm">
              Pricing
            </a>
            <a href="#faq" className="text-muted hover:text-foreground transition-colors text-sm">
              FAQ
            </a>
            <Link
              href="/engine"
              className="text-muted hover:text-foreground transition-colors text-sm"
            >
              Dashboard
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/engine"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="#pricing"
              className="text-sm bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>

          <button
            className="md:hidden p-2 text-muted hover:text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-card-border bg-background">
          <div className="px-4 py-4 space-y-3">
            <a href="#features" className="block text-muted hover:text-foreground text-sm" onClick={() => setMobileOpen(false)}>
              Features
            </a>
            <a href="#pricing" className="block text-muted hover:text-foreground text-sm" onClick={() => setMobileOpen(false)}>
              Pricing
            </a>
            <a href="#faq" className="block text-muted hover:text-foreground text-sm" onClick={() => setMobileOpen(false)}>
              FAQ
            </a>
            <Link href="/engine" className="block text-muted hover:text-foreground text-sm" onClick={() => setMobileOpen(false)}>
              Dashboard
            </Link>
            <div className="pt-3 border-t border-card-border">
              <Link
                href="#pricing"
                className="block text-center bg-accent text-white px-4 py-2 rounded-lg text-sm"
                onClick={() => setMobileOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
