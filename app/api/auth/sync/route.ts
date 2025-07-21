import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'

export async function POST() {
  try {
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existingProfile = await prisma.profile.findUnique({
      where: { authUserId: user.id },
      include: {
        organizationProfiles: {
          include: {
            organization: true
          }
        }
      }
    })

    if (existingProfile) {
      return NextResponse.json({ 
        profile: existingProfile,
        hasPersonalOrg: existingProfile.organizationProfiles.some(op => op.organization.isPersonal)
      })
    }

    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim()
    
    const profile = await prisma.profile.create({
      data: {
        authUserId: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        name: fullName || null,
        phone: user.phoneNumbers[0]?.phoneNumber || null,
      },
    })

    return NextResponse.json({ 
      profile,
      hasPersonalOrg: false,
      isNewUser: true
    })

  } catch (error) {
    console.error('Error syncing user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}