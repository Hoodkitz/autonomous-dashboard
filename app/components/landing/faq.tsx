"use client";

import { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "Wie funktioniert der kostenlose Test?",
    answer:
      "Du erhältst 14 Tage vollen Zugriff auf alle Features des Professional-Plans. Keine Kreditkarte erforderlich. Nach dem Test kannst du ein Abo abschließen oder dein Konto wird auf den kostenlosen Tier heruntergestuft.",
  },
  {
    question: "Kann ich jederzeit kündigen?",
    answer:
      "Ja, du kannst dein Abo jederzeit mit einem Klick kündigen. Es gibt keine Mindestlaufzeit und keine Kündigungsfristen. Dein Zugang bleibt bis zum Ende des bezahlten Zeitraums aktiv.",
  },
  {
    question: "Welche Zahlungsmethoden werden akzeptiert?",
    answer:
      "Wir akzeptieren alle gängigen Kreditkarten (Visa, Mastercard, American Express) über Stripe. Die Zahlung ist SSL-verschlüsselt und PCI-DSS konform.",
  },
  {
    question: "Wie werden meine Daten geschützt?",
    answer:
      "Alle Daten werden verschlüsselt übertragen (TLS 1.3) und gespeichert (AES-256). Wir hosten in EU-Datenzentren und sind DSGVO-konform. Deine Daten werden niemals an Dritte weitergegeben.",
  },
  {
    question: "Gibt es eine API für eigene Integrationen?",
    answer:
      "Ja, alle Plans (ab Starter) erhalten Zugang zu unserer REST-API mit Webhooks. Wir bieten SDKs für Python, JavaScript, TypeScript und Go. Die API-Dokumentation findest du in unserem Developer Portal.",
  },
  {
    question: "Was passiert, wenn ich die Monitor-Grenze erreiche?",
    answer:
      "Du erhältst eine Benachrichtigung, bevor du die Grenze erreichst. Du kannst entweder ein höheres Abo buchen oder inaktive Monitore archivieren. Es werden keine Daten gelöscht.",
  },
  {
    question: "Kann ich später den Plan wechseln?",
    answer:
      "Ja, du kannst jederzeit upgraden oder downgraden. Bei einem Upgrade wird der neue Preis anteilig berechnet. Bei einem Downgrade wird die Differenz als Guthaben angerechnet.",
  },
  {
    question: "Bietet ihr Support für die Einrichtung?",
    answer:
      "Der Professional-Plan enthält E-Mail Support mit Antwortzeit unter 24 Stunden. Enterprise-Kunden erhalten einen dedizierten Support-Kanal mit garantierter Antwortzeit unter 4 Stunden.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Häufige Fragen
          </h2>
          <p className="text-muted">
            Alles, was du wissen musst. Keine Antwort dabei?{" "}
            <a href="mailto:support@autonomous.dev" className="text-accent hover:underline">
              Kontaktiere uns
            </a>
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-card border border-card-border rounded-xl overflow-hidden"
            >
              <button
                className="w-full flex items-center justify-between p-5 text-left hover:bg-card/50 transition-colors"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="font-medium pr-4">{faq.question}</span>
                <svg
                  className={`w-5 h-5 text-muted shrink-0 transition-transform ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {openIndex === index && (
                <div className="px-5 pb-5 text-muted text-sm leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
