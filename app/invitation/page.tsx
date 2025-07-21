'use client'

import { useEffect, useState, Suspense } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface InvitationData {
  invitationId: string
  organizationId: string
  inviteeEmail: string
  organization: {
    name: string
    isPersonal: boolean
  }
  invitedByProfile: {
    name: string
    email: string
  }
}

interface InvitationState {
  invitation: InvitationData | null
  isLoading: boolean
  error: string | null
  token: string | null
}

function InvitationPageContent() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [state, setState] = useState<InvitationState>({
    invitation: null,
    isLoading: true,
    error: null,
    token: null
  })

  useEffect(() => {
    const token = searchParams.get('token')
    
    if (!token) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Token de invitación no encontrado' 
      }))
      return
    }

    // Store token in sessionStorage for persistence across sign-in/sign-up
    sessionStorage.setItem('invitation_token', token)
    setState(prev => ({ ...prev, token }))

    // If user is loaded and signed in, validate the invitation
    if (isLoaded && user) {
      validateInvitation(token)
    } else if (isLoaded) {
      // User is not signed in, show auth options
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [searchParams, isLoaded, user])

  const validateInvitation = async (token: string) => {
    try {
      const response = await fetch('/api/invitations/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      const data = await response.json()

      if (response.ok) {
        setState(prev => ({ 
          ...prev, 
          invitation: data.invitation, 
          isLoading: false 
        }))
      } else {
        setState(prev => ({ 
          ...prev, 
          error: data.error || 'Invitación inválida', 
          isLoading: false 
        }))
      }
    } catch (error) {
      console.error('Error validating invitation:', error)
      setState(prev => ({ 
        ...prev, 
        error: 'Error validando la invitación', 
        isLoading: false 
      }))
    }
  }

  const handleAcceptInvitation = async () => {
    if (!state.token) return

    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: state.token })
      })

      if (response.ok) {
        // Clear the stored token
        sessionStorage.removeItem('invitation_token')
        router.push('/dashboard')
      } else {
        const error = await response.json()
        setState(prev => ({ ...prev, error: error.error }))
      }
    } catch (error) {
      console.error('Error accepting invitation:', error)
      setState(prev => ({ ...prev, error: 'Error procesando la invitación' }))
    }
  }

  if (state.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto mb-4"></div>
          <p>Validando invitación...</p>
        </div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold">Invitación Inválida</h1>
          <p className="text-muted-foreground">{state.error}</p>
          <Link
            href="/"
            className="inline-block bg-foreground text-background py-2 px-4 rounded-md hover:bg-opacity-90"
          >
            Ir al Inicio
          </Link>
        </div>
      </div>
    )
  }

  // User is not signed in - show auth options
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <div>
            <h1 className="text-2xl font-bold mb-2">¡Has sido invitado!</h1>
            <p className="text-muted-foreground">
              Para aceptar esta invitación, necesitas iniciar sesión o crear una cuenta.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href={`/sign-in?redirect_url=${encodeURIComponent('/invitation?token=' + state.token)}`}
              className="w-full bg-foreground text-background py-2 px-4 rounded-md hover:bg-opacity-90 block"
            >
              Ya tengo cuenta - Iniciar Sesión
            </Link>
            
            <Link
              href={`/sign-up?redirect_url=${encodeURIComponent('/invitation?token=' + state.token)}`}
              className="w-full border border-border py-2 px-4 rounded-md hover:bg-muted block"
            >
              Crear nueva cuenta
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            Al crear una cuenta o iniciar sesión, podrás aceptar la invitación a la organización.
          </p>
        </div>
      </div>
    )
  }

  // User is signed in and invitation is valid - show invitation details
  if (state.invitation) {
    // Check if email matches
    const userEmail = user.emailAddresses[0]?.emailAddress
    const invitationEmail = state.invitation.inviteeEmail

    if (userEmail !== invitationEmail) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="text-yellow-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold">Email No Coincide</h1>
            <p className="text-muted-foreground">
              Esta invitación fue enviada a <strong>{invitationEmail}</strong>, 
              pero estás conectado como <strong>{userEmail}</strong>.
            </p>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Puedes cerrar sesión e iniciar con la cuenta correcta, o contactar al administrador.
              </p>
              <Link
                href="/dashboard"
                className="inline-block bg-foreground text-background py-2 px-4 rounded-md hover:bg-opacity-90"
              >
                Ir al Dashboard
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <div>
            <h1 className="text-2xl font-bold mb-2">¡Has sido invitado!</h1>
            <p className="text-muted-foreground">
              {state.invitation.invitedByProfile.name || state.invitation.invitedByProfile.email} te ha invitado a unirte a:
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-2">
              {state.invitation.organization.name}
            </h3>
            {state.invitation.organization.isPersonal && (
              <span className="text-xs bg-muted px-2 py-1 rounded">
                Organización Personal
              </span>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={handleAcceptInvitation}
              className="w-full bg-foreground text-background py-2 px-4 rounded-md hover:bg-opacity-90"
            >
              Aceptar Invitación
            </button>
            
            <Link
              href="/dashboard"
              className="w-full border border-border py-2 px-4 rounded-md hover:bg-muted block"
            >
              Rechazar y ir al Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default function InvitationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InvitationPageContent />
    </Suspense>
  )
}