"use client";

import { useState } from "react";
import Link from "next/link";

interface Plan {
  id: "starter" | "pro" | "enterprise";
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  cta: string;
}

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    period: "/Monat",
    description: "Für kleine Teams und Projekte",
    features: [
      "5 Monitore",
      "Basis-Alerts",
      "Tägliche Reports",
      "7 Tage Datenaufbewahrung",
      "E-Mail Support",
      "Community Zugang",
    ],
    cta: "Starter wählen",
  },
  {
    id: "pro",
    name: "Professional",
    price: 59,
    period: "/Monat",
    description: "Für wachsende Teams",
    features: [
      "25 Monitore",
      "Smart Alerts mit AI",
      "Wöchentliche Reports",
      "30 Tage Datenaufbewahrung",
      "Slack & Telegram Integration",
      "Workflow Automation",
      "Prioritäts-Support",
      "API Zugang",
    ],
    popular: true,
    cta: "Professional wählen",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 99,
    period: "/Monat",
    description: "Für große Organisationen",
    features: [
      "Unbegrenzte Monitore",
      "Erweiterte AI-Analytics",
      "Echtzeit-Reports",
      "Unbegrenzte Datenaufbewahrung",
      "Alle Integrationen",
      "Custom Workflows",
      "Dedizierter Support",
      "SLA 99.9%",
      "On-Premise Option",
      "SSO & SAML",
    ],
    cta: "Enterprise wählen",
  },
];

export function Pricing() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (planId: string) => {
    setLoading(planId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Checkout konnte nicht gestartet werden. Bitte versuche es später erneut.");
      }
    } catch {
      alert("Ein Fehler ist aufgetreten. Bitte versuche es später erneut.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-card/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Einfache, transparente Preise
          </h2>
          <p className="text-muted max-w-2xl mx-auto">
            Keine versteckten Kosten. Jederzeit kündbar. 14 Tage kostenlos testen.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-card border rounded-2xl p-6 lg:p-8 flex flex-col ${
                plan.popular
                  ? "border-accent shadow-lg shadow-accent/10 scale-[1.02]"
                  : "border-card-border"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-medium px-3 py-1 rounded-full">
                  Beliebt
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-1">{plan.name}</h3>
                <p className="text-muted text-sm">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold">{plan.price}€</span>
                <span className="text-muted text-sm">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <svg
                      className="w-5 h-5 text-success shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-muted">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={loading !== null}
                className={`w-full py-3 rounded-lg font-medium transition-colors ${
                  plan.popular
                    ? "bg-accent hover:bg-accent/90 text-white"
                    : "border border-card-border hover:border-muted text-foreground"
                } ${loading === plan.id ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {loading === plan.id ? "Lädt..." : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-muted text-sm mt-8">
          Alle Preise inkl. MwSt. Monatlich kündbar.{" "}
          <Link href="#faq" className="text-accent hover:underline">
            Häufige Fragen
          </Link>
        </p>
      </div>
    </section>
  );
}
