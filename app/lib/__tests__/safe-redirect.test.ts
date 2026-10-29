import { describe, expect, it } from "vitest";
import { resolveSafeRedirect } from "../safe-redirect";

const BASE = "https://example.com";
const FB = "/pricing";

describe("resolveSafeRedirect", () => {
  it("uses fallback when missing", () => {
    expect(resolveSafeRedirect(undefined, BASE, FB)).toBe("https://example.com/pricing");
  });
  it("accepts relative paths", () => {
    expect(resolveSafeRedirect("/thanks?x=1", BASE, FB)).toBe("https://example.com/thanks?x=1");
  });
  it("accepts same-origin absolute URLs", () => {
    expect(resolveSafeRedirect("https://example.com/ok", BASE, FB)).toBe("https://example.com/ok");
  });
  it("keeps Stripe session placeholder in fallback", () => {
    expect(resolveSafeRedirect(undefined, BASE, "/success?session_id={CHECKOUT_SESSION_ID}")).toContain(
      "session_id={CHECKOUT_SESSION_ID}"
    );
  });
  it.each([
    "https://evil.com/x",
    "//evil.com",
    "\\\\evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "https://example.com.evil.com/",
    "https://example.com@evil.com/",
    "data:text/html,x",
  ])("rejects %s", (bad) => {
    expect(resolveSafeRedirect(bad, BASE, FB)).toBe("https://example.com/pricing");
  });
  it("rejects non-strings", () => {
    expect(resolveSafeRedirect({ a: 1 }, BASE, FB)).toBe("https://example.com/pricing");
  });
});
