/**
 * Stripe configuration validation and utilities
 */

export interface StripeConfig {
  secretKey: string
  publishableKey: string
  webhookSecret: string
  appUrl: string
  priceIds: {
    basic: string
    professional: string
    enterprise: string
  }
}

export function validateStripeConfig(): StripeConfig {
  const requiredEnvVars = {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    priceIds: {
      basic: process.env.STRIPE_PRICE_BASIC,
      professional: process.env.STRIPE_PRICE_PROFESSIONAL,
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
    }
  }

  const missingVars: string[] = []

  // Check main Stripe keys
  if (!requiredEnvVars.secretKey) missingVars.push('STRIPE_SECRET_KEY')
  if (!requiredEnvVars.publishableKey) missingVars.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
  if (!requiredEnvVars.webhookSecret) missingVars.push('STRIPE_WEBHOOK_SECRET')
  if (!requiredEnvVars.appUrl) missingVars.push('NEXT_PUBLIC_APP_URL')

  // Check price IDs
  if (!requiredEnvVars.priceIds.basic) missingVars.push('STRIPE_PRICE_BASIC')
  if (!requiredEnvVars.priceIds.professional) missingVars.push('STRIPE_PRICE_PROFESSIONAL')
  if (!requiredEnvVars.priceIds.enterprise) missingVars.push('STRIPE_PRICE_ENTERPRISE')

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required Stripe environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env file and ensure all Stripe configuration is complete.\n' +
      'Run "node scripts/setup-stripe-products.js" to create products and get price IDs.'
    )
  }

  return requiredEnvVars as StripeConfig
}

export function getStripeConfig(): StripeConfig {
  return validateStripeConfig()
}