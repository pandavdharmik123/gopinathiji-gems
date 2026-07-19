# Gopinathji Gems - Accounting System

A modern, dual-language (Gujarati & English) web-based accounting and ledger system tailored for Gopinathji Gems. The application is built to handle day-to-day transactions, manage parties (vendors/customers), and generate detailed financial reports.

## Tech Stack

**Frontend:**
- React (Vite)
- Tailwind CSS v4
- Ant Design (UI Components)
- React Router (Routing)

**Backend:**
- Node.js & Express
- Prisma ORM
- PostgreSQL (Database)

## Features

- **Dual Language Support:** Instantly toggle between English and Gujarati across the entire application interface.
- **Transliteration Engine:** Custom input components that automatically transliterate English keystrokes into Gujarati characters.
- **Transaction Management:** Complete CRUD interface for tracking Income, Expenses, Transfers, and Adjustments.
- **Dynamic Categories:** Fully customizable Expense & Income categories with a dedicated database schema.
- **Ledger & Cashbook:** Real-time generation of party-specific ledgers and standard cashbook statements.
- **Advanced Reporting:** Detailed financial summaries, tax/GST reporting, and comprehensive data tables.
- **Role-Based Access Control:** Secure authentication with distinct `admin` and `employee` roles.
- **Audit Logging:** Automated tracking of all creation, modification, and deletion events for compliance.
- **Database Backups:** Export and restore functionality for the entire database via JSON.

## Development

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database
- pnpm

### Running Locally

This project uses a monorepo-style structure where the frontend and backend are run concurrently.

1. **Install dependencies:**
   ```bash
   pnpm install
   cd server && pnpm install
   ```

2. **Environment Setup:**
   - Configure your `.env` files in both the root directory and the `server/` directory based on `.env.example`.
   - Ensure `DATABASE_URL` is pointing to a valid PostgreSQL instance.

3. **Database Migration:**
   ```bash
   cd server
   npx prisma db push
   ```

4. **Start the Development Servers:**
   The Vite frontend and the Express backend can be run in separate terminal tabs, or via a unified runner.
   - Frontend: `npm run dev` (Runs on `$PORT`, default 8443)
   - Backend: `npm run dev` inside the `server/` directory.

## Key Files & Directories

- `src/App.tsx` - Main React application component and state provider.
- `src/store/AppContext.tsx` - Global state context handling API data fetching.
- `src/index.css` - Global stylesheet, Tailwind imports, and Apple System Font (San Francisco/Segoe UI) overrides.
- `server/src/index.ts` - Main Express API entry point.
- `server/prisma/schema.prisma` - PostgreSQL database schema definition.
