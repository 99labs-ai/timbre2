'use client'

import { useEffect, useState } from 'react'
import { useUser, UserButton } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'

interface Invoice {
  invoiceId: string
  invoiceNumber: string
  totalAmount: number
  currency: string
  status: string
  createdAt: string
  createdBy: string
  details: {
    recipientName: string
    recipientRfc: string
    description: string
    subtotal: number
    taxAmount: number
    issueDate: string
    dueDate: string
  }
}

interface Organization {
  organizationId: string
  name: string
  isPersonal: boolean
  role: 'admin' | 'member'
}

export default function InvoicesPage() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const organizationId = searchParams.get('org') || (typeof window !== 'undefined' ? localStorage.getItem('selectedOrganizationId') : null)

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!organizationId) {
        setIsLoading(false)
        return
      }

      try {
        // Fetch invoices and organization info in parallel
        const [invoicesResponse, orgsResponse] = await Promise.all([
          fetch(`/api/organizations/${organizationId}/invoices`),
          fetch('/api/organizations')
        ])

        const invoicesData = await invoicesResponse.json()
        const orgsData = await orgsResponse.json()

        if (invoicesResponse.ok && invoicesData.invoices) {
          setInvoices(invoicesData.invoices)
        }

        if (orgsResponse.ok && orgsData.organizations) {
          const currentOrg = orgsData.organizations.find((org: Organization) => org.organizationId === organizationId)
          setOrganization(currentOrg || null)
        }
      } catch (error) {
        console.error('Error fetching invoices:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchInvoices()
  }, [organizationId])

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setShowInvoiceModal(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'generated':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'paid':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
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
            <h1 className="font-semibold">Facturas</h1>
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
            <h1 className="font-semibold">Facturas</h1>
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
            <h1 className="font-semibold">Facturas</h1>
          </div>
          
          <div className="ml-auto">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 lg:px-8">
        {/* Organization Info */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">
            Facturas - {organization.name}
          </h2>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span className="flex items-center">
              {organization.isPersonal ? '👤 Personal' : '🏢 Organización'}
            </span>
            <span className="flex items-center">
              🔑 {organization.role}
            </span>
            <span className="flex items-center">
              📄 {invoices.length} facturas
            </span>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-medium">Número</th>
                    <th className="text-left p-4 font-medium">Cliente</th>
                    <th className="text-left p-4 font-medium">Monto</th>
                    <th className="text-left p-4 font-medium">Estado</th>
                    <th className="text-left p-4 font-medium">Fecha</th>
                    <th className="text-left p-4 font-medium">Creado por</th>
                    <th className="text-left p-4 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.invoiceId} className="border-b border-border hover:bg-muted/30">
                      <td className="p-4">
                        <span className="font-medium">{invoice.invoiceNumber}</span>
                      </td>
                      <td className="p-4">
                        <div>
                          <div className="font-medium">{(invoice as any).details?.recipientName || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">{(invoice as any).details?.recipientRfc || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-medium">
                          ${invoice.totalAmount.toFixed(2)} {invoice.currency}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {new Date(invoice.createdAt).toLocaleDateString('es-MX', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(invoice.createdAt).toLocaleTimeString('es-MX', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">{invoice.createdBy}</span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleViewInvoice(invoice)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Ver detalles
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-lg font-medium mb-2">No hay facturas</h3>
              <p className="text-muted-foreground mb-4">
                Esta organización no ha generado ninguna factura aún.
              </p>
              <a
                href="/dashboard"
                className="inline-flex items-center px-4 py-2 bg-foreground text-background rounded-md hover:bg-opacity-90"
              >
                Ir al Dashboard para generar facturas
              </a>
            </div>
          )}
        </div>

        {/* Invoice Details Modal */}
        {showInvoiceModal && selectedInvoice && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-medium">Detalles de Factura</h3>
                  <button
                    onClick={() => setShowInvoiceModal(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Invoice Header */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Información de Factura</h4>
                      <div className="space-y-2 text-sm">
                        <div><span className="text-muted-foreground">Número:</span> {selectedInvoice.invoiceNumber}</div>
                        <div><span className="text-muted-foreground">Estado:</span> 
                          <span className={`ml-2 px-2 py-1 rounded-full text-xs ${getStatusColor(selectedInvoice.status)}`}>
                            {selectedInvoice.status}
                          </span>
                        </div>
                        <div><span className="text-muted-foreground">Fecha de emisión:</span> {new Date((selectedInvoice as any).details?.issueDate || selectedInvoice.createdAt).toLocaleDateString('es-MX')}</div>
                        <div><span className="text-muted-foreground">Fecha de vencimiento:</span> {new Date((selectedInvoice as any).details?.dueDate || selectedInvoice.createdAt).toLocaleDateString('es-MX')}</div>
                        <div><span className="text-muted-foreground">Creado por:</span> {selectedInvoice.createdBy}</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Cliente</h4>
                      <div className="space-y-2 text-sm">
                        <div><span className="text-muted-foreground">Nombre:</span> {(selectedInvoice as any).details?.recipientName || 'N/A'}</div>
                        <div><span className="text-muted-foreground">RFC:</span> {(selectedInvoice as any).details?.recipientRfc || 'N/A'}</div>
                        {(selectedInvoice as any).details?.recipientAddress && (
                          <div><span className="text-muted-foreground">Dirección:</span> {(selectedInvoice as any).details.recipientAddress}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Invoice Details */}
                  <div>
                    <h4 className="font-medium mb-3">Descripción</h4>
                    <p className="text-sm text-muted-foreground">
                      {(selectedInvoice as any).details?.description || 'Sin descripción'}
                    </p>
                  </div>

                  {/* Invoice Amounts */}
                  <div className="border-t border-border pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>${((selectedInvoice as any).details?.subtotal || 0).toFixed(2)} {selectedInvoice.currency}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">IVA:</span>
                        <span>${((selectedInvoice as any).details?.taxAmount || 0).toFixed(2)} {selectedInvoice.currency}</span>
                      </div>
                      <div className="flex justify-between font-medium text-lg border-t border-border pt-2">
                        <span>Total:</span>
                        <span>${selectedInvoice.totalAmount.toFixed(2)} {selectedInvoice.currency}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-border">
                    <button
                      onClick={() => setShowInvoiceModal(false)}
                      className="px-4 py-2 border border-border rounded-md hover:bg-muted"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}