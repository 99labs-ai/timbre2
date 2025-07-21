import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params
    const user = await currentUser()
    const { searchParams } = new URL(req.url)
    const limit = searchParams.get('limit')

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's profile and verify organization access
    const profile = await prisma.profile.findUnique({
      where: { authUserId: user.id },
      include: {
        organizationProfiles: {
          where: { organizationId }
        }
      }
    })

    if (!profile || profile.organizationProfiles.length === 0) {
      return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 403 })
    }

    // Fetch invoices for the organization
    const queryOptions: any = {
      where: { organizationId },
      include: {
        createdByProfile: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    }

    // Add limit only if specified (for dashboard recent activity)
    if (limit) {
      queryOptions.take = parseInt(limit)
    }

    const invoices = await prisma.invoice.findMany(queryOptions)

    // Format the invoices for the frontend
    const formattedInvoices = invoices.map(invoice => ({
      invoiceId: invoice.invoiceId,
      invoiceNumber: (invoice.details as any)?.invoiceNumber || 'N/A',
      totalAmount: (invoice.details as any)?.totalAmount || 0,
      currency: (invoice.details as any)?.currency || 'MXN',
      status: invoice.status,
      createdAt: invoice.createdAt,
      createdBy: invoice.createdByProfile.name || 'Unknown',
      details: invoice.details // Include full details for the invoices page
    }))

    return NextResponse.json({
      invoices: formattedInvoices
    })

  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}