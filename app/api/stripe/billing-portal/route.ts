import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { currentUser } from '@clerk/nextjs/server'
import { validateStripeConfig } from '@/lib/stripe-config'

export async function POST(req: NextRequest) {
  try {
    // Validate Stripe configuration
    const config = validateStripeConfig()
    
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { organizationId } = await req.json()

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })
    }

    // Get user's profile and verify organization access
    const profile = await prisma.profile.findUnique({
      where: { authUserId: user.id },
      include: {
        organizationProfiles: {
          where: { 
            organizationId,
            role: 'admin' // Only admins can access billing portal
          },
          include: {
            organization: {
              include: {
                subscription: true
              }
            }
          }
        }
      }
    })

    if (!profile || profile.organizationProfiles.length === 0) {
      return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 403 })
    }

    const organization = profile.organizationProfiles[0].organization

    if (!organization.subscription?.stripeCustomerId) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
    }

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: organization.subscription.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    })

    return NextResponse.json({ sessionUrl: session.url })

  } catch (error) {
    console.error('Error creating billing portal session:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}