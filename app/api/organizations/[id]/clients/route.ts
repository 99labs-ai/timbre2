import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'

// GET - Fetch client profiles for an organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's profile and verify admin access to organization
    const profile = await prisma.profile.findUnique({
      where: { authUserId: user.id },
      include: {
        organizationProfiles: {
          where: { 
            organizationId,
            role: 'admin' // Only admins can manage clients
          }
        }
      }
    })

    if (!profile || profile.organizationProfiles.length === 0) {
      return NextResponse.json({ error: 'Organization not found or admin access required' }, { status: 403 })
    }

    // Fetch client profiles for the organization
    const clientProfiles = await prisma.profile.findMany({
      where: { 
        parentOrganizationId: organizationId,
        clientType: 'client'
      },
      include: {
        clientTaxProfiles: {
          where: { isActive: true },
          orderBy: { isDefault: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      clients: clientProfiles.map(client => ({
        profileId: client.profileId,
        name: client.name,
        email: client.email,
        phone: client.phone,
        creditLimit: client.creditLimit,
        creditsUsed: client.creditsUsed,
        isActive: client.isActive,
        taxProfiles: client.clientTaxProfiles.map(tax => ({
          taxProfileId: tax.taxProfileId,
          name: tax.name,
          taxId: tax.taxId,
          taxpayer: tax.taxpayer,
          isDefault: tax.isDefault
        })),
        createdAt: client.createdAt
      }))
    })

  } catch (error) {
    console.error('Error fetching client profiles:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST - Create a new client profile
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { 
      name, 
      email, 
      phone, 
      creditLimit,
      taxProfiles 
    } = body

    // Validate required fields
    if (!name || !email || !taxProfiles || taxProfiles.length === 0) {
      return NextResponse.json({ error: 'Name, email, and at least one tax profile are required' }, { status: 400 })
    }

    // Get user's profile and verify admin access to organization
    const profile = await prisma.profile.findUnique({
      where: { authUserId: user.id },
      include: {
        organizationProfiles: {
          where: { 
            organizationId,
            role: 'admin'
          }
        }
      }
    })

    if (!profile || profile.organizationProfiles.length === 0) {
      return NextResponse.json({ error: 'Organization not found or admin access required' }, { status: 403 })
    }

    // Create client profile with tax profiles in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the client profile
      const clientProfile = await tx.profile.create({
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone?.trim(),
          clientType: 'client',
          parentOrganizationId: organizationId,
          creditLimit: creditLimit || 0,
          creditsUsed: 0,
          isActive: true
        }
      })

      // Create tax profiles
      const createdTaxProfiles = []
      for (let i = 0; i < taxProfiles.length; i++) {
        const taxProfile = taxProfiles[i]
        
        const createdTaxProfile = await tx.clientTaxProfile.create({
          data: {
            profileId: clientProfile.profileId,
            name: taxProfile.name.trim(),
            taxId: taxProfile.taxId.trim().toUpperCase(),
            taxpayer: taxProfile.taxpayer.trim(),
            country: taxProfile.country || 'México',
            postalCode: taxProfile.postalCode.trim(),
            invoiceCfdiUse: taxProfile.invoiceCfdiUse.trim(),
            invoiceFiscalRegimen: taxProfile.invoiceFiscalRegimen.trim(),
            isDefault: i === 0, // First tax profile is default
            isActive: true
          }
        })
        
        createdTaxProfiles.push(createdTaxProfile)
      }

      return { clientProfile, taxProfiles: createdTaxProfiles }
    })

    return NextResponse.json({
      message: 'Client profile created successfully',
      client: {
        profileId: result.clientProfile.profileId,
        name: result.clientProfile.name,
        email: result.clientProfile.email,
        phone: result.clientProfile.phone,
        creditLimit: result.clientProfile.creditLimit,
        taxProfiles: result.taxProfiles.map(tax => ({
          taxProfileId: tax.taxProfileId,
          name: tax.name,
          taxId: tax.taxId,
          taxpayer: tax.taxpayer,
          isDefault: tax.isDefault
        }))
      }
    })

  } catch (error) {
    console.error('Error creating client profile:', error)
    
    // Handle unique constraint errors
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      if (error.message.includes('email')) {
        return NextResponse.json({ error: 'Email address already exists' }, { status: 400 })
      }
    }
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}