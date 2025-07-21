# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15.4.2 application built with React 19 and TypeScript, using Tailwind CSS v4 for styling. The project follows the modern Next.js App Router architecture with the `app/` directory structure.

## Development Commands

- **Start development server**: `npm run dev` (uses Turbopack for faster builds)
- **Build for production**: `npm run build`
- **Start production server**: `npm start`
- **Lint code**: `npm run lint`

### Database Commands (Prisma)
- **Generate Prisma client**: `npm run db:generate`
- **Push schema to database**: `npm run db:push`
- **Create and run migrations**: `npm run db:migrate`
- **Open Prisma Studio**: `npm run db:studio`

## Architecture

### Directory Structure
- `app/` - Main application directory using Next.js App Router
  - `layout.tsx` - Root layout component with Geist font setup
  - `page.tsx` - Home page component
  - `globals.css` - Global styles with Tailwind and CSS custom properties
  - `api/` - API routes directory (currently has whatsapp subdirectory)
- `lib/` - Shared utilities and configurations
  - `prisma.ts` - Prisma client singleton instance
- `prisma/` - Database schema and migrations
  - `schema.prisma` - Prisma schema with all models and relations

### Key Technologies
- **Next.js 15.4.2** with App Router
- **React 19** with TypeScript
- **Tailwind CSS v4** with PostCSS integration
- **Prisma 6.12.0** with PostgreSQL database
- **Clerk** for authentication and user management
- **Geist fonts** (Sans and Mono variants) loaded via next/font/google

### Styling System
- Uses Tailwind CSS v4 with custom CSS properties for theming
- Dark mode support via `prefers-color-scheme` media query
- Custom color tokens: `--background`, `--foreground`
- Font variables: `--font-geist-sans`, `--font-geist-mono`

### TypeScript Configuration
- Strict mode enabled
- Path mapping configured with `@/*` pointing to root directory
- ES2017 target with modern module resolution

### Database Schema (Prisma)
Key models for invoice management system:
- **Profile**: User accounts (compatible with Clerk auth via `authUserId` field)
- **Organization**: Companies or personal entities
- **TaxInformation**: Fiscal data for organizations (1-to-1 relationship)
- **OrganizationProfile**: User-organization membership with roles
- **Invoice**: Generated invoices with status tracking
- **Subscription**: Stripe subscription management
- **Invitation**: Organization invitation system

### Authentication & Authorization (Clerk)
- **Auth Provider**: ClerkProvider wraps the entire app in `app/layout.tsx`
- **Middleware**: `middleware.ts` protects routes (dashboard, onboarding, API routes)
- **User Sync**: `/api/auth/sync` syncs Clerk users with local Profile table
- **Onboarding Flow**: Handles direct registration and invitation-based registration
- **Organization Context**: Multi-tenant system with role-based access control

### API Routes
- `/api/auth/sync` - Syncs Clerk user with Profile table
- `/api/onboarding/personal-org` - Creates personal organization with tax data
- `/api/invitations/send` - Sends organization invitations
- `/api/invitations/accept` - Accepts organization invitations
- `/api/organizations` - Fetches user's organizations

## Development Notes

- The project uses Turbopack in development mode for faster builds
- ESLint is configured via Next.js built-in linting
- No custom ESLint config file exists - relies on Next.js defaults
- PostCSS configured specifically for Tailwind CSS v4
- Font optimization handled by Next.js font system
- Database client singleton pattern prevents connection issues in development
- Prisma client auto-generated on postinstall
- Use `lib/prisma.ts` to import database client: `import { prisma } from '@/lib/prisma'`
- Set up Clerk keys in `.env` file before running the application
- Auth flow supports two scenarios: direct registration and invitation-based registration