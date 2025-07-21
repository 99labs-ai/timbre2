import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'

// GET - Fetch tax information for an organization
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

    // Get user's profile and verify organization access
    const profile = await prisma.profile.findUnique({
      where: { authUserId: user.id },
      include: {
        organizationProfiles: {
          where: { organizationId },
          include: {
            organization: {
              include: {
                taxInformation: true
              }
            }
          }
        }
      }
    })

    if (!profile || profile.organizationProfiles.length === 0) {
      return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 403 })
    }

    const organizationProfile = profile.organizationProfiles[0]
    const organization = organizationProfile.organization

    if (!organization.taxInformation) {
      return NextResponse.json({ error: 'Tax information not found' }, { status: 404 })
    }

    return NextResponse.json({
      organization: {
        organizationId: organization.organizationId,
        name: organization.name,
        isPersonal: organization.isPersonal,
        role: organizationProfile.role,
        taxInformation: {
          taxId: organization.taxInformation.taxId,
          taxpayer: organization.taxInformation.taxpayer,
          country: organization.taxInformation.country,
          postalCode: organization.taxInformation.postalCode,
          invoiceCfdiUse: organization.taxInformation.invoiceCfdiUse,
          invoiceFiscalRegimen: organization.taxInformation.invoiceFiscalRegimen
        }
      }
    })

  } catch (error) {
    console.error('Error fetching tax information:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PUT - Update tax information for an organization
export async function PUT(
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
    const { taxId, taxpayer, country, postalCode, invoiceCfdiUse, invoiceFiscalRegimen } = body

    // Validate required fields
    if (!taxId || !taxpayer || !country || !postalCode || !invoiceCfdiUse || !invoiceFiscalRegimen) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Get user's profile and verify admin access
    const profile = await prisma.profile.findUnique({
      where: { authUserId: user.id },
      include: {
        organizationProfiles: {
          where: { 
            organizationId,
            role: 'admin' // Only admins can update tax info
          },
          include: {
            organization: {
              include: {
                taxInformation: true
              }
            }
          }
        }
      }
    })

    if (!profile || profile.organizationProfiles.length === 0) {
      return NextResponse.json({ error: 'Organization not found or admin access required' }, { status: 403 })
    }

    const organization = profile.organizationProfiles[0].organization

    if (!organization.taxInformation) {
      return NextResponse.json({ error: 'Tax information not found' }, { status: 404 })
    }

    // Update tax information
    const updatedTaxInfo = await prisma.taxInformation.update({
      where: { organizationId },
      data: {
        taxId: taxId.trim(),
        taxpayer: taxpayer.trim(),
        country: country.trim(),
        postalCode: postalCode.trim(),
        invoiceCfdiUse: invoiceCfdiUse.trim(),
        invoiceFiscalRegimen: invoiceFiscalRegimen.trim(),
      }
    })

    return NextResponse.json({
      message: 'Tax information updated successfully',
      taxInformation: {
        taxId: updatedTaxInfo.taxId,
        taxpayer: updatedTaxInfo.taxpayer,
        country: updatedTaxInfo.country,
        postalCode: updatedTaxInfo.postalCode,
        invoiceCfdiUse: updatedTaxInfo.invoiceCfdiUse,
        invoiceFiscalRegimen: updatedTaxInfo.invoiceFiscalRegimen
      }
    })

  } catch (error) {
    console.error('Error updating tax information:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}