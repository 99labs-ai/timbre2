import { SignUp } from '@clerk/nextjs'
import { Suspense } from 'react'

function SignUpContent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Crear Cuenta
          </h1>
          <p className="text-sm text-muted-foreground">
            Únete a Timbre y gestiona tus facturas
          </p>
        </div>
        <SignUp 
          appearance={{
            elements: {
              formFieldInput: "bg-background border-border",
              card: "bg-background border-border"
            }
          }}
          additionalFieldsRequired={['firstName', 'lastName', 'phoneNumber']}
          additionalFields={[
            {
              name: 'firstName',
              label: 'Nombre',
              required: true,
            },
            {
              name: 'lastName', 
              label: 'Apellido',
              required: true,
            },
            {
              name: 'phoneNumber',
              label: 'Teléfono',
              required: false,
            }
          ]}
        />
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignUpContent />
    </Suspense>
  )
}