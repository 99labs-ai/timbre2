'use client'

import { useEffect, useState } from 'react'
import { useUser, UserButton } from '@clerk/nextjs'

interface Organization {
  organizationId: string
  name: string
  organizationType: 'persona_fisica' | 'persona_moral' | 'despacho_contable'
  isPersonal: boolean
  role: 'admin' | 'member'
  creditBalance: number
  taxInformation?: {
    taxId: string
    taxpayer: string
  }
  subscription?: {
    status: 'active' | 'canceled' | 'past_due' | 'incomplete'
    planType: string
    currentPeriodEnd: string
  }
}

interface RecentInvoice {
  invoiceId: string
  invoiceNumber: string
  totalAmount: number
  currency: string
  status: string
  createdAt: string
  createdBy: string
}

interface DashboardState {
  organizations: Organization[]
  currentOrganization: Organization | null
  recentInvoices: RecentInvoice[]
  isLoading: boolean
  showInviteModal: boolean
  showCreateOrgModal: boolean
  showSubscriptionModal: boolean
}

export default function DashboardPage() {
  const { user } = useUser()
  const [state, setState] = useState<DashboardState>({
    organizations: [],
    currentOrganization: null,
    recentInvoices: [],
    isLoading: true,
    showInviteModal: false,
    showCreateOrgModal: false,
    showSubscriptionModal: false
  })

  const [inviteEmail, setInviteEmail] = useState('')
  
  const [newOrgData, setNewOrgData] = useState({
    name: '',
    organizationType: 'persona_moral' as 'persona_fisica' | 'persona_moral' | 'despacho_contable',
    taxData: {
      taxId: '',
      taxpayer: '',
      country: 'México',
      postalCode: '',
      invoiceCfdiUse: '',
      invoiceFiscalRegimen: ''
    }
  })

  const [plans, setPlans] = useState<any[]>([])

  const getOrganizationTypeLabel = (type: string) => {
    switch (type) {
      case 'persona_fisica': return 'Persona Física'
      case 'persona_moral': return 'Persona Moral'
      case 'despacho_contable': return 'Despacho Contable'
      default: return type
    }
  }

  const fetchRecentInvoices = async (organizationId: string) => {
    try {
      const response = await fetch(`/api/organizations/${organizationId}/invoices?limit=10`)
      const data = await response.json()
      
      if (response.ok && data.invoices) {
        setState(prev => ({
          ...prev,
          recentInvoices: data.invoices
        }))
      }
    } catch (error) {
      console.error('Error fetching recent invoices:', error)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch organizations and plans in parallel
        const [orgsResponse, plansResponse] = await Promise.all([
          fetch('/api/organizations'),
          fetch('/api/stripe/plans')
        ])
        
        const orgsData = await orgsResponse.json()
        const plansData = await plansResponse.json()
        
        if (orgsData.organizations) {
          // Try to get cached organization ID from localStorage
          const cachedOrgId = localStorage.getItem('selectedOrganizationId')
          let currentOrg = null
          
          if (cachedOrgId) {
            // Find the cached organization in the list
            currentOrg = orgsData.organizations.find((org: Organization) => org.organizationId === cachedOrgId)
          }
          
          // If no cached org or cached org not found, use the first one
          if (!currentOrg) {
            currentOrg = orgsData.organizations[0] || null
            // Cache the new selection
            if (currentOrg) {
              localStorage.setItem('selectedOrganizationId', currentOrg.organizationId)
            }
          }

          setState(prev => ({
            ...prev,
            organizations: orgsData.organizations,
            currentOrganization: currentOrg,
            isLoading: false
          }))

          // Fetch recent invoices for the current organization
          if (currentOrg) {
            fetchRecentInvoices(currentOrg.organizationId)
          }
        }

        if (plansData.plans) {
          setPlans(plansData.plans)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        setState(prev => ({ ...prev, isLoading: false }))
      }
    }

    fetchData()
  }, [])

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.currentOrganization || !inviteEmail) return

    try {
      const response = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          organizationId: state.currentOrganization.organizationId
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Invitación enviada. Link: ${data.invitationLink}`)
        setInviteEmail('')
        setState(prev => ({ ...prev, showInviteModal: false }))
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error sending invitation:', error)
      alert('Error enviando invitación')
    }
  }

  const handleCreatePersonalOrg = () => {
    window.location.href = '/onboarding'
  }

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newOrgData.name || !newOrgData.taxData.taxId || !newOrgData.taxData.taxpayer) {
      alert('Por favor completa todos los campos obligatorios')
      return
    }

    try {
      const response = await fetch('/api/organizations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: newOrgData.name,
          organizationType: newOrgData.organizationType,
          taxData: newOrgData.taxData
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        // Add the new organization to the list
        const newOrg = {
          ...data.organization,
          role: 'admin' as const
        }
        
        setState(prev => ({
          ...prev,
          organizations: [...prev.organizations, newOrg],
          currentOrganization: newOrg,
          showCreateOrgModal: false
        }))

        // Reset form
        setNewOrgData({
          name: '',
          organizationType: 'persona_moral' as 'persona_fisica' | 'persona_moral' | 'despacho_contable',
          taxData: {
            taxId: '',
            taxpayer: '',
            country: 'México',
            postalCode: '',
            invoiceCfdiUse: '',
            invoiceFiscalRegimen: ''
          }
        })

        alert('¡Organización creada exitosamente!')
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating organization:', error)
      alert('Error creando la organización')
    }
  }

  const handleSubscribe = async (priceId: string) => {
    if (!state.currentOrganization) return

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: state.currentOrganization.organizationId,
          priceId
        })
      })

      if (response.ok) {
        const data = await response.json()
        window.location.href = data.sessionUrl
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Error iniciando suscripción')
    }
  }

  const handleBillingPortal = async () => {
    if (!state.currentOrganization) return

    try {
      const response = await fetch('/api/stripe/billing-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: state.currentOrganization.organizationId
        })
      })

      if (response.ok) {
        const data = await response.json()
        window.location.href = data.sessionUrl
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error accessing billing portal:', error)
      alert('Error accediendo al portal de facturación')
    }
  }

  const handleGenerateInvoice = async () => {
    if (!state.currentOrganization) return

    try {
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: state.currentOrganization.organizationId
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Update credit balance in state
        setState(prev => ({
          ...prev,
          currentOrganization: prev.currentOrganization ? {
            ...prev.currentOrganization,
            creditBalance: data.remainingCredits
          } : null
        }))

        alert(`¡Factura generada exitosamente!\n\nNúmero: ${data.invoice.invoiceNumber}\nTotal: $${data.invoice.totalAmount} MXN\nCréditos restantes: ${data.remainingCredits}`)
        
        // Refresh recent invoices
        fetchRecentInvoices(state.currentOrganization.organizationId)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error generating invoice:', error)
      alert('Error generando la factura')
    }
  }

  if (state.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 lg:px-8">
          <h1 className="font-semibold">Timbre Dashboard</h1>
          
          <div className="ml-auto flex items-center space-x-4">
            {state.currentOrganization && (
              <select
                value={state.currentOrganization.organizationId}
                onChange={(e) => {
                  const org = state.organizations.find(o => o.organizationId === e.target.value)
                  setState(prev => ({ ...prev, currentOrganization: org || null, recentInvoices: [] }))
                  
                  // Cache the selected organization
                  if (org) {
                    localStorage.setItem('selectedOrganizationId', org.organizationId)
                    fetchRecentInvoices(org.organizationId)
                  }
                }}
                className="px-3 py-1 border border-border rounded-md bg-background text-sm"
              >
                {state.organizations.map(org => (
                  <option key={org.organizationId} value={org.organizationId}>
                    {org.name} {org.isPersonal ? '(Personal)' : ''} 
                    {org.organizationType === 'despacho_contable' ? '(Despacho)' : ''}
                  </option>
                ))}
              </select>
            )}
            
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 lg:px-8">
        {/* Welcome Message */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">
            ¡Hola, {user?.firstName || 'Usuario'}!
          </h2>
          {state.currentOrganization ? (
            <p className="text-muted-foreground">
              Estás trabajando en: <span className="font-medium text-foreground">
                {state.currentOrganization.name}
              </span>
              <span className="ml-2 text-xs bg-muted px-2 py-1 rounded">
                {state.currentOrganization.role}
              </span>
              <span className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 px-2 py-1 rounded">
                {getOrganizationTypeLabel(state.currentOrganization.organizationType)}
              </span>
            </p>
          ) : (
            <p className="text-muted-foreground">No tienes organizaciones configuradas.</p>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Quick Stats */}
          <div className="col-span-full">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-medium mb-2">Facturas Generadas</h3>
                <p className="text-2xl font-bold">{state.recentInvoices.length}</p>
                <p className="text-xs text-muted-foreground">Total generadas</p>
              </div>
              
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-medium mb-2">Créditos Disponibles</h3>
                <p className="text-2xl font-bold">
                  {state.currentOrganization?.creditBalance || 0}
                </p>
                <p className="text-xs text-muted-foreground">Se renuevan con tu suscripción</p>
              </div>
              
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-medium mb-2">Suscripción</h3>
                {state.currentOrganization?.subscription ? (
                  <>
                    <p className={`text-2xl font-bold ${
                      state.currentOrganization.subscription.status === 'active' 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {state.currentOrganization.subscription.status === 'active' ? 'Activa' : 'Inactiva'}
                    </p>
                    {state.currentOrganization.subscription.status === 'active' && (
                      <p className="text-xs text-muted-foreground">
                        Plan {state.currentOrganization.subscription.planType}
                      </p>
                    )}
                    {state.currentOrganization.role === 'admin' && (
                      state.currentOrganization.subscription.status === 'active' ? (
                        <button 
                          onClick={handleBillingPortal}
                          className="text-xs text-blue-600 hover:underline mt-1"
                        >
                          Gestionar suscripción
                        </button>
                      ) : (
                        <button 
                          onClick={() => setState(prev => ({ ...prev, showSubscriptionModal: true }))}
                          className="text-xs text-blue-600 hover:underline mt-1"
                        >
                          Suscribirse
                        </button>
                      )
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-600">Sin Plan</p>
                    <p className="text-xs text-muted-foreground">Gratis</p>
                    {state.currentOrganization?.role === 'admin' && (
                      <button 
                        onClick={() => setState(prev => ({ ...prev, showSubscriptionModal: true }))}
                        className="text-xs text-blue-600 hover:underline mt-1"
                      >
                        Suscribirse
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Organization Actions */}
          {state.currentOrganization && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-medium mb-4">Acciones de Organización</h3>
              <div className="space-y-2">
                <button 
                  onClick={handleGenerateInvoice}
                  className="w-full text-left p-3 hover:bg-muted rounded-md border border-border"
                >
                  🧾 Generar Nueva Factura
                </button>

                <button 
                  onClick={() => window.location.href = `/dashboard/invoices?org=${state.currentOrganization!.organizationId}`}
                  className="w-full text-left p-3 hover:bg-muted rounded-md border border-border"
                >
                  📋 Ver Todas las Facturas
                </button>
                
                {state.currentOrganization.role === 'admin' && (
                  <>
                    <button 
                      onClick={() => setState(prev => ({ ...prev, showInviteModal: true }))}
                      className="w-full text-left p-3 hover:bg-muted rounded-md border border-border"
                    >
                      👥 Invitar Usuario
                    </button>
                    
                    <button 
                      onClick={() => window.location.href = `/dashboard/members?org=${state.currentOrganization!.organizationId}`}
                      className="w-full text-left p-3 hover:bg-muted rounded-md border border-border"
                    >
                      👨‍👩‍👧‍👦 Ver Miembros
                    </button>

                    <button 
                      onClick={() => window.location.href = `/dashboard/invoices?org=${state.currentOrganization!.organizationId}`}
                      className="w-full text-left p-3 hover:bg-muted rounded-md border border-border"
                    >
                      📊 Historial de Facturas
                    </button>

                    {state.currentOrganization.organizationType === 'despacho_contable' && (
                      <button 
                        onClick={() => window.location.href = `/dashboard/clients?org=${state.currentOrganization!.organizationId}`}
                        className="w-full text-left p-3 hover:bg-muted rounded-md border border-border"
                      >
                        👥 Gestionar Clientes
                      </button>
                    )}
                  </>
                )}
                
                <button 
                  onClick={() => window.location.href = `/dashboard/tax-info?org=${state.currentOrganization!.organizationId}`}
                  className="w-full text-left p-3 hover:bg-muted rounded-md border border-border"
                >
                  ⚙️ Configuración Fiscal
                </button>

                <button 
                  onClick={() => setState(prev => ({ ...prev, showCreateOrgModal: true }))}
                  className="w-full text-left p-3 hover:bg-muted rounded-md border border-border"
                >
                  🏢 Crear Nueva Organización
                </button>

                {!state.organizations.some(org => org.isPersonal) && (
                  <button 
                    onClick={handleCreatePersonalOrg}
                    className="w-full text-left p-3 hover:bg-muted rounded-md border border-border"
                  >
                    👤 Crear Organización Personal
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-medium mb-4">Actividad Reciente</h3>
            {state.recentInvoices.length > 0 ? (
              <div className="space-y-3">
                {state.recentInvoices.map((invoice) => (
                  <div 
                    key={invoice.invoiceId} 
                    className="flex items-center justify-between p-3 border border-border rounded-md hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">🧾 {invoice.invoiceNumber}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          invoice.status === 'generated' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                        }`}>
                          {invoice.status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        ${invoice.totalAmount.toFixed(2)} {invoice.currency} • {invoice.createdBy}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(invoice.createdAt).toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                {state.recentInvoices.length >= 5 && (
                  <div className="text-center pt-2">
                    <a 
                      href={`/dashboard/invoices?org=${state.currentOrganization?.organizationId}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Ver todas las facturas →
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">
                No hay facturas generadas
              </div>
            )}
          </div>
        </div>

        {/* Invite Modal */}
        {state.showInviteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="font-medium mb-4">Invitar Usuario</h3>
              <form onSubmit={handleInviteUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full p-2 border border-border rounded-md bg-background"
                    placeholder="usuario@ejemplo.com"
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="flex-1 bg-foreground text-background py-2 px-4 rounded-md hover:bg-opacity-90"
                  >
                    Enviar Invitación
                  </button>
                  <button
                    type="button"
                    onClick={() => setState(prev => ({ ...prev, showInviteModal: false }))}
                    className="flex-1 border border-border py-2 px-4 rounded-md hover:bg-muted"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Organization Modal */}
        {state.showCreateOrgModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h3 className="font-medium mb-4 text-xl">Crear Nueva Organización</h3>
                <form onSubmit={handleCreateOrganization} className="space-y-4">
                  {/* Organization Name */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Nombre de la Organización *</label>
                    <input
                      type="text"
                      required
                      value={newOrgData.name}
                      onChange={(e) => setNewOrgData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full p-2 border border-border rounded-md bg-background"
                      placeholder="Mi Empresa S.A. de C.V."
                    />
                  </div>

                  {/* Organization Type */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Tipo de Organización *</label>
                    <select
                      value={newOrgData.organizationType}
                      onChange={(e) => setNewOrgData(prev => ({ 
                        ...prev, 
                        organizationType: e.target.value as 'persona_fisica' | 'persona_moral' | 'despacho_contable'
                      }))}
                      className="w-full p-2 border border-border rounded-md bg-background"
                    >
                      <option value="persona_fisica">Persona Física</option>
                      <option value="persona_moral">Persona Moral</option>
                      <option value="despacho_contable">Despacho Contable</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {newOrgData.organizationType === 'persona_fisica' && 'Para individuos que facturan por servicios profesionales'}
                      {newOrgData.organizationType === 'persona_moral' && 'Para empresas constituidas legalmente'}
                      {newOrgData.organizationType === 'despacho_contable' && 'Para despachos que manejan clientes y generan facturas a nombre de terceros'}
                    </p>
                  </div>

                  <div className="border-t border-border pt-4">
                    <h4 className="font-medium mb-3">Información Fiscal</h4>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium mb-2">RFC *</label>
                        <input
                          type="text"
                          required
                          value={newOrgData.taxData.taxId}
                          onChange={(e) => setNewOrgData(prev => ({ 
                            ...prev, 
                            taxData: { ...prev.taxData, taxId: e.target.value }
                          }))}
                          className="w-full p-2 border border-border rounded-md bg-background"
                          placeholder="ABCD123456EFG"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Razón Social *</label>
                        <input
                          type="text"
                          required
                          value={newOrgData.taxData.taxpayer}
                          onChange={(e) => setNewOrgData(prev => ({ 
                            ...prev, 
                            taxData: { ...prev.taxData, taxpayer: e.target.value }
                          }))}
                          className="w-full p-2 border border-border rounded-md bg-background"
                          placeholder="Nombre completo o empresa"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Código Postal *</label>
                        <input
                          type="text"
                          required
                          value={newOrgData.taxData.postalCode}
                          onChange={(e) => setNewOrgData(prev => ({ 
                            ...prev, 
                            taxData: { ...prev.taxData, postalCode: e.target.value }
                          }))}
                          className="w-full p-2 border border-border rounded-md bg-background"
                          placeholder="12345"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">País</label>
                        <input
                          type="text"
                          value={newOrgData.taxData.country}
                          onChange={(e) => setNewOrgData(prev => ({ 
                            ...prev, 
                            taxData: { ...prev.taxData, country: e.target.value }
                          }))}
                          className="w-full p-2 border border-border rounded-md bg-background"
                          placeholder="México"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Uso de CFDI *</label>
                        <select
                          required
                          value={newOrgData.taxData.invoiceCfdiUse}
                          onChange={(e) => setNewOrgData(prev => ({ 
                            ...prev, 
                            taxData: { ...prev.taxData, invoiceCfdiUse: e.target.value }
                          }))}
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
                        <label className="block text-sm font-medium mb-2">Régimen Fiscal *</label>
                        <select
                          required
                          value={newOrgData.taxData.invoiceFiscalRegimen}
                          onChange={(e) => setNewOrgData(prev => ({ 
                            ...prev, 
                            taxData: { ...prev.taxData, invoiceFiscalRegimen: e.target.value }
                          }))}
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
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-4 border-t border-border">
                    <button
                      type="submit"
                      className="flex-1 bg-foreground text-background py-2 px-4 rounded-md hover:bg-opacity-90"
                    >
                      Crear Organización
                    </button>
                    <button
                      type="button"
                      onClick={() => setState(prev => ({ ...prev, showCreateOrgModal: false }))}
                      className="flex-1 border border-border py-2 px-4 rounded-md hover:bg-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Modal */}
        {state.showSubscriptionModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background border border-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-medium text-xl">Planes de Suscripción</h3>
                  <button
                    onClick={() => setState(prev => ({ ...prev, showSubscriptionModal: false }))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  {plans.map((plan) => (
                    <div 
                      key={plan.id} 
                      className={`relative bg-card border rounded-lg p-6 ${
                        plan.popular ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-border'
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                            Más Popular
                          </span>
                        </div>
                      )}
                      
                      <div className="text-center mb-6">
                        <h4 className="text-lg font-semibold mb-2">{plan.name}</h4>
                        <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                        <div className="mb-4">
                          <span className="text-3xl font-bold">{plan.price}</span>
                          <span className="text-muted-foreground">/{plan.interval}</span>
                        </div>
                      </div>

                      <ul className="space-y-3 mb-6">
                        {plan.features.map((feature: string, index: number) => (
                          <li key={index} className="flex items-center text-sm">
                            <span className="text-green-500 mr-2">✓</span>
                            {feature}
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => {
                          setState(prev => ({ ...prev, showSubscriptionModal: false }))
                          handleSubscribe(plan.priceId)
                        }}
                        className={`w-full py-2 px-4 rounded-md font-medium ${
                          plan.popular
                            ? 'bg-blue-500 text-white hover:bg-blue-600'
                            : 'bg-foreground text-background hover:bg-opacity-90'
                        }`}
                        disabled={state.currentOrganization?.role !== 'admin'}
                      >
                        {state.currentOrganization?.role === 'admin' 
                          ? 'Seleccionar Plan' 
                          : 'Solo Administradores'
                        }
                      </button>
                    </div>
                  ))}
                </div>

                {state.currentOrganization?.role !== 'admin' && (
                  <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Solo los administradores de la organización pueden gestionar suscripciones.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}