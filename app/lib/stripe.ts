import Stripe from "stripe";

let client: Stripe | null = null;

/** Lazily create the Stripe client so builds work without secrets. */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return client;
}

export const PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER || "price_starter",
  pro: process.env.STRIPE_PRICE_PRO || "price_pro",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || "price_enterprise",
} as const;

export type PlanId = keyof typeof PRICE_IDS;
