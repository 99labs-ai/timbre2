import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email, organizationId } = await req.json()

    if (!email || !organizationId) {
      return NextResponse.json({ error: 'Email and organizationId required' }, { status: 400 })
    }

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
      return NextResponse.json({ error: 'Not authorized for this organization' }, { status: 403 })
    }

    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        organizationId,
        inviteeEmail: email,
        status: 'pending',
        expiresAt: {
          gte: new Date()
        }
      }
    })

    if (existingInvitation) {
      return NextResponse.json({ error: 'Active invitation already exists' }, { status: 400 })
    }

    const existingMember = await prisma.organizationProfile.findFirst({
      where: {
        organizationId,
        profile: {
          email
        }
      }
    })

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 400 })
    }

    const token = crypto.randomBytes(32).toString('hex')

    const invitation = await prisma.invitation.create({
      data: {
        organizationId,
        invitedByProfileId: profile.profileId,
        inviteeEmail: email,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      },
      include: {
        organization: true
      }
    })

    // TODO: Send email with invitation link
    // The invitation link would be: ${process.env.NEXT_PUBLIC_APP_URL}/onboarding?token=${token}
    
    return NextResponse.json({ 
      invitation,
      invitationLink: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invitation?token=${token}`
    })

  } catch (error) {
    console.error('Error sending invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}