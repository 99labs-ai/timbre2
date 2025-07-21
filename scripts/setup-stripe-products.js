/**
 * Setup script to create Stripe products and prices
 * Run this once to create your subscription products in Stripe
 * 
 * Usage: 
 * 1. Set your STRIPE_SECRET_KEY in .env
 * 2. Run: node scripts/setup-stripe-products.js
 * 3. Copy the generated price IDs to your .env file
 */

const Stripe = require('stripe')
require('dotenv').config()

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY not found in environment variables')
  process.exit(1)
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
})

const products = [
  {
    name: 'Plan Básico - Timbre',
    description: 'Perfecto para pequeñas empresas',
    unit_amount: 29900, // $299.00 in cents
    nickname: 'basic',
    credits: 50
  },
  {
    name: 'Plan Profesional - Timbre',
    description: 'Para empresas en crecimiento',
    unit_amount: 59900, // $599.00 in cents
    nickname: 'professional',
    credits: 200
  },
  {
    name: 'Plan Empresarial - Timbre',
    description: 'Para grandes organizaciones',
    unit_amount: 119900, // $1,199.00 in cents
    nickname: 'enterprise',
    credits: 1000
  }
]

async function createProducts() {
  console.log('🚀 Creating Stripe products and prices...\n')
  
  const envVars = []
  
  try {
    for (const productData of products) {
      // Create product
      const product = await stripe.products.create({
        name: productData.name,
        description: productData.description,
        metadata: {
          credits: productData.credits.toString(),
          type: 'subscription'
        }
      })
      
      console.log(`✅ Product created: ${product.name} (${product.id})`)
      
      // Create price
      const price = await stripe.prices.create({
        currency: 'usd',
        unit_amount: productData.unit_amount,
        recurring: {
          interval: 'month'
        },
        product: product.id,
        nickname: productData.nickname,
        metadata: {
          credits: productData.credits.toString()
        }
      })
      
      console.log(`💰 Price created: ${price.nickname} - $${(price.unit_amount / 100).toFixed(2)}/month (${price.id})`)
      
      // Generate environment variable
      const envVar = `STRIPE_PRICE_${productData.nickname.toUpperCase()}=${price.id}`
      envVars.push(envVar)
      
      console.log(`📝 Environment variable: ${envVar}\n`)
    }
    
    console.log('🎉 All products and prices created successfully!')
    console.log('\n📋 Copy these environment variables to your .env file:')
    console.log('─'.repeat(60))
    envVars.forEach(envVar => console.log(envVar))
    console.log('─'.repeat(60))
    
  } catch (error) {
    console.error('❌ Error creating products:', error.message)
    process.exit(1)
  }
}

// Run the setup
createProducts()