import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface BrowserTask {
  action: "navigate" | "screenshot" | "click" | "type" | "extract" | "full_task";
  url?: string;
  selector?: string;
  text?: string;
  task?: string; // natural language task description
}

// POST: Execute browser automation tasks
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as BrowserTask;

  if (!body.action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }

  // Dynamic import to avoid build-time issues
  let playwright;
  try {
    playwright = await import("playwright");
  } catch (err) {
    return NextResponse.json({ error: "Playwright not found", details: String(err) }, { status: 500 });
  }

  const { chromium } = playwright;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    let result: Record<string, unknown> = {};

    switch (body.action) {
      case "navigate": {
        if (!body.url) return NextResponse.json({ error: "url required" }, { status: 400 });
        await page.goto(body.url, { waitUntil: "domcontentloaded", timeout: 15000 });
        const title = await page.title();
        result = { ok: true, title, url: page.url() };
        break;
      }

      case "screenshot": {
        if (!body.url) return NextResponse.json({ error: "url required" }, { status: 400 });
        await page.goto(body.url, { waitUntil: "domcontentloaded", timeout: 15000 });
        const screenshot = await page.screenshot({ type: "png", fullPage: false });
        const title = await page.title();
        await browser.close();
        return new NextResponse(screenshot as unknown as BodyInit, {
          headers: {
            "Content-Type": "image/png",
            "X-Page-Title": encodeURIComponent(title),
          },
        });
      }

      case "click": {
        if (!body.url || !body.selector) return NextResponse.json({ error: "url and selector required" }, { status: 400 });
        await page.goto(body.url, { waitUntil: "domcontentloaded", timeout: 15000 });
        await page.click(body.selector, { timeout: 5000 });
        result = { ok: true, clicked: body.selector };
        break;
      }

      case "type": {
        if (!body.url || !body.selector || !body.text) return NextResponse.json({ error: "url, selector, text required" }, { status: 400 });
        await page.goto(body.url, { waitUntil: "domcontentloaded", timeout: 15000 });
        await page.fill(body.selector, body.text, { timeout: 5000 });
        result = { ok: true, filled: body.selector, text: body.text };
        break;
      }

      case "extract": {
        if (!body.url) return NextResponse.json({ error: "url required" }, { status: 400 });
        await page.goto(body.url, { waitUntil: "domcontentloaded", timeout: 15000 });

        const title = await page.title();
        const metaDesc = await page.$eval('meta[name="description"]', (el) => el.getAttribute("content")).catch(() => "");
        const h1 = await page.$eval("h1", (el) => el.textContent?.trim()).catch(() => "");
        const links = await page.$$eval("a[href]", (els) => els.slice(0, 20).map((el) => ({
          text: el.textContent?.trim().slice(0, 80),
          href: el.getAttribute("href"),
        })));
        const text = await page.$eval("body", (el) => (el as HTMLElement).innerText?.slice(0, 3000)).catch(() => "");

        result = { ok: true, title, description: metaDesc, h1, links, text_preview: text?.slice(0, 1000) };
        break;
      }

      case "full_task": {
        if (!body.url || !body.task) return NextResponse.json({ error: "url and task required" }, { status: 400 });
        await page.goto(body.url, { waitUntil: "domcontentloaded", timeout: 15000 });

        // Get page accessibility snapshot for AI analysis
        const title = await page.title();
        const snapshot = await (page as any).accessibility.snapshot();
        const text = await page.$eval("body", (el) => (el as HTMLElement).innerText?.slice(0, 5000)).catch(() => "");

        result = {
          ok: true,
          title,
          url: page.url(),
          accessibility_tree: snapshot,
          text_content: text?.slice(0, 3000),
          task: body.task,
          note: "Use this data with an AI model to plan and execute browser actions",
        };
        break;
      }
    }

    await browser.close();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
      hint: "Ensure Playwright browsers are installed: npx playwright install chromium",
    }, { status: 500 });
  }
}

// GET: Check computer use capabilities
export async function GET() {
  let playwrightReady = false;
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    playwrightReady = true;
  } catch { /* not installed */ }

  return NextResponse.json({
    capabilities: {
      playwright: {
        available: playwrightReady,
        actions: ["navigate", "screenshot", "click", "type", "extract", "full_task"],
        note: "Local headless browser automation - completely FREE",
      },
      anthropic_computer_use: {
        available: false,
        note: "Requires @anthropic-ai/sdk - uses Claude API tokens",
        setup: "npm install @anthropic-ai/sdk",
      },
      agent_browser: {
        available: false,
        note: "CLI tool for AI browser control",
        setup: "npm install agent-browser",
      },
    },
    status: playwrightReady ? "ready" : "needs_setup",
    setup_command: "npx playwright install chromium",
  });
}
