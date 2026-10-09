import type { Metadata } from "next";
import { Navbar } from "./components/landing/navbar";
import { Hero } from "./components/landing/hero";
import { Features } from "./components/landing/features";
import { Pricing } from "./components/landing/pricing";
import { FAQ } from "./components/landing/faq";
import { Footer } from "./components/landing/footer";

export const metadata: Metadata = {
  title: "Autonomous Dashboard — Autonomes Monitoring für moderne Infrastrukturen",
  description:
    "Monitor deine Infrastruktur, Applikationen und Business-Metriken 24/7. KI-gestützte Alerts, automatisierte Reports und intelligente Analytics — alles in einem Dashboard.",
  keywords: [
    "monitoring",
    "autonomous",
    "dashboard",
    "alerts",
    "analytics",
    "automation",
    "devops",
    "infrastructure",
  ],
  openGraph: {
    title: "Autonomous Dashboard — Autonomes Monitoring",
    description:
      "KI-gestützte Alerts, automatisierte Reports und intelligente Analytics — alles in einem Dashboard.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <Hero />
      <Features />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  );
}
