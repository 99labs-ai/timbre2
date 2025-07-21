/**
 * Subscription and credit management utilities
 */

import { validateStripeConfig } from './stripe-config'

export interface PlanCredits {
  priceId: string
  planType: string
  credits: number
}

export function getPlanCredits(): PlanCredits[] {
  const config = validateStripeConfig()
  
  return [
    {
      priceId: config.priceIds.basic,
      planType: 'Básico',
      credits: 100
    },
    {
      priceId: config.priceIds.professional,
      planType: 'Profesional', 
      credits: 300
    },
    {
      priceId: config.priceIds.enterprise,
      planType: 'Empresarial',
      credits: 1000
    }
  ]
}

export function getCreditsByPriceId(priceId: string): number {
  const plans = getPlanCredits()
  const plan = plans.find(p => p.priceId === priceId)
  return plan?.credits || 0
}

export function getPlanTypeByPriceId(priceId: string): string {
  const plans = getPlanCredits()
  const plan = plans.find(p => p.priceId === priceId)
  return plan?.planType || 'Unknown'
}