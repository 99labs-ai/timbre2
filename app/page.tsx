import Link from "next/link";

export default function Home() {
  return (
    <div className="font-sans flex flex-col items-center justify-center min-h-screen p-8 gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-foreground">
          Timbre
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          Sistema profesional de gestión de facturas
        </p>
        
        <div className="flex gap-4 items-center justify-center">
          <Link
            href="/sign-in"
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-opacity-90 font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
          >
            Iniciar Sesión
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full border border-solid border-border transition-colors flex items-center justify-center hover:bg-muted font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
          >
            Registrarse
          </Link>
        </div>
      </div>
    
    </div>
  );
}
