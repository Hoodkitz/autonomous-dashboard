export const runtime = 'nodejs';
import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir, readdir, stat } from "fs/promises";
import { join } from "path";
import { smartAI } from "@/app/lib/smart-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HOME = process.env.USERPROFILE || process.env.HOME || "~";
const ENGINE_DIR = join(HOME, ".autonomous-engine");
const DEPLOY_DIR = join(ENGINE_DIR, "deployments");
const STATE_FILE = join(DEPLOY_DIR, "state.json");
const PRODUCTS_DIR = join(ENGINE_DIR, "money-machine", "products");
const SWARM_DIR = join(ENGINE_DIR, "swarm");

// ============================================================
// TYPES
// ============================================================

interface Deployment {
  id: string;
  name: string;
  source: string;
  sourcePath: string;
  platform: "vercel" | "cloudflare" | "railway" | "github-pages" | "local";
  status: "draft" | "building" | "deploying" | "live" | "failed" | "stopped";
  url?: string;
  createdAt: string;
  updatedAt: string;
  buildLog: string[];
  deployLog: string[];
  config: Record<string, unknown>;
  revenue: number;
  visits: number;
}

interface DeployState {
  deployments: Deployment[];
  totalDeployed: number;
  totalRevenue: number;
  platforms: Record<string, { configured: boolean; token?: string }>;
  autoDeployEnabled: boolean;
  lastScan: string;
  availableProjects: Array<{
    name: string;
    path: string;
    source: string;
    hasPackageJson: boolean;
    hasVercelJson: boolean;
    completeness: number;
  }>;
}

function defaultDeployState(): DeployState {
  return {
    deployments: [],
    totalDeployed: 0,
    totalRevenue: 0,
    platforms: {
      vercel: { configured: false },
      cloudflare: { configured: false },
      railway: { configured: false },
      "github-pages": { configured: false },
    },
    autoDeployEnabled: false,
    lastScan: "",
    availableProjects: [],
  };
}

async function loadDeploy(): Promise<DeployState> {
  try {
    return { ...defaultDeployState(), ...JSON.parse(await readFile(STATE_FILE, "utf-8")) };
  } catch { return defaultDeployState(); }
}

async function saveDeploy(s: DeployState): Promise<void> {
  await mkdir(DEPLOY_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(s, null, 2), "utf-8");
}

async function fileExists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}

// Scan for deployable projects
async function scanProjects(): Promise<DeployState["availableProjects"]> {
  const projects: DeployState["availableProjects"] = [];

  // Scan money-machine products
  try {
    const productDirs = await readdir(PRODUCTS_DIR);
    for (const dir of productDirs) {
      const productPath = join(PRODUCTS_DIR, dir);
      const deployPath = join(productPath, "deploy");
      const hasPackage = await fileExists(join(deployPath, "package.json"));
      const hasVercel = await fileExists(join(deployPath, "vercel.json"));
      const hasPage = await fileExists(join(deployPath, "app", "page.tsx"));
      const hasSpec = await fileExists(join(productPath, "spec.json"));

      let completeness = 0;
      if (hasSpec) completeness += 20;
      if (hasPage) completeness += 40;
      if (hasPackage) completeness += 20;
      if (hasVercel) completeness += 20;

      projects.push({
        name: dir,
        path: deployPath,
        source: "money-machine",
        hasPackageJson: hasPackage,
        hasVercelJson: hasVercel,
        completeness,
      });
    }
  } catch { /* no products yet */ }

  // Scan swarm cycle outputs
  try {
    const cycleDirs = await readdir(SWARM_DIR);
    for (const dir of cycleDirs) {
      if (!dir.startsWith("cycle-")) continue;
      const cyclePath = join(SWARM_DIR, dir);
      const contextFile = join(cyclePath, "_context.json");
      if (await fileExists(contextFile)) {
        projects.push({
          name: `swarm-${dir}`,
          path: cyclePath,
          source: "swarm",
          hasPackageJson: false,
          hasVercelJson: false,
          completeness: 30,
        });
      }
    }
  } catch { /* */ }

  // Scan the dashboard itself
  const dashboardPath = join(HOME, "autonomous-dashboard");
  if (await fileExists(join(dashboardPath, "package.json"))) {
    projects.push({
      name: "autonomous-dashboard",
      path: dashboardPath,
      source: "dashboard",
      hasPackageJson: true,
      hasVercelJson: await fileExists(join(dashboardPath, "vercel.json")),
      completeness: 100,
    });
  }

  return projects;
}

// ============================================================
// GET: Deployment state + available projects
// ============================================================
export async function GET() {
  const state = await loadDeploy();
  return Response.json(state);
}

