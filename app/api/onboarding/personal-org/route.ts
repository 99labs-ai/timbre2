import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { authUserId: user.id },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { taxData, organizationType } = await req.json()

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: taxData.taxpayer,
          organizationType: organizationType || 'persona_fisica',
          isPersonal: true,
        },
      })

      await tx.organizationProfile.create({
        data: {
          profileId: profile.profileId,
          organizationId: organization.organizationId,
          role: 'admin',
        },
      })

      const taxInfo = await tx.taxInformation.create({
        data: {
          organizationId: organization.organizationId,
          taxId: taxData.taxId,
          taxpayer: taxData.taxpayer,
          country: taxData.country || null,
          postalCode: taxData.postalCode || null,
          invoiceCfdiUse: taxData.invoiceCfdiUse || null,
          invoiceFiscalRegimen: taxData.invoiceFiscalRegimen || null,
        },
      })

      return { organization, taxInfo }
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error creating personal organization:', error)
    console.error('Error details:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}