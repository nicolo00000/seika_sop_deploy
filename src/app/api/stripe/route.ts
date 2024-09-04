import { stripe } from '@/lib/stripe';
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Since you're using server-side functionality, you must define this route as dynamic.
// Add dynamic to the request handling function (or handle cache appropriately).
export const dynamic = 'force-dynamic';  // Forces Next.js to treat this route as dynamic

export async function GET() {
  try {
    const { userId } = auth();

    // Check if the user is authenticated
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create Stripe Checkout session
    const stripeSession = await stripe.checkout.sessions.create({
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/cancel`,
      payment_method_types: ["card"],
      mode: "subscription",
      billing_address_collection: "auto",
      line_items: [
        {
          price_data: {
            currency: "USD",
            product_data: {
              name: "Seika-sop",
              description: "Unlimited SOP!",
            },
            unit_amount: 2000, // 20 USD per month
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
      },
    });

    // Check if the session was created successfully
    if (!stripeSession.url) {
      throw new Error("Failed to create Stripe session URL");
    }

    // Return the Stripe session URL as a response
    return NextResponse.json({ url: stripeSession.url });
  } catch (error: unknown) {
    // Handle and log errors, then return an appropriate response
    console.error("Stripe error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: "Internal server error", details: errorMessage }, { status: 500 });
  }
}
