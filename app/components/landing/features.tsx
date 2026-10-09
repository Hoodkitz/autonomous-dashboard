"use client";

const features = [
  {
    icon: "📊",
    title: "Real-Time Dashboard",
    description:
      "Unified view of all your metrics, logs, and events. Customizable widgets, drag-and-drop layouts, and live updates.",
    color: "text-accent",
    bg: "bg-accent-dim",
  },
  {
    icon: "🔔",
    title: "Smart Alerts",
    description:
      "AI-powered anomaly detection with intelligent thresholding. Get notified via email, Slack, Telegram, or webhook.",
    color: "text-warning",
    bg: "bg-warning-dim",
  },
  {
    icon: "📈",
    title: "Advanced Analytics",
    description:
      "Trend analysis, forecasting, and correlation discovery. Turn raw data into actionable insights automatically.",
    color: "text-success",
    bg: "bg-success-dim",
  },
  {
    icon: "📋",
    title: "Automated Reports",
    description:
      "Scheduled PDF and HTML reports with custom templates. Daily, weekly, or monthly — delivered to your inbox.",
    color: "text-purple",
    bg: "bg-purple-dim",
  },
  {
    icon: "⚡",
    title: "Workflow Automation",
    description:
      "Trigger actions based on events. Auto-remediate issues, scale resources, or run custom scripts — no code required.",
    color: "text-cyan",
    bg: "bg-cyan-dim",
  },
  {
    icon: "🔌",
    title: "Open API",
    description:
      "RESTful API with webhooks, SDKs, and comprehensive documentation. Integrate with any tool in your stack.",
    color: "text-accent",
    bg: "bg-accent-dim",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything You Need to Stay on Top
          </h2>
          <p className="text-muted max-w-2xl mx-auto">
            From real-time monitoring to automated remediation — Autonomous Dashboard
            gives you superpowers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-card border border-card-border rounded-xl p-6 hover:border-muted transition-colors group"
            >
              <div
                className={`w-12 h-12 rounded-lg ${feature.bg} flex items-center justify-center text-2xl mb-4`}
              >
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-accent transition-colors">
                {feature.title}
              </h3>
              <p className="text-muted text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
