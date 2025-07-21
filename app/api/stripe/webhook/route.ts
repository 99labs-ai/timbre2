import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { validateStripeConfig } from '@/lib/stripe-config'
import { getCreditsByPriceId, getPlanTypeByPriceId } from '@/lib/subscription-utils'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  try {
    const config = validateStripeConfig()
    const body = await req.text()
    const signature = (await headers()).get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    let event
    try {
      event = stripe.webhooks.constructEvent(body, signature, config.webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const organizationId = session.metadata?.organizationId
        const profileId = session.metadata?.profileId

        if (!organizationId || !profileId) {
          console.error('Missing metadata in checkout session')
          break
        }

                 // Get the subscription to find the price ID
         const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string) as Stripe.Subscription
        const priceId = stripeSubscription.items.data[0]?.price.id

        if (!priceId) {
          console.error('Could not find price ID from subscription')
          break
        }

        // Get credits for this plan
        const planCredits = getCreditsByPriceId(priceId)
        const planType = getPlanTypeByPriceId(priceId)

        // Use transaction to ensure data consistency
        await prisma.$transaction(async (tx) => {
          // Create or update subscription record
          await tx.subscription.upsert({
            where: { organizationId },
            update: {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              status: 'active',
              currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
              planType,
            },
            create: {
              organizationId,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              status: 'active',
              currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
              planType,
            },
          })

          // Add credits to organization
          if (planCredits > 0) {
            await tx.organization.update({
              where: { organizationId },
              data: {
                creditBalance: {
                  increment: planCredits
                }
              }
            })
            
            console.log(`Added ${planCredits} credits to organization ${organizationId} for ${planType} plan`)
          }
        })

        console.log(`Subscription created/updated for organization: ${organizationId}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const organizationId = subscription.metadata?.organizationId

        if (!organizationId) {
          console.error('Missing organizationId in subscription metadata')
          break
        }

        await prisma.subscription.update({
          where: { organizationId },
          data: {
            status: subscription.status as any,
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          },
        })

        console.log(`Subscription updated for organization: ${organizationId}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const organizationId = subscription.metadata?.organizationId

        if (!organizationId) {
          console.error('Missing organizationId in subscription metadata')
          break
        }

        await prisma.subscription.update({
          where: { organizationId },
          data: {
            status: 'canceled',
          },
        })

        console.log(`Subscription canceled for organization: ${organizationId}`)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        
                 // Only process recurring payments (not the initial payment)
         if ((invoice as any).subscription && (invoice as any).billing_reason === 'subscription_cycle') {
           const subscription = await stripe.subscriptions.retrieve((invoice as any).subscription as string)
          const organizationId = subscription.metadata?.organizationId
          const priceId = subscription.items.data[0]?.price.id

          if (organizationId && priceId) {
            const planCredits = getCreditsByPriceId(priceId)
            const planType = getPlanTypeByPriceId(priceId)

            if (planCredits > 0) {
              // Add monthly credits for recurring payments
              await prisma.organization.update({
                where: { organizationId },
                data: {
                  creditBalance: {
                    increment: planCredits
                  }
                }
              })

              console.log(`Added ${planCredits} recurring credits to organization ${organizationId} for ${planType} plan`)
            }
          }
        }
        
        console.log(`Payment succeeded for invoice: ${invoice.id}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.log(`Payment failed for invoice: ${invoice.id}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}