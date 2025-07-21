'use client'

import { useEffect, useState } from 'react'
import { useUser, UserButton } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'

interface TaxInformation {
  taxId: string
  taxpayer: string
  country: string
  postalCode: string
  invoiceCfdiUse: string
  invoiceFiscalRegimen: string
}

interface Organization {
  organizationId: string
  name: string
  isPersonal: boolean
  role: 'admin' | 'member'
  taxInformation: TaxInformation
}

export default function TaxInfoPage() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const organizationId = searchParams.get('org') || (typeof window !== 'undefined' ? localStorage.getItem('selectedOrganizationId') : null)

  const [organization, setOrganization] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editData, setEditData] = useState<TaxInformation>({
    taxId: '',
    taxpayer: '',
    country: '',
    postalCode: '',
    invoiceCfdiUse: '',
    invoiceFiscalRegimen: ''
  })

  useEffect(() => {
    const fetchTaxInfo = async () => {
      if (!organizationId) {
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/organizations/${organizationId}/tax-info`)
        const data = await response.json()

        if (response.ok && data.organization) {
          setOrganization(data.organization)
          setEditData(data.organization.taxInformation)
        } else {
          console.error('Error fetching tax info:', data.error)
        }
      } catch (error) {
        console.error('Error fetching tax info:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTaxInfo()
  }, [organizationId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization || !organizationId) return

    setIsSaving(true)

    try {
      const response = await fetch(`/api/organizations/${organizationId}/tax-info`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      })

      const data = await response.json()

      if (response.ok) {
        setOrganization(prev => prev ? { ...prev, taxInformation: editData } : null)
        setIsEditing(false)
        alert('Información fiscal actualizada exitosamente')
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error updating tax info:', error)
      alert('Error actualizando la información fiscal')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (organization) {
      setEditData(organization.taxInformation)
    }
    setIsEditing(false)
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
            <h1 className="font-semibold">Información Fiscal</h1>
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
            <h1 className="font-semibold">Información Fiscal</h1>
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 lg:px-8">
          <div className="flex items-center space-x-4">
            <a 
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground"
            >
              ← Dashboard
            </a>
            <h1 className="font-semibold">Información Fiscal</h1>
          </div>
          
          <div className="ml-auto">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 lg:px-8 max-w-4xl">
        {/* Organization Info */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">
            {organization.name}
          </h2>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span className="flex items-center">
              {organization.isPersonal ? '👤 Personal' : '🏢 Organización'}
            </span>
            <span className="flex items-center">
              🔑 {organization.role}
            </span>
          </div>
        </div>

        {/* Tax Information Card */}
        <div className="bg-card border border-border rounded-lg">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium">Información Fiscal</h3>
              {organization.role === 'admin' && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-foreground text-background px-4 py-2 rounded-md hover:bg-opacity-90"
                >
                  Editar
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-2">RFC *</label>
                    <input
                      type="text"
                      required
                      value={editData.taxId}
                      onChange={(e) => setEditData(prev => ({ ...prev, taxId: e.target.value }))}
                      className="w-full p-3 border border-border rounded-md bg-background"
                      placeholder="ABCD123456EFG"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Razón Social *</label>
                    <input
                      type="text"
                      required
                      value={editData.taxpayer}
                      onChange={(e) => setEditData(prev => ({ ...prev, taxpayer: e.target.value }))}
                      className="w-full p-3 border border-border rounded-md bg-background"
                      placeholder="Nombre completo o empresa"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">País *</label>
                    <input
                      type="text"
                      required
                      value={editData.country}
                      onChange={(e) => setEditData(prev => ({ ...prev, country: e.target.value }))}
                      className="w-full p-3 border border-border rounded-md bg-background"
                      placeholder="México"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Código Postal *</label>
                    <input
                      type="text"
                      required
                      value={editData.postalCode}
                      onChange={(e) => setEditData(prev => ({ ...prev, postalCode: e.target.value }))}
                      className="w-full p-3 border border-border rounded-md bg-background"
                      placeholder="12345"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Uso de CFDI *</label>
                    <select
                      required
                      value={editData.invoiceCfdiUse}
                      onChange={(e) => setEditData(prev => ({ ...prev, invoiceCfdiUse: e.target.value }))}
                      className="w-full p-3 border border-border rounded-md bg-background"
                    >
                      <option value="">Seleccionar uso</option>
                      <option value="G01">G01 - Adquisición de mercancías</option>
                      <option value="G02">G02 - Devoluciones, descuentos o bonificaciones</option>
                      <option value="G03">G03 - Gastos en general</option>
                      <option value="I01">I01 - Construcciones</option>
                      <option value="P01">P01 - Por definir</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Régimen Fiscal *</label>
                    <select
                      required
                      value={editData.invoiceFiscalRegimen}
                      onChange={(e) => setEditData(prev => ({ ...prev, invoiceFiscalRegimen: e.target.value }))}
                      className="w-full p-3 border border-border rounded-md bg-background"
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

                <div className="flex space-x-3 pt-6 border-t border-border">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-foreground text-background px-6 py-2 rounded-md hover:bg-opacity-90 disabled:opacity-50"
                  >
                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="border border-border px-6 py-2 rounded-md hover:bg-muted disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">RFC</label>
                    <p className="text-lg">{organization.taxInformation.taxId}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Razón Social</label>
                    <p className="text-lg">{organization.taxInformation.taxpayer}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">País</label>
                    <p className="text-lg">{organization.taxInformation.country}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Código Postal</label>
                    <p className="text-lg">{organization.taxInformation.postalCode}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Uso de CFDI</label>
                    <p className="text-lg">{organization.taxInformation.invoiceCfdiUse}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Régimen Fiscal</label>
                    <p className="text-lg">{organization.taxInformation.invoiceFiscalRegimen}</p>
                  </div>
                </div>

                {organization.role !== 'admin' && (
                  <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Solo los administradores pueden editar la información fiscal.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}