// ============================================================
// POST: Deploy actions
// ============================================================
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  if (!action) return Response.json({ error: "action required" }, { status: 400 });

  // SCAN: Find deployable projects
  if (action === "scan") {
    const state = await loadDeploy();
    state.availableProjects = await scanProjects();
    state.lastScan = new Date().toISOString();
    await saveDeploy(state);
    return Response.json({ ok: true, projects: state.availableProjects });
  }

  // CONFIGURE PLATFORM: Set API token for a hosting platform
  if (action === "configure_platform") {
    const state = await loadDeploy();
    const platform = body.platform as string;
    const token = body.token as string;
    if (!platform || !state.platforms[platform]) {
      return Response.json({ error: "Unknown platform" }, { status: 400 });
    }
    state.platforms[platform] = { configured: true, token };
    await saveDeploy(state);
    return Response.json({ ok: true });
  }

  // TOGGLE AUTO-DEPLOY
  if (action === "toggle_auto_deploy") {
    const state = await loadDeploy();
    state.autoDeployEnabled = !state.autoDeployEnabled;
    await saveDeploy(state);
    return Response.json({ ok: true, autoDeployEnabled: state.autoDeployEnabled });
  }

  // UPDATE DEPLOYMENT STATUS
  if (action === "update_status") {
    const state = await loadDeploy();
    const dep = state.deployments.find((d) => d.id === body.id);
    if (dep) {
      if (body.status) dep.status = body.status;
      if (body.url) dep.url = body.url;
      if (body.revenue !== undefined) dep.revenue = body.revenue;
      dep.updatedAt = new Date().toISOString();
      await saveDeploy(state);
    }
    return Response.json({ ok: true });
  }

  // ========================================
  // PREPARE: AI generates deployment package for a project
  // ========================================
  if (action === "prepare") {
    const projectName = body.project as string;
    const platform = body.platform as string || "vercel";

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function emit(data: Record<string, unknown>) {
          try { controller.enqueue(encoder.encode(JSON.stringify(data) + "\n")); } catch { /* */ }
        }

        const state = await loadDeploy();
        state.availableProjects = await scanProjects();
        const project = state.availableProjects.find((p) => p.name === projectName);

        if (!project) {
          emit({ type: "error", message: `Project "${projectName}" not found` });
          controller.close();
          return;
        }

        emit({ type: "start", project: project.name, platform, source: project.source });

        // Read project context
        let specContent = "";
        let contextContent = "";

        try {
          if (project.source === "money-machine") {
            const specPath = join(PRODUCTS_DIR, project.name, "spec.json");
            specContent = await readFile(specPath, "utf-8");
          } else if (project.source === "swarm") {
            const contextPath = join(project.path, "_context.json");
            contextContent = await readFile(contextPath, "utf-8");
          }
        } catch { /* */ }

        // Phase 1: Generate deployment config
        emit({ type: "phase", phase: "config", status: "running", message: "AI generating deployment configuration..." });

        const configResult = await smartAI(
          `You are a deployment automation expert. Generate a complete deployment package for a Next.js project.
Platform: ${platform}
Project context: ${(specContent || contextContent).slice(0, 2000)}

Generate:
1. package.json (with all dependencies)
2. vercel.json (or platform config)
3. .env.example (list required env vars)
4. Deploy commands

Return JSON: {
  packageJson: { ... complete package.json ... },
  platformConfig: { ... vercel.json or equivalent ... },
  envVars: ["VAR_NAME=description", ...],
  deployCommands: ["cmd1", "cmd2", ...],
  estimatedCost: "free tier / $X/month"
}`,
          `Generate deployment config for "${project.name}" targeting ${platform} free tier.`
        );

        emit({ type: "phase", phase: "config", status: "done", message: "Configuration generated" });

        // Phase 2: Create missing files
        emit({ type: "phase", phase: "scaffold", status: "running", message: "Creating deployment files..." });

        const deployDir = project.source === "dashboard"
          ? project.path
          : join(PRODUCTS_DIR, project.name, "deploy");

        await mkdir(deployDir, { recursive: true });
        await mkdir(join(deployDir, "app"), { recursive: true });

        // Write package.json if missing
        if (!project.hasPackageJson) {
          try {
            const match = configResult.content.match(/\{[\s\S]*"packageJson"[\s\S]*\}/);
            if (match) {
              const parsed = JSON.parse(match[0]);
              if (parsed.packageJson) {
                await writeFile(join(deployDir, "package.json"), JSON.stringify(parsed.packageJson, null, 2), "utf-8");
                emit({ type: "file_created", path: "package.json" });
              }
            }
          } catch { /* use default */ }

          // Fallback: write a basic package.json
          if (!await fileExists(join(deployDir, "package.json"))) {
            const defaultPkg = {
              name: project.name,
              version: "1.0.0",
              private: true,
              scripts: { dev: "next dev", build: "next build", start: "next start" },
              dependencies: { next: "^16.0.0", react: "^19.0.0", "react-dom": "^19.0.0" },
              devDependencies: { typescript: "^5.0.0", "@types/node": "^22.0.0", "@types/react": "^19.0.0" },
            };
            await writeFile(join(deployDir, "package.json"), JSON.stringify(defaultPkg, null, 2), "utf-8");
            emit({ type: "file_created", path: "package.json (default)" });
          }
        }

        // Write vercel.json if missing
        if (!project.hasVercelJson && platform === "vercel") {
          const vercelConfig = { framework: "nextjs", buildCommand: "next build", installCommand: "npm install" };
          await writeFile(join(deployDir, "vercel.json"), JSON.stringify(vercelConfig, null, 2), "utf-8");
          emit({ type: "file_created", path: "vercel.json" });
        }

        emit({ type: "phase", phase: "scaffold", status: "done", message: "Deployment files ready" });

        // Phase 3: Generate landing page if missing
        const pagePath = join(deployDir, "app", "page.tsx");
        if (!await fileExists(pagePath) && project.source !== "dashboard") {
          emit({ type: "phase", phase: "landing", status: "running", message: "AI generating landing page..." });

          const pageResult = await smartAI(
            `Generate a complete, stunning Next.js landing page. Use "use client" directive.
Tailwind CSS for styling. Dark theme. Include:
- Hero section with gradient text
- Features grid (6 features)
- Pricing (Free vs Pro)
- CTA button
- Footer
Make it production-ready. Return ONLY the complete page.tsx code.`,
            `Project: ${project.name}. Context: ${(specContent || contextContent).slice(0, 500)}`
          );

          if (pageResult.content.length > 200) {
            const code = pageResult.content.includes("```")
              ? pageResult.content.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim()
              : pageResult.content;
            await writeFile(pagePath, code, "utf-8");
            emit({ type: "file_created", path: "app/page.tsx" });
          }

          emit({ type: "phase", phase: "landing", status: "done", message: "Landing page generated" });
        }

        // Phase 4: Create layout if missing
        const layoutPath = join(deployDir, "app", "layout.tsx");
        if (!await fileExists(layoutPath) && project.source !== "dashboard") {
          const layout = `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${project.name}",
  description: "Built by Autonomous Symbiotic Engine",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
`;
          await writeFile(layoutPath, layout, "utf-8");

          const globals = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`;
          await writeFile(join(deployDir, "app", "globals.css"), globals, "utf-8");
          emit({ type: "file_created", path: "app/layout.tsx + globals.css" });
        }

        // Register deployment
        const deployment: Deployment = {
          id: `deploy-${Date.now()}`,
          name: project.name,
          source: project.source,
          sourcePath: deployDir,
          platform: platform as Deployment["platform"],
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          buildLog: [],
          deployLog: [],
          config: {},
          revenue: 0,
          visits: 0,
        };

        state.deployments.push(deployment);
        state.availableProjects = await scanProjects();
        await saveDeploy(state);

        emit({
          type: "complete",
          deploymentId: deployment.id,
          project: project.name,
          platform,
          path: deployDir,
          message: `Ready to deploy! Run: cd ${deployDir} && npm i && npx vercel`,
        });

        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
    });
  }

  // ========================================
  // AI BUILD ADVISOR: Ask AI what to build/deploy next
  // ========================================
  if (action === "advise") {
    const state = await loadDeploy();
    state.availableProjects = await scanProjects();

    const result = await smartAI(
      `You are the Autonomous Deployment Advisor. Analyze available projects and deployments.
Recommend what to deploy next and how to maximize revenue.
Be specific and actionable. Focus on what's ready to deploy NOW.`,
      `Available projects: ${JSON.stringify(state.availableProjects.map((p) => ({ name: p.name, source: p.source, completeness: p.completeness })))}

Current deployments: ${JSON.stringify(state.deployments.map((d) => ({ name: d.name, status: d.status, platform: d.platform, revenue: d.revenue })))}

Platforms configured: ${JSON.stringify(Object.entries(state.platforms).map(([k, v]) => ({ platform: k, ready: v.configured })))}

What should we deploy next? Give 3 specific recommendations with reasoning. Return JSON: { recommendations: [{ project, platform, reason, estimatedMRR, priority }] }`
    );

    await saveDeploy(state);
    return Response.json({ advice: result.content, model: result.model });
  }

  return Response.json({ error: "Unknown action. Use: scan, prepare, configure_platform, toggle_auto_deploy, update_status, advise" }, { status: 400 });
}
