import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center bg-card border border-card-border rounded-2xl p-8">
        <div className="w-16 h-16 rounded-full bg-success-dim flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-2">Willkommen an Bord!</h1>
        <p className="text-muted mb-6">
          Dein Abo wurde erfolgreich aktiviert. Du erhältst in Kürze eine Bestätigungs-E-Mail.
        </p>

        <div className="space-y-3">
          <Link
            href="/engine"
            className="block w-full bg-accent hover:bg-accent/90 text-white py-3 rounded-lg font-medium transition-colors"
          >
            Zum Dashboard
          </Link>
          <Link
            href="/"
            className="block w-full border border-card-border hover:border-muted text-foreground py-3 rounded-lg font-medium transition-colors"
          >
            Zurück zur Startseite
          </Link>
        </div>
      </div>
    </main>
  );
}
