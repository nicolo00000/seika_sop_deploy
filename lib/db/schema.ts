import { pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const userSubscriptions = pgTable('user_subscriptions', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 256 }).notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 256 }).notNull(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 256 }).notNull(),
  stripePriceId: varchar('stripe_price_id', { length: 256 }).notNull(),
  stripeCurrentPeriodEnd: timestamp('stripe_current_period_end').notNull(),
});