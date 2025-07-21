import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { token } = await req.json()

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    const invitation = await prisma.invitation.findUnique({
      where: { 
        token,
        status: 'pending',
        expiresAt: {
          gte: new Date()
        }
      },
      include: {
        organization: {
          select: {
            organizationId: true,
            name: true,
            isPersonal: true
          }
        },
        invitedByProfile: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Invitación inválida o expirada' }, { status: 404 })
    }

    // Check if user is already a member of this organization
    const existingMembership = await prisma.organizationProfile.findFirst({
      where: {
        organizationId: invitation.organizationId,
        profile: {
          authUserId: user.id
        }
      }
    })

    if (existingMembership) {
      return NextResponse.json({ error: 'Ya eres miembro de esta organización' }, { status: 400 })
    }

    return NextResponse.json({ invitation })

  } catch (error) {
    console.error('Error validating invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}