import { NextRequest, NextResponse } from "next/server";
import { stripe, PRICE_IDS, type PlanId } from "../../lib/stripe";

const VALID_PLANS: PlanId[] = ["starter", "pro", "enterprise"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan, successUrl, cancelUrl } = body as {
      plan: PlanId;
      successUrl?: string;
      cancelUrl?: string;
    };

    if (!plan || !VALID_PLANS.includes(plan)) {
      return NextResponse.json(
        { error: "Invalid plan. Must be one of: starter, pro, enterprise" },
        { status: 400 }
      );
    }

    const priceId = PRICE_IDS[plan];

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url:
        successUrl ||
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        cancelUrl ||
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/pricing`,
      metadata: {
        plan,
      },
      subscription_data: {
        metadata: {
          plan,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
