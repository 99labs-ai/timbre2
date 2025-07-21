import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break

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

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (!session.subscription || !session.metadata?.organizationId) {
    return
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
  
  await prisma.subscription.upsert({
    where: {
      organizationId: session.metadata.organizationId
    },
    update: {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      status: subscription.status as any,
      planType: subscription.items.data[0]?.price.nickname || 'default',
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
    create: {
      organizationId: session.metadata.organizationId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      status: subscription.status as any,
      planType: subscription.items.data[0]?.price.nickname || 'default',
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    }
  })
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  if (!subscription.metadata?.organizationId) {
    return
  }

  await prisma.subscription.upsert({
    where: {
      organizationId: subscription.metadata.organizationId
    },
    update: {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      status: subscription.status as any,
      planType: subscription.items.data[0]?.price.nickname || 'default',
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
    create: {
      organizationId: subscription.metadata.organizationId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      status: subscription.status as any,
      planType: subscription.items.data[0]?.price.nickname || 'default',
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    }
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  if (!subscription.metadata?.organizationId) {
    return
  }

  await prisma.subscription.update({
    where: {
      organizationId: subscription.metadata.organizationId
    },
    data: {
      status: 'canceled'
    }
  })
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!invoice.subscription_details?.metadata?.organizationId) {
    return
  }

  // Add credits to organization based on payment
  const creditAmount = Math.floor((invoice.amount_paid || 0) / 100) // Convert cents to credits
  
  await prisma.organization.update({
    where: {
      organizationId: invoice.subscription_details.metadata.organizationId
    },
    data: {
      creditBalance: {
        increment: creditAmount
      }
    }
  })
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription_details?.metadata?.organizationId) {
    return
  }

  // Update subscription status to past_due
  await prisma.subscription.update({
    where: {
      organizationId: invoice.subscription_details.metadata.organizationId
    },
    data: {
      status: 'past_due'
    }
  })
}