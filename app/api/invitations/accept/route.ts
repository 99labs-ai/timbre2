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
        organization: true
      }
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 })
    }

    if (invitation.inviteeEmail !== user.emailAddresses[0]?.emailAddress) {
      return NextResponse.json({ error: 'Email does not match invitation' }, { status: 400 })
    }

    const profile = await prisma.profile.findUnique({
      where: { authUserId: user.id },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.organizationProfile.create({
        data: {
          profileId: profile.profileId,
          organizationId: invitation.organizationId,
          role: 'member',
        },
      })

      await tx.invitation.update({
        where: { invitationId: invitation.invitationId },
        data: { status: 'accepted' }
      })

      return invitation.organization
    })

    return NextResponse.json({ organization: result })

  } catch (error) {
    console.error('Error accepting invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}