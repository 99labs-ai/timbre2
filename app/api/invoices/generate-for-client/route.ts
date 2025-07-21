import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { 
      clientProfileId, 
      taxProfileId, 
      description, 
      subtotal, 
      items 
    } = await req.json()

    if (!clientProfileId || !taxProfileId) {
      return NextResponse.json({ error: 'Client profile ID and tax profile ID required' }, { status: 400 })
    }

    // Get client profile with tax profile and parent organization
    const clientProfile = await prisma.profile.findUnique({
      where: { 
        profileId: clientProfileId,
        clientType: 'client'
      },
      include: {
        clientTaxProfiles: {
          where: { 
            taxProfileId,
            isActive: true 
          }
        },
        parentOrganization: {
          include: {
            taxInformation: true
          }
        }
      }
    })

    if (!clientProfile || !clientProfile.parentOrganization) {
      return NextResponse.json({ error: 'Client profile or parent organization not found' }, { status: 404 })
    }

    if (clientProfile.clientTaxProfiles.length === 0) {
      return NextResponse.json({ error: 'Tax profile not found or inactive' }, { status: 404 })
    }

    // Check if client is active
    if (!clientProfile.isActive) {
      return NextResponse.json({ error: 'Client profile is inactive' }, { status: 400 })
    }

    // Check credit limits
    const creditsUsed = clientProfile.creditsUsed || 0
    const creditLimit = clientProfile.creditLimit || 0
    
    if (creditsUsed >= creditLimit) {
      return NextResponse.json({ error: 'Client has exceeded credit limit' }, { status: 400 })
    }

    // Check organization credits
    if (clientProfile.parentOrganization.creditBalance <= 0) {
      return NextResponse.json({ error: 'Organization has insufficient credits' }, { status: 400 })
    }

    const clientTaxProfile = clientProfile.clientTaxProfiles[0]
    const organizationTaxInfo = clientProfile.parentOrganization.taxInformation

    if (!organizationTaxInfo) {
      return NextResponse.json({ error: 'Organization tax information not configured' }, { status: 400 })
    }

    // Generate invoice data
    const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
    const currentDate = new Date()
    const dueDate = new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days from now

    const calculatedSubtotal = subtotal || 1000.00
    const taxAmount = calculatedSubtotal * 0.16 // 16% IVA
    const totalAmount = calculatedSubtotal + taxAmount

    // Prepare invoice details
    const invoiceDetails = {
      invoiceNumber,
      issueDate: currentDate.toISOString(),
      dueDate: dueDate.toISOString(),
      currency: 'MXN',
      subtotal: calculatedSubtotal,
      taxAmount,
      totalAmount,
      description: description || 'Servicios profesionales',
      items: items || [],
      // Issuer (Organization)
      issuerInfo: {
        rfc: organizationTaxInfo.taxId,
        taxpayer: organizationTaxInfo.taxpayer,
        address: `${organizationTaxInfo.postalCode}, ${organizationTaxInfo.country}`,
        fiscalRegimen: organizationTaxInfo.invoiceFiscalRegimen
      },
      // Recipient (Client)
      recipientInfo: {
        rfc: clientTaxProfile.taxId,
        taxpayer: clientTaxProfile.taxpayer,
        address: `${clientTaxProfile.postalCode}, ${clientTaxProfile.country}`,
        cfdiUse: clientTaxProfile.invoiceCfdiUse
      },
      // Client info for tracking
      clientInfo: {
        profileId: clientProfile.profileId,
        name: clientProfile.name,
        email: clientProfile.email,
        taxProfileId: clientTaxProfile.taxProfileId,
        taxProfileName: clientTaxProfile.name
      }
    }

    // Create invoice and update credits in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the invoice
      const invoice = await tx.invoice.create({
        data: {
          organizationId: clientProfile.parentOrganizationId!,
          createdByProfileId: clientProfile.profileId, // Client profile creates it
          status: 'generated',
          details: invoiceDetails
        }
      })

      // Increment client's credits used
      await tx.profile.update({
        where: { profileId: clientProfile.profileId },
        data: {
          creditsUsed: {
            increment: 1
          }
        }
      })

      // Deduct credit from organization
      await tx.organization.update({
        where: { organizationId: clientProfile.parentOrganizationId! },
        data: {
          creditBalance: {
            decrement: 1
          }
        }
      })

      return invoice
    })

    return NextResponse.json({
      success: true,
      message: 'Invoice generated successfully for client',
      invoice: {
        invoiceId: result.invoiceId,
        invoiceNumber: (result.details as any).invoiceNumber,
        totalAmount: (result.details as any).totalAmount,
        status: result.status,
        issueDate: (result.details as any).issueDate,
        clientName: clientProfile.name,
        taxProfileName: clientTaxProfile.name
      },
      clientCreditsRemaining: creditLimit - (creditsUsed + 1),
      organizationCreditsRemaining: clientProfile.parentOrganization.creditBalance - 1
    })

  } catch (error) {
    console.error('Error generating invoice for client:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}