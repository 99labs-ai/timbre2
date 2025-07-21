'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser, UserButton } from '@clerk/nextjs'

interface TaxFormData {
  taxId: string
  taxpayer: string
  country: string
  postalCode: string
  invoiceCfdiUse: string
  invoiceFiscalRegimen: string
}

interface OnboardingState {
  profile: any
  hasPersonalOrg: boolean
  isNewUser: boolean
  isLoading: boolean
  step: 'loading' | 'invitation' | 'phone-info' | 'tax-form' | 'complete'
  invitationToken?: string
}

export default function OnboardingPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const invitationToken = searchParams.get('token')

  const [state, setState] = useState<OnboardingState>({
    profile: null,
    hasPersonalOrg: false,
    isNewUser: false,
    isLoading: true,
    step: 'loading',
    invitationToken: invitationToken || undefined
  })

  const [taxData, setTaxData] = useState<TaxFormData>({
    taxId: '',
    taxpayer: '',
    country: 'México',
    postalCode: '',
    invoiceCfdiUse: '',
    invoiceFiscalRegimen: ''
  })

  const [phoneNumber, setPhoneNumber] = useState('')
  const [organizationType, setOrganizationType] = useState<'persona_fisica' | 'persona_moral' | 'despacho_contable'>('persona_fisica')

  useEffect(() => {
    if (!isLoaded || !user) return

    const syncUser = async () => {
      try {
        const response = await fetch('/api/auth/sync', { method: 'POST' })
        const data = await response.json()
        
        // Check if user came from an invitation (token in URL or sessionStorage)
        const urlToken = new URLSearchParams(window.location.search).get('token')
        const storedToken = sessionStorage.getItem('invitation_token')
        const invitationToken = urlToken || storedToken
        
        if (invitationToken) {
          setState(prev => ({ 
            ...prev, 
            ...data, 
            isLoading: false,
            step: 'invitation',
            invitationToken
          }))
        } else if (data.hasPersonalOrg) {
          // User already has setup, go to dashboard
          router.push('/dashboard')
        } else {
          // Check if user already has phone number
          const needsPhone = !data.profile?.phone
          setState(prev => ({ 
            ...prev, 
            ...data, 
            isLoading: false,
            step: needsPhone ? 'phone-info' : 'tax-form'
          }))
          
          if (!needsPhone) {
            setPhoneNumber(data.profile?.phone || '')
          }
        }
      } catch (error) {
        console.error('Error syncing user:', error)
        setState(prev => ({ ...prev, isLoading: false }))
      }
    }

    syncUser()
  }, [isLoaded, user, router])

  const handleAcceptInvitation = async () => {
    if (!state.invitationToken) return

    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: state.invitationToken })
      })

      if (response.ok) {
        // Clear the stored token after successful acceptance
        sessionStorage.removeItem('invitation_token')
        router.push('/dashboard')
      } else {
        const error = await response.json()
        console.error('Failed to accept invitation:', error.error)
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error accepting invitation:', error)
      alert('Error procesando la invitación')
    }
  }

  const handleCreatePersonalOrg = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetch('/api/onboarding/personal-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          taxData,
          organizationType 
        })
      })

      if (response.ok) {
        setState(prev => ({ ...prev, step: 'complete' }))
        setTimeout(() => router.push('/dashboard'), 2000)
      } else {
        const errorData = await response.json()
        console.error('Failed to create personal organization:', errorData)
        alert(`Error creando organización: ${errorData.details || errorData.error || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error creating personal organization:', error)
    }
  }

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!phoneNumber.trim()) return

    try {
      const response = await fetch('/api/profile/update-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber })
      })

      if (response.ok) {
        setState(prev => ({ ...prev, step: 'tax-form' }))
      } else {
        console.error('Failed to update phone')
      }
    } catch (error) {
      console.error('Error updating phone:', error)
    }
  }

  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header with UserButton */}
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4 lg:px-8">
            <h1 className="font-semibold">Timbre - Configuración</h1>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>
        
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 3.5rem)' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto mb-4"></div>
            <p>Configurando tu cuenta...</p>
          </div>
        </div>
      </div>
    )
  }

  if (state.step === 'invitation') {
    return (
      <div className="min-h-screen bg-background">
        {/* Header with UserButton */}
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4 lg:px-8">
            <h1 className="font-semibold">Timbre - Invitación</h1>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>
        
        <div className="flex items-center justify-center p-4" style={{ height: 'calc(100vh - 3.5rem)' }}>
          <div className="max-w-md w-full space-y-6 text-center">
            <h1 className="text-2xl font-bold">¡Has sido invitado!</h1>
            <p className="text-muted-foreground">
              Te han invitado a unirte a una organización. ¿Deseas aceptar la invitación?
            </p>
            <div className="space-y-3">
              <button
                onClick={handleAcceptInvitation}
                className="w-full bg-foreground text-background py-2 px-4 rounded-md hover:bg-opacity-90"
              >
                Aceptar Invitación
              </button>
              <button
                onClick={() => {
                  const needsPhone = !state.profile?.phone
                  setState(prev => ({ 
                    ...prev, 
                    step: needsPhone ? 'phone-info' : 'tax-form' 
                  }))
                }}
                className="w-full border border-border py-2 px-4 rounded-md hover:bg-muted"
              >
                Crear mi propia organización
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (state.step === 'phone-info') {
    return (
      <div className="min-h-screen bg-background">
        {/* Header with UserButton */}
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4 lg:px-8">
            <h1 className="font-semibold">Timbre - Información de Contacto</h1>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>
        
        <div className="flex items-center justify-center p-4" style={{ height: 'calc(100vh - 3.5rem)' }}>
          <div className="max-w-md w-full space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Información de Contacto</h1>
              <p className="text-muted-foreground">
                Para completar tu perfil, necesitamos tu número de teléfono.
              </p>
            </div>

            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Número de Teléfono</label>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full p-2 border border-border rounded-md bg-background"
                  placeholder="+52 55 1234 5678"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-foreground text-background py-2 px-4 rounded-md hover:bg-opacity-90"
              >
                Continuar
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (state.step === 'complete') {
    return (
      <div className="min-h-screen bg-background">
        {/* Header with UserButton */}
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4 lg:px-8">
            <h1 className="font-semibold">Timbre - Completado</h1>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>
        
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 3.5rem)' }}>
          <div className="text-center">
            <div className="text-green-500 text-6xl mb-4">✓</div>
            <h1 className="text-2xl font-bold mb-2">¡Todo listo!</h1>
            <p>Redirigiendo al dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with UserButton */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4 lg:px-8">
          <h1 className="font-semibold">Timbre - Información Fiscal</h1>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>
      
      <div className="flex items-center justify-center p-4" style={{ height: 'calc(100vh - 3.5rem)' }}>
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Información Fiscal</h1>
            <p className="text-muted-foreground">
              Para comenzar a generar facturas, necesitamos tu información fiscal.
            </p>
          </div>

          <form onSubmit={handleCreatePersonalOrg} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de Organización</label>
              <select
                value={organizationType}
                onChange={(e) => setOrganizationType(e.target.value as 'persona_fisica' | 'persona_moral' | 'despacho_contable')}
                className="w-full p-2 border border-border rounded-md bg-background"
              >
                <option value="persona_fisica">Persona Física</option>
                <option value="persona_moral">Persona Moral</option>
                <option value="despacho_contable">Despacho Contable</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {organizationType === 'persona_fisica' && 'Para individuos que facturan por servicios profesionales'}
                {organizationType === 'persona_moral' && 'Para empresas constituidas legalmente'}
                {organizationType === 'despacho_contable' && 'Para despachos que manejan clientes y generan facturas a nombre de terceros'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">RFC</label>
              <input
                type="text"
                required
                value={taxData.taxId}
                onChange={(e) => setTaxData(prev => ({ ...prev, taxId: e.target.value }))}
                className="w-full p-2 border border-border rounded-md bg-background"
                placeholder="ABCD123456EFG"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Razón Social</label>
              <input
                type="text"
                required
                value={taxData.taxpayer}
                onChange={(e) => setTaxData(prev => ({ ...prev, taxpayer: e.target.value }))}
                className="w-full p-2 border border-border rounded-md bg-background"
                placeholder="Nombre completo o empresa"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Código Postal</label>
              <input
                type="text"
                required
                value={taxData.postalCode}
                onChange={(e) => setTaxData(prev => ({ ...prev, postalCode: e.target.value }))}
                className="w-full p-2 border border-border rounded-md bg-background"
                placeholder="12345"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Uso de CFDI</label>
              <select
                required
                value={taxData.invoiceCfdiUse}
                onChange={(e) => setTaxData(prev => ({ ...prev, invoiceCfdiUse: e.target.value }))}
                className="w-full p-2 border border-border rounded-md bg-background"
              >
                <option value="">Seleccionar uso</option>
                <option value="G01">Adquisición de mercancías</option>
                <option value="G02">Devoluciones, descuentos o bonificaciones</option>
                <option value="G03">Gastos en general</option>
                <option value="I01">Construcciones</option>
                <option value="P01">Por definir</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Régimen Fiscal</label>
              <select
                required
                value={taxData.invoiceFiscalRegimen}
                onChange={(e) => setTaxData(prev => ({ ...prev, invoiceFiscalRegimen: e.target.value }))}
                className="w-full p-2 border border-border rounded-md bg-background"
              >
                <option value="">Seleccionar régimen</option>
                <option value="601">General de Ley Personas Morales</option>
                <option value="603">Personas Morales con Fines no Lucrativos</option>
                <option value="605">Sueldos y Salarios e Ingresos Asimilados a Salarios</option>
                <option value="606">Arrendamiento</option>
                <option value="612">Personas Físicas con Actividades Empresariales y Profesionales</option>
                <option value="614">Ingresos por intereses</option>
                <option value="616">Sin obligaciones fiscales</option>
                <option value="621">Incorporación Fiscal</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-foreground text-background py-2 px-4 rounded-md hover:bg-opacity-90"
            >
              Crear Organización
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}