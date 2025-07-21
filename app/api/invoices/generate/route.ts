import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  try {
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

    const organization = profile.organizationProfiles[0].organization

    // Check if organization has credits
    if (organization.creditBalance <= 0) {
      return NextResponse.json({ error: 'Insufficient credits. Please purchase more credits to generate invoices.' }, { status: 400 })
    }

    // Check if organization has tax information
    if (!organization.taxInformation) {
      return NextResponse.json({ error: 'Tax information not configured. Please update your tax information first.' }, { status: 400 })
    }

    // Generate dummy invoice data
    const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
    const currentDate = new Date()
    const dueDate = new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days from now

    // Prepare invoice details for JSON storage
    const invoiceDetails = {
      invoiceNumber,
      issueDate: currentDate.toISOString(),
      dueDate: dueDate.toISOString(),
      currency: 'MXN',
      subtotal: 1000.00, // $1,000 MXN dummy amount
      taxAmount: 160.00,  // 16% IVA
      totalAmount: 1160.00,
      recipientName: 'Cliente Ejemplo S.A. de C.V.',
      recipientRfc: 'XAXX010101000',
      recipientAddress: 'Calle Ejemplo #123, Col. Centro, Ciudad de México, CP 01000',
      description: 'Servicios de ejemplo - Factura generada automáticamente',
      paymentMethod: 'Transferencia electrónica',
      cfdiUse: 'G03', // Gastos en general
      fiscalRegimen: '601', // General de Ley Personas Morales
      issuerInfo: {
        rfc: organization.taxInformation.taxId,
        taxpayer: organization.taxInformation.taxpayer,
        address: `${organization.taxInformation.postalCode}, ${organization.taxInformation.country}`,
        fiscalRegimen: organization.taxInformation.invoiceFiscalRegimen
      }
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create the invoice
      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          createdByProfileId: profile.profileId,
          status: 'generated',
          details: invoiceDetails
        }
      })

      // Deduct one credit from organization
      await tx.organization.update({
        where: { organizationId },
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
      message: 'Invoice generated successfully',
      invoice: {
        invoiceId: result.invoiceId,
        invoiceNumber: (result.details as any).invoiceNumber,
        totalAmount: (result.details as any).totalAmount,
        status: result.status,
        issueDate: (result.details as any).issueDate,
      },
      remainingCredits: organization.creditBalance - 1
    })

  } catch (error) {
    console.error('Error generating invoice:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}