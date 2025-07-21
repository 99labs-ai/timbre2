-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('generated', 'paid', 'canceled');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'canceled', 'past_due', 'incomplete');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'expired');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('user', 'client');

-- CreateTable
CREATE TABLE "profiles" (
    "profile_id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "auth_user_id" VARCHAR(255),
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "phone" VARCHAR(50),
    "client_type" "ClientType" NOT NULL DEFAULT 'user',
    "parent_organization_id" UUID,
    "credit_limit" INTEGER DEFAULT 0,
    "credits_used" INTEGER DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "alternate_email" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "organization_id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "credit_balance" INTEGER NOT NULL DEFAULT 0,
    "is_personal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "tax_information" (
    "tax_info_id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "tax_id" VARCHAR(20) NOT NULL,
    "taxpayer" VARCHAR(255) NOT NULL,
    "country" VARCHAR(100),
    "postal_code" VARCHAR(10),
    "csf_document_url" TEXT,
    "invoice_cfdi_use" VARCHAR(10),
    "invoice_fiscal_regimen" VARCHAR(10),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_information_pkey" PRIMARY KEY ("tax_info_id")
);

-- CreateTable
CREATE TABLE "organization_profiles" (
    "profile_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'member',

    CONSTRAINT "organization_profiles_pkey" PRIMARY KEY ("profile_id","organization_id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "invoice_id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "created_by_profile_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'generated',
    "details" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("invoice_id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "subscription_id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "stripe_subscription_id" VARCHAR(255),
    "stripe_customer_id" VARCHAR(255),
    "status" "SubscriptionStatus" NOT NULL,
    "plan_type" VARCHAR(100),
    "current_period_end" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("subscription_id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "invitation_id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "invited_by_profile_id" UUID NOT NULL,
    "invitee_email" VARCHAR(255) NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("invitation_id")
);

-- CreateTable
CREATE TABLE "client_tax_profiles" (
    "tax_profile_id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "profile_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "tax_id" VARCHAR(20) NOT NULL,
    "taxpayer" VARCHAR(255) NOT NULL,
    "country" VARCHAR(100) NOT NULL DEFAULT 'México',
    "postal_code" VARCHAR(10) NOT NULL,
    "invoice_cfdi_use" VARCHAR(10) NOT NULL,
    "invoice_fiscal_regimen" VARCHAR(10) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_tax_profiles_pkey" PRIMARY KEY ("tax_profile_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_auth_user_id_key" ON "profiles"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tax_information_organization_id_key" ON "tax_information"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_information_tax_id_key" ON "tax_information"("tax_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_organization_id_key" ON "subscriptions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_organization_id_invitee_email_key" ON "invitations"("organization_id", "invitee_email");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_parent_organization_id_fkey" FOREIGN KEY ("parent_organization_id") REFERENCES "organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_information" ADD CONSTRAINT "tax_information_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("profile_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profiles"("profile_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_profile_id_fkey" FOREIGN KEY ("invited_by_profile_id") REFERENCES "profiles"("profile_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_tax_profiles" ADD CONSTRAINT "client_tax_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("profile_id") ON DELETE CASCADE ON UPDATE CASCADE;
