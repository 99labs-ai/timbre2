import { NextResponse } from 'next/server'

export async function GET() {
  // Get price IDs from environment variables
  const basicPriceId = process.env.STRIPE_PRICE_BASIC
  const professionalPriceId = process.env.STRIPE_PRICE_PROFESSIONAL
  const enterprisePriceId = process.env.STRIPE_PRICE_ENTERPRISE

  // Validate that price IDs are configured
  if (!basicPriceId || !professionalPriceId || !enterprisePriceId) {
    return NextResponse.json({ 
      error: 'Stripe price IDs not configured. Please set STRIPE_PRICE_* environment variables.' 
    }, { status: 500 })
  }

  const plans = [
    {
      id: 'basic',
      name: 'Plan Básico',
      description: 'Perfecto para pequeñas empresas',
      price: '$299',
      priceId: basicPriceId,
      interval: 'mes',
      features: [
        '50 facturas por mes',
        'Soporte por email',
        'Plantillas básicas',
        'Exportación PDF'
      ],
      credits: 50
    },
    {
      id: 'professional',
      name: 'Plan Profesional',
      description: 'Para empresas en crecimiento',
      price: '$599',
      priceId: professionalPriceId,
      interval: 'mes',
      features: [
        '200 facturas por mes',
        'Soporte prioritario',
        'Plantillas avanzadas',
        'API integrations',
        'Reportes detallados'
      ],
      credits: 200,
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Plan Empresarial',
      description: 'Para grandes organizaciones',
      price: '$1,199',
      priceId: enterprisePriceId,
      interval: 'mes',
      features: [
        'Facturas ilimitadas',
        'Soporte 24/7',
        'Plantillas personalizadas',
        'Integraciones completas',
        'Gerente de cuenta dedicado',
        'SLA garantizado'
      ],
      credits: 1000
    }
  ]

  return NextResponse.json({ plans })
}