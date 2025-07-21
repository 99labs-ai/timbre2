import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Iniciar Sesión
          </h1>
          <p className="text-sm text-muted-foreground">
            Ingresa a tu cuenta de Timbre
          </p>
        </div>
        <SignIn 
          appearance={{
            elements: {
              formFieldInput: "bg-background border-border",
              card: "bg-background border-border"
            }
          }}
        />
      </div>
    </div>
  )
}