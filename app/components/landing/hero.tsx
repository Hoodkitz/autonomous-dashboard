"use client";

import Link from "next/link";

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-dim text-accent text-xs font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          Now in Public Beta
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
          Autonomous Monitoring
          <br />
          <span className="text-accent">That Never Sleeps</span>
        </h1>

        <p className="text-lg sm:text-xl text-muted max-w-2xl mx-auto mb-10">
          Monitor your infrastructure, applications, and business metrics 24/7.
          AI-powered alerts, automated reports, and intelligent analytics — all in one dashboard.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="#pricing"
            className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-white px-8 py-3 rounded-lg font-medium transition-colors text-center"
          >
            Start Free Trial
          </Link>
          <Link
            href="/engine"
            className="w-full sm:w-auto border border-card-border hover:border-muted text-foreground px-8 py-3 rounded-lg font-medium transition-colors text-center"
          >
            View Live Demo
          </Link>
        </div>

        <div className="mt-16 relative">
          <div className="bg-card border border-card-border rounded-2xl p-1 shadow-2xl">
            <div className="bg-background rounded-xl p-6 sm:p-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-success">99.9%</div>
                  <div className="text-xs text-muted mt-1">Uptime</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-accent">&lt;30s</div>
                  <div className="text-xs text-muted mt-1">Alert Latency</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-purple">50+</div>
                  <div className="text-xs text-muted mt-1">Integrations</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-cyan">24/7</div>
                  <div className="text-xs text-muted mt-1">Monitoring</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
