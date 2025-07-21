'use client'

import { useEffect, useState } from 'react'
import { useUser, UserButton } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'

interface Member {
  profileId: string
  email: string
  name: string | null
  phone: string | null
  role: 'admin' | 'member'
  joinedAt: string
}

interface Organization {
  organizationId: string
  name: string
  isPersonal: boolean
  role: 'admin' | 'member'
}

export default function MembersPage() {
  const { user } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org')

  const [members, setMembers] = useState<Member[]>([])
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!orgId) {
      router.push('/dashboard')
      return
    }

    const fetchData = async () => {
      try {
        // Fetch user's organizations to get current org info
        const orgsResponse = await fetch('/api/organizations')
        const orgsData = await orgsResponse.json()
        
        const currentOrg = orgsData.organizations?.find((org: Organization) => org.organizationId === orgId)
        
        if (!currentOrg) {
          router.push('/dashboard')
          return
        }

        setOrganization(currentOrg)
        setIsAdmin(currentOrg.role === 'admin')

        if (currentOrg.role === 'admin') {
          // Fetch members if user is admin
          const membersResponse = await fetch(`/api/organizations/${orgId}/members`)
          const membersData = await membersResponse.json()
          
          if (membersData.members) {
            setMembers(membersData.members)
          }
        }

        setIsLoading(false)
      } catch (error) {
        console.error('Error fetching data:', error)
        setIsLoading(false)
      }
    }

    fetchData()
  }, [orgId, router])

  const handleRemoveMember = async (profileId: string, memberName: string) => {
    if (!confirm(`¿Estás seguro de que quieres remover a ${memberName || 'este miembro'}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/organizations/${orgId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId })
      })

      if (response.ok) {
        setMembers(prev => prev.filter(member => member.profileId !== profileId))
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error removing member:', error)
      alert('Error removiendo miembro')
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-4 lg:px-8">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm hover:underline"
            >
              ← Regresar al Dashboard
            </button>
            <div className="ml-auto">
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Acceso Denegado</h1>
            <p className="text-muted-foreground">
              Solo los administradores pueden ver la lista de miembros.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 lg:px-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm hover:underline"
          >
            ← Regresar al Dashboard
          </button>
          <div className="ml-auto">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">
            Miembros de {organization?.name}
          </h1>
          <p className="text-muted-foreground">
            Gestiona los usuarios que tienen acceso a esta organización.
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/50">
            <h3 className="font-medium">Miembros ({members.length})</h3>
          </div>
          
          <div className="divide-y divide-border">
            {members.map((member) => (
              <div key={member.profileId} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {member.name ? member.name.charAt(0).toUpperCase() : member.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-foreground truncate">
                            {member.name || member.email}
                          </p>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            member.role === 'admin' 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                          }`}>
                            {member.role}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>{member.email}</span>
                          {member.phone && (
                            <span>{member.phone}</span>
                          )}
                        </div>
                        
                        <p className="text-xs text-muted-foreground">
                          Se unió el {new Date(member.joinedAt).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {member.role !== 'admin' && (
                      <button
                        onClick={() => handleRemoveMember(member.profileId, member.name || member.email)}
                        className="text-sm text-red-600 hover:text-red-800 hover:underline"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {members.length === 0 && (
              <div className="px-6 py-8 text-center text-muted-foreground">
                No hay miembros en esta organización.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}