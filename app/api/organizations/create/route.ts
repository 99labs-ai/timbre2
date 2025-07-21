import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { organizationName, taxData, organizationType } = await req.json()

    if (!organizationName || !taxData) {
      return NextResponse.json({ error: 'Organization name and tax data required' }, { status: 400 })
    }

    // Validate required tax fields
    const requiredFields = ['taxId', 'taxpayer', 'postalCode', 'invoiceCfdiUse', 'invoiceFiscalRegimen']
    for (const field of requiredFields) {
      if (!taxData[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 })
      }
    }

    // Get user's profile
    const profile = await prisma.profile.findUnique({
      where: { authUserId: user.id },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check if tax ID is already in use
    const existingTaxInfo = await prisma.taxInformation.findUnique({
      where: { taxId: taxData.taxId }
    })

    if (existingTaxInfo) {
      return NextResponse.json({ error: 'RFC ya está registrado en otra organización' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create the organization
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          organizationType: organizationType || 'persona_moral', // Default for manual creation
          isPersonal: false, // This is a business organization created by the user
        },
      })

      // Create organization profile relationship with admin role
      await tx.organizationProfile.create({
        data: {
          profileId: profile.profileId,
          organizationId: organization.organizationId,
          role: 'admin',
        },
      })

      // Create tax information
      const taxInfo = await tx.taxInformation.create({
        data: {
          organizationId: organization.organizationId,
          taxId: taxData.taxId,
          taxpayer: taxData.taxpayer,
          country: taxData.country || 'México',
          postalCode: taxData.postalCode,
          csfDocumentUrl: taxData.csfDocumentUrl || null,
          invoiceCfdiUse: taxData.invoiceCfdiUse,
          invoiceFiscalRegimen: taxData.invoiceFiscalRegimen,
        },
      })

      return { 
        organization: {
          ...organization,
          taxInformation: taxInfo
        }
      }
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error creating organization:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}