import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@clerk/nextjs/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: organizationId } = await params

    // Check if user is an admin of this organization
    const userRole = await prisma.organizationProfile.findFirst({
      where: {
        organizationId,
        profile: {
          authUserId: user.id
        },
        role: 'admin'
      }
    })

    if (!userRole) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Get all members of the organization
    const members = await prisma.organizationProfile.findMany({
      where: {
        organizationId
      },
      include: {
        profile: {
          select: {
            profileId: true,
            email: true,
            name: true,
            phone: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        profile: {
          createdAt: 'asc'
        }
      }
    })

    const formattedMembers = members.map(member => ({
      profileId: member.profile.profileId,
      email: member.profile.email,
      name: member.profile.name,
      phone: member.profile.phone,
      role: member.role,
      joinedAt: member.profile.createdAt
    }))

    return NextResponse.json({ members: formattedMembers })

  } catch (error) {
    console.error('Error fetching organization members:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { profileId } = await req.json()
    const { id: organizationId } = await params

    if (!profileId) {
      return NextResponse.json({ error: 'Profile ID required' }, { status: 400 })
    }

    // Check if user is an admin of this organization
    const userRole = await prisma.organizationProfile.findFirst({
      where: {
        organizationId,
        profile: {
          authUserId: user.id
        },
        role: 'admin'
      }
    })

    if (!userRole) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Don't allow admin to remove themselves if they're the only admin
    const adminCount = await prisma.organizationProfile.count({
      where: {
        organizationId,
        role: 'admin'
      }
    })

    const isRemovingAdmin = await prisma.organizationProfile.findFirst({
      where: {
        organizationId,
        profileId,
        role: 'admin'
      }
    })

    if (isRemovingAdmin && adminCount === 1) {
      return NextResponse.json({ 
        error: 'Cannot remove the last admin of the organization' 
      }, { status: 400 })
    }

    // Remove the member
    await prisma.organizationProfile.delete({
      where: {
        profileId_organizationId: {
          profileId,
          organizationId
        }
      }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error removing organization member:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}