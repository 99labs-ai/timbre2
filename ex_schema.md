-- Habilitar la extensión para generar UUIDs si no está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Creación de tipos ENUM para roles y estados
-- Esto asegura que solo los valores definidos puedan ser insertados en las columnas correspondientes.
CREATE TYPE organization_role AS ENUM ('admin', 'member');
CREATE TYPE invoice_status AS ENUM ('generated', 'paid', 'canceled');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'incomplete');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired');


-- =================================================================
-- Tabla 1: Profiles (Perfiles / Usuarios)
-- Almacena la información de cada usuario, permitiendo perfiles manuales sin acceso.
-- =================================================================
CREATE TABLE profiles (
    profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- ID del proveedor de autenticación. Es NULABLE para permitir perfiles manuales que no inician sesión.
    auth_user_id VARCHAR(255) UNIQUE,
    
    -- El email es el identificador de negocio único y obligatorio para todos los perfiles.
    email VARCHAR(255) UNIQUE NOT NULL,
    
    name VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'Almacena los perfiles de los usuarios. Incluye usuarios con acceso y perfiles manuales sin acceso.';
COMMENT ON COLUMN profiles.auth_user_id IS 'ID del sistema de autenticación. NULL si el perfil es manual y no tiene login.';


-- =================================================================
-- Tabla 2: Organizations (Organizaciones / Compañías)
-- Representa tanto a compañías como a las entidades "personales" de cada usuario.
-- =================================================================
CREATE TABLE organizations (
    organization_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    credit_balance INT NOT NULL DEFAULT 0,
    is_personal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE organizations IS 'Representa entidades de negocio (compañías o personas físicas).';
COMMENT ON COLUMN organizations.credit_balance IS 'Créditos disponibles para generar facturas.';
COMMENT ON COLUMN organizations.is_personal IS 'TRUE si es una organización personal creada por defecto para un usuario.';


-- =================================================================
-- Tabla 3: Tax_Information (Información Fiscal)
-- Datos fiscales únicos para cada organización. Relación 1-a-1.
-- =================================================================
CREATE TABLE tax_information (
    tax_info_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID UNIQUE NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    tax_id VARCHAR(20) UNIQUE NOT NULL, -- RFC en México
    taxpayer VARCHAR(255) NOT NULL, -- Razón Social
    country VARCHAR(100),
    postal_code VARCHAR(10),
    csf_document_url TEXT,
    invoice_cfdi_use VARCHAR(10),
    invoice_fiscal_regimen VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tax_information IS 'Datos fiscales asociados de forma única a una organización.';
COMMENT ON COLUMN tax_information.organization_id IS 'Clave foránea única para forzar la relación 1-a-1.';


-- =================================================================
-- Tabla 4: Organization_Profiles (Tabla de Unión)
-- Asocia perfiles con organizaciones y define su rol. Relación N-a-N.
-- =================================================================
CREATE TABLE organization_profiles (
    profile_id UUID NOT NULL REFERENCES profiles(profile_id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    role organization_role NOT NULL DEFAULT 'member',
    PRIMARY KEY (profile_id, organization_id) -- Clave primaria compuesta para evitar duplicados
);

COMMENT ON TABLE organization_profiles IS 'Tabla intermedia para la relación N-N entre perfiles y organizaciones.';
COMMENT ON COLUMN organization_profiles.role IS 'Rol del perfil dentro de la organización (admin, member).';


-- =================================================================
-- Tabla 5: Invoices (Facturas)
-- Registra cada factura generada por un perfil en nombre de una organización.
-- =================================================================
CREATE TABLE invoices (
    invoice_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by_profile_id UUID NOT NULL REFERENCES profiles(profile_id) ON DELETE RESTRICT,
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE RESTRICT,
    status invoice_status NOT NULL DEFAULT 'generated',
    details JSONB, -- Para guardar montos, conceptos, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE invoices IS 'Registros de las facturas emitidas.';
COMMENT ON COLUMN invoices.created_by_profile_id IS 'Perfil que ejecutó la creación de la factura.';
COMMENT ON COLUMN invoices.organization_id IS 'Organización que emite la factura y de donde se toman los datos fiscales.';
COMMENT ON COLUMN invoices.details IS 'Contenido detallado de la factura en formato JSON.';


-- =================================================================
-- Tabla 6: Subscriptions (Suscripciones)
-- Rastrea las suscripciones de pago (ej. Stripe) de cada organización.
-- =================================================================
CREATE TABLE subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID UNIQUE NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    status subscription_status NOT NULL,
    plan_type VARCHAR(100),
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE subscriptions IS 'Maneja el estado de las suscripciones de pago (ej. Stripe).';


-- =================================================================
-- Tabla 7: Invitations (Invitaciones)
-- Gestiona las invitaciones pendientes para unirse a organizaciones.
-- =================================================================
CREATE TABLE invitations (
    invitation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    invited_by_profile_id UUID NOT NULL REFERENCES profiles(profile_id) ON DELETE CASCADE,
    invitee_email VARCHAR(255) NOT NULL,
    token TEXT UNIQUE NOT NULL,
    status invitation_status NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, invitee_email) -- Evita invitar a la misma persona dos veces a la misma organización si la invitación está pendiente.
);

COMMENT ON TABLE invitations IS 'Almacena invitaciones para que nuevos usuarios se unan a una organización.';
COMMENT ON COLUMN invitations.token IS 'Token único y seguro para el enlace de invitación.';

