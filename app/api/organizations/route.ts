import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'

export async function GET() {
  try {
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { authUserId: user.id },
      include: {
        organizationProfiles: {
          include: {
            organization: {
              include: {
                taxInformation: true,
                subscription: true
              }
            }
          }
        }
      }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const organizations = profile.organizationProfiles.map(op => ({
      ...op.organization,
      role: op.role
    }))

    return NextResponse.json({ organizations })

  } catch (error) {
    console.error('Error fetching organizations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}