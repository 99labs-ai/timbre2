'use client'

import { useEffect, useState, Suspense } from 'react'
import { useUser, UserButton } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'

interface TaxProfile {
  taxProfileId: string
  name: string
  taxId: string
  taxpayer: string
  isDefault: boolean
}

interface Client {
  profileId: string
  name: string
  email: string
  phone?: string
  creditLimit: number
  creditsUsed: number
  isActive: boolean
  taxProfiles: TaxProfile[]
  createdAt: string
}

interface Organization {
  organizationId: string
  name: string
  isPersonal: boolean
  role: 'admin' | 'member'
}

function ClientsPageContent() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const organizationId = searchParams.get('org') || (typeof window !== 'undefined' ? localStorage.getItem('selectedOrganizationId') : null)

  const [clients, setClients] = useState<Client[]>([])
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
    creditLimit: 50,
    taxProfiles: [{
      name: 'Principal',
      taxId: '',
      taxpayer: '',
      country: 'México',
      postalCode: '',
      invoiceCfdiUse: 'G03',
      invoiceFiscalRegimen: '601'
    }]
  })

  useEffect(() => {
    const fetchData = async () => {
      if (!organizationId) {
        setIsLoading(false)
        return
      }

      try {
        // Fetch clients and organization info in parallel
        const [clientsResponse, orgsResponse] = await Promise.all([
          fetch(`/api/organizations/${organizationId}/clients`),
          fetch('/api/organizations')
        ])

        const clientsData = await clientsResponse.json()
        const orgsData = await orgsResponse.json()

        if (clientsResponse.ok && clientsData.clients) {
          setClients(clientsData.clients)
        }

        if (orgsResponse.ok && orgsData.organizations) {
          const currentOrg = orgsData.organizations.find((org: Organization) => org.organizationId === organizationId)
          setOrganization(currentOrg || null)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [organizationId])

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization || !organizationId) return

    setIsSaving(true)

    try {
      const response = await fetch(`/api/organizations/${organizationId}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient)
      })

      const data = await response.json()

      if (response.ok) {
        setClients(prev => [data.client, ...prev])
        setShowCreateModal(false)
        setNewClient({
          name: '',
          email: '',
          phone: '',
          creditLimit: 50,
          taxProfiles: [{
            name: 'Principal',
            taxId: '',
            taxpayer: '',
            country: 'México',
            postalCode: '',
            invoiceCfdiUse: 'G03',
            invoiceFiscalRegimen: '601'
          }]
        })
        alert('Cliente creado exitosamente')
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error creating client:', error)
      alert('Error creando el cliente')
    } finally {
      setIsSaving(false)
    }
  }

  const addTaxProfile = () => {
    setNewClient(prev => ({
      ...prev,
      taxProfiles: [...prev.taxProfiles, {
        name: `Perfil ${prev.taxProfiles.length + 1}`,
        taxId: '',
        taxpayer: '',
        country: 'México',
        postalCode: '',
        invoiceCfdiUse: 'G03',
        invoiceFiscalRegimen: '601'
      }]
    }))
  }

  const removeTaxProfile = (index: number) => {
    if (newClient.taxProfiles.length > 1) {
      setNewClient(prev => ({
        ...prev,
        taxProfiles: prev.taxProfiles.filter((_, i) => i !== index)
      }))
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    )
  }

  if (!organizationId) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-4 lg:px-8">
            <h1 className="font-semibold">Clientes</h1>
            <div className="ml-auto">
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8 lg:px-8">
          <div className="text-center">
            <p className="text-muted-foreground">No se especificó una organización.</p>
            <a href="/dashboard" className="text-blue-600 hover:underline mt-4 inline-block">
              Volver al Dashboard
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-4 lg:px-8">
            <h1 className="font-semibold">Clientes</h1>
            <div className="ml-auto">
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8 lg:px-8">
          <div className="text-center">
            <p className="text-muted-foreground">Organización no encontrada o acceso denegado.</p>
            <a href="/dashboard" className="text-blue-600 hover:underline mt-4 inline-block">
              Volver al Dashboard
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (organization.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-4 lg:px-8">
            <div className="flex items-center space-x-4">
              <a href="/dashboard" className="text-muted-foreground hover:text-foreground">← Dashboard</a>
              <h1 className="font-semibold">Clientes</h1>
            </div>
            <div className="ml-auto">
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8 lg:px-8">
          <div className="text-center">
            <p className="text-muted-foreground">Solo los administradores pueden gestionar clientes.</p>
            <a href="/dashboard" className="text-blue-600 hover:underline mt-4 inline-block">
              Volver al Dashboard
            </a>
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
          <div className="flex items-center space-x-4">
            <a href="/dashboard" className="text-muted-foreground hover:text-foreground">← Dashboard</a>
            <h1 className="font-semibold">Clientes</h1>
          </div>
          
          <div className="ml-auto">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 lg:px-8">
        {/* Organization Info & Actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Clientes - {organization.name}</h2>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span className="flex items-center">
                {organization.isPersonal ? '👤 Personal' : '🏢 Organización'}
              </span>
              <span className="flex items-center">
                👥 {clients.length} clientes
              </span>
            </div>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-foreground text-background px-4 py-2 rounded-md hover:bg-opacity-90"
          >
            Crear Cliente
          </button>
        </div>

        {/* Clients Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {clients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-medium">Cliente</th>
                    <th className="text-left p-4 font-medium">Contacto</th>
                    <th className="text-left p-4 font-medium">Perfiles Fiscales</th>
                    <th className="text-left p-4 font-medium">Créditos</th>
                    <th className="text-left p-4 font-medium">Estado</th>
                    <th className="text-left p-4 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.profileId} className="border-b border-border hover:bg-muted/30">
                      <td className="p-4">
                        <div>
                          <div className="font-medium">{client.name}</div>
                          <div className="text-sm text-muted-foreground">{client.email}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {client.phone || 'Sin teléfono'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          {client.taxProfiles.map(tax => (
                            <div key={tax.taxProfileId} className="text-sm">
                              <span className="font-medium">{tax.name}</span>
                              {tax.isDefault && <span className="ml-1 text-xs bg-blue-100 text-blue-800 px-1 rounded">Principal</span>}
                              <div className="text-xs text-muted-foreground">{tax.taxId}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          <div>{client.creditsUsed} / {client.creditLimit}</div>
                          <div className="text-xs text-muted-foreground">
                            {client.creditLimit - client.creditsUsed} disponibles
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          client.isActive 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                          {client.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {new Date(client.createdAt).toLocaleDateString('es-MX', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-lg font-medium mb-2">No hay clientes</h3>
              <p className="text-muted-foreground mb-4">
                Crea tu primer perfil de cliente para comenzar a generar facturas.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 bg-foreground text-background rounded-md hover:bg-opacity-90"
              >
                Crear Primer Cliente
              </button>
            </div>
          )}
        </div>

        {/* Create Client Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background border border-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-medium">Crear Nuevo Cliente</h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateClient} className="space-y-6">
                  {/* Client Info */}
                  <div>
                    <h4 className="font-medium mb-3">Información del Cliente</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium mb-2">Nombre *</label>
                        <input
                          type="text"
                          required
                          value={newClient.name}
                          onChange={(e) => setNewClient(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full p-3 border border-border rounded-md bg-background"
                          placeholder="Juan Pérez"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Email *</label>
                        <input
                          type="email"
                          required
                          value={newClient.email}
                          onChange={(e) => setNewClient(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full p-3 border border-border rounded-md bg-background"
                          placeholder="juan@example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Teléfono</label>
                        <input
                          type="tel"
                          value={newClient.phone}
                          onChange={(e) => setNewClient(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full p-3 border border-border rounded-md bg-background"
                          placeholder="+52 555 123 4567"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Límite de Créditos</label>
                        <input
                          type="number"
                          min="0"
                          value={newClient.creditLimit}
                          onChange={(e) => setNewClient(prev => ({ ...prev, creditLimit: parseInt(e.target.value) || 0 }))}
                          className="w-full p-3 border border-border rounded-md bg-background"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tax Profiles */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Perfiles Fiscales</h4>
                      <button
                        type="button"
                        onClick={addTaxProfile}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        + Agregar Perfil
                      </button>
                    </div>
                    
                    {newClient.taxProfiles.map((taxProfile, index) => (
                      <div key={index} className="border border-border rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium">Perfil {index + 1}</h5>
                          {newClient.taxProfiles.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTaxProfile(index)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                        
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="block text-sm font-medium mb-2">Nombre del Perfil *</label>
                            <input
                              type="text"
                              required
                              value={taxProfile.name}
                              onChange={(e) => {
                                const updated = [...newClient.taxProfiles]
                                updated[index].name = e.target.value
                                setNewClient(prev => ({ ...prev, taxProfiles: updated }))
                              }}
                              className="w-full p-2 border border-border rounded-md bg-background"
                              placeholder="Personal, Empresa, etc."
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">RFC *</label>
                            <input
                              type="text"
                              required
                              value={taxProfile.taxId}
                              onChange={(e) => {
                                const updated = [...newClient.taxProfiles]
                                updated[index].taxId = e.target.value
                                setNewClient(prev => ({ ...prev, taxProfiles: updated }))
                              }}
                              className="w-full p-2 border border-border rounded-md bg-background"
                              placeholder="ABCD123456EFG"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium mb-2">Razón Social *</label>
                            <input
                              type="text"
                              required
                              value={taxProfile.taxpayer}
                              onChange={(e) => {
                                const updated = [...newClient.taxProfiles]
                                updated[index].taxpayer = e.target.value
                                setNewClient(prev => ({ ...prev, taxProfiles: updated }))
                              }}
                              className="w-full p-2 border border-border rounded-md bg-background"
                              placeholder="Nombre completo o razón social"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">Código Postal *</label>
                            <input
                              type="text"
                              required
                              value={taxProfile.postalCode}
                              onChange={(e) => {
                                const updated = [...newClient.taxProfiles]
                                updated[index].postalCode = e.target.value
                                setNewClient(prev => ({ ...prev, taxProfiles: updated }))
                              }}
                              className="w-full p-2 border border-border rounded-md bg-background"
                              placeholder="12345"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">Uso de CFDI *</label>
                            <select
                              required
                              value={taxProfile.invoiceCfdiUse}
                              onChange={(e) => {
                                const updated = [...newClient.taxProfiles]
                                updated[index].invoiceCfdiUse = e.target.value
                                setNewClient(prev => ({ ...prev, taxProfiles: updated }))
                              }}
                              className="w-full p-2 border border-border rounded-md bg-background"
                            >
                              <option value="">Seleccionar uso</option>
                              <option value="G01">G01 - Adquisición de mercancías</option>
                              <option value="G02">G02 - Devoluciones, descuentos o bonificaciones</option>
                              <option value="G03">G03 - Gastos en general</option>
                              <option value="I01">I01 - Construcciones</option>
                              <option value="P01">P01 - Por definir</option>
                            </select>
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium mb-2">Régimen Fiscal *</label>
                            <select
                              required
                              value={taxProfile.invoiceFiscalRegimen}
                              onChange={(e) => {
                                const updated = [...newClient.taxProfiles]
                                updated[index].invoiceFiscalRegimen = e.target.value
                                setNewClient(prev => ({ ...prev, taxProfiles: updated }))
                              }}
                              className="w-full p-2 border border-border rounded-md bg-background"
                            >
                              <option value="">Seleccionar régimen</option>
                              <option value="601">601 - General de Ley Personas Morales</option>
                              <option value="603">603 - Personas Morales con Fines no Lucrativos</option>
                              <option value="605">605 - Sueldos y Salarios e Ingresos Asimilados a Salarios</option>
                              <option value="606">606 - Arrendamiento</option>
                              <option value="612">612 - Personas Físicas con Actividades Empresariales y Profesionales</option>
                              <option value="614">614 - Ingresos por intereses</option>
                              <option value="616">616 - Sin obligaciones fiscales</option>
                              <option value="621">621 - Incorporación Fiscal</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex space-x-3 pt-6 border-t border-border">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="bg-foreground text-background px-6 py-2 rounded-md hover:bg-opacity-90 disabled:opacity-50"
                    >
                      {isSaving ? 'Creando...' : 'Crear Cliente'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      disabled={isSaving}
                      className="border border-border px-6 py-2 rounded-md hover:bg-muted disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ClientsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    }>
      <ClientsPageContent />
    </Suspense>
  )
}