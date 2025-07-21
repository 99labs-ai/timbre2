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

    const { organizationId, priceId } = await req.json()

    if (!organizationId || !priceId) {
      return NextResponse.json({ error: 'Organization ID and Price ID required' }, { status: 400 })
    }

    // Validate that the price ID is one of our configured prices
    const validPriceIds = Object.values(config.priceIds)
    if (!validPriceIds.includes(priceId)) {
      return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 })
    }

    // Get user's profile and verify organization access
    const profile = await prisma.profile.findUnique({
      where: { authUserId: user.id },
      include: {
        organizationProfiles: {
          where: { 
            organizationId,
            role: 'admin' // Only admins can manage subscriptions
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

    // Check if organization already has an active subscription
    if (organization.subscription && organization.subscription.status === 'active') {
      return NextResponse.json({ error: 'Organization already has an active subscription' }, { status: 400 })
    }

    // Get user's primary email
    const userEmail = user.emailAddresses[0]?.emailAddress
    
    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    // Create or get Stripe customer
    let customerId = organization.subscription?.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        name: profile.name || undefined,
        metadata: {
          organizationId: organization.organizationId,
          profileId: profile.profileId,
        },
      })
      customerId = customer.id
    } else {
      // Update existing customer with current user email to ensure consistency
      await stripe.customers.update(customerId, {
        email: userEmail,
        name: profile.name || undefined,
      })
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
          tax_rates: ['txr_1RnSK8Q6bPXHaOEwtlzhbfcX'], // Mexican tax rate
        },
      ],
      success_url: `${config.appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.appUrl}/dashboard`,
      metadata: {
        organizationId: organization.organizationId,
        profileId: profile.profileId,
        userEmail: userEmail, // Include email in metadata for reference
      },
      subscription_data: {
        metadata: {
          organizationId: organization.organizationId,
          profileId: profile.profileId,
          userEmail: userEmail,
        },
      },
    })

    return NextResponse.json({ sessionUrl: session.url })

  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}