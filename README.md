# UniAsset AMS — University Asset Management System

> **Software Quality Engineering (SQE) Course Assignment**  
> A complete, fully functional, web-based Asset Management System built with **React**, **TypeScript**, **Tailwind CSS**, and **Supabase (PostgreSQL)**.

---

## 1. Project Purpose & Scope

The **UniAsset Asset Management System (AMS)** provides institutional governance for university assets, physical locations, borrow requests, multi-tier organizational transfers, hierarchical approvals, and privilege delegation. 

The system implements 7 core Functional Requirements (FR1 through FR7) defined in the SRS specifications:

* **FR1 — Authentication (§5.9)**: Secure session management via Supabase Auth, protected routes, and contextual role/level/permission loading.
* **FR2 — Manage Inventory Asset (§5.2–5.4)**: Asset cataloging, immutable Asset ID enforcement, and organizational scope checks (department/faculty/university ownership).
* **FR3 — Creating a New Location (§5.7)**: Restricted space provisioning—strictly permitted only to authorized IT group members possessing an approved exception request.
* **FR4 — Transferring Assets (§5.1)**: Multi-tier transfer routing with 4 distinct organizational workflows (Same Department, Different Dept Same Faculty, Different Faculty, Outside University).
* **FR5 — Borrow / Reservation Requests (§5.5)**: Request submission for assets and spaces supporting Basic, Advanced, and Exception forms, with Level 0 accounts restricted to Basic forms.
* **FR6 — Approving Requests (§5.8)**: Role- and scope-isolated approval queues; approving requests moves them into the `WAITING FOR EXECUTION` workflow status.
* **FR7 — Changing Permission (§5.10)**: Permission delegation strictly enforcing the critical non-escalation rule: *an administrator cannot grant permissions greater than their own*.

---

## 2. Technology Stack

* **Frontend Framework**: React 19 + TypeScript (Strict Type Safety)
* **Build Tool**: Vite 8 (ESNext bundler)
* **Styling & UI**: Tailwind CSS + Lucide React Icons
* **Database & Auth**: Supabase PostgreSQL + Row Level Security (RLS) + Database Triggers + Stored Procedures (RPCs)
* **State & Feedback**: React Context API (`AuthContext`, `ToastContext`), resilient dual-mode persistence (Supabase Live / Local Sandbox)

---

## 3. Accounts

Users create their own account from the login page. New accounts start as `USER` at `LEVEL_0` and receive basic inventory access. The first administrator is created with the bootstrap script below.

To create the first administrator, register the account normally, replace the email placeholder in `supabase/promote_admin.sql`, and run that script in Supabase SQL Editor. Then sign out and sign in again so the new role is loaded.

To create an inventory administrator, register another account normally, replace the email placeholder in `supabase/promote_inventory_admin.sql`, and run that script. This creates an `INVENTORY_ADMIN` at `LEVEL_2` with asset-management access, without university-wide administrator permissions.

---

## 4. Setup & Running Instructions

### Prerequisites
* **Node.js**: v18.0.0 or later (Node v24+ supported)
* **npm**: v9.0.0 or later

### Step 1: Install Dependencies
```powershell
cd C:\Users\shazi\.gemini\antigravity\scratch\asset-management-system
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
copy .env.example .env
```
Default `.env` contents:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```
*When left with placeholder values, the application runs in **Local Sandbox Mode** with full offline persistence in `localStorage` and identical RLS and business logic.*

### Step 3: Run the Application Locally
```powershell
npm run dev
```
Open your browser at: `http://localhost:5173`

### Step 4: Build for Production
```powershell
npm run build
```
Verify that `tsc -b && vite build` completes with exit code 0.

---

## 5. Supabase PostgreSQL Deployment

To connect a live cloud Supabase database:

1. Create a project on [Supabase.com](https://supabase.com), or use your existing project.
2. Open the **SQL Editor** in the Supabase Dashboard.
3. Run `supabase/migration_current_schema.sql` once against the existing schema.
4. Go to **Project Settings -> API** and copy:
   * **Project URL** into `VITE_SUPABASE_URL`
   * **Project API Anon Key** into `VITE_SUPABASE_ANON_KEY`
5. Restart Vite (`npm run dev`).


## 6. System Architecture & Security Controls

```
+-------------------------------------------------------------------------------+
|                             React 19 + TypeScript UI                         |
|  +---------------------+  +----------------------+  +----------------------+  |
|  +---------------------+  +----------------------+  +----------------------+  |
|  +-------------------------------------------------------------------------+  |
|  | Pages: Inventory, Locations, Transfers, Requests, Approvals, Permissions|  |
|  +-------------------------------------------------------------------------+  |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                            Universal API Layer (api.ts)                       |
|   - FR1: Authentication & Session Management                                  |
|   - FR2: Organizational Scope Guard & Asset ID Immutability                   |
|   - FR3: IT Group + Approved Exception Space Provisioning                     |
|   - FR4: 4-Tier Transfer Routing Logic                                        |
|   - FR5: Clearance Level (0-3) Form Validation                                |
|   - FR6: Scope-Isolated Approval Queueing                                     |
|   - FR7: Non-Escalation Permission Delegation Rule                            |
+-------------------+---------------------------------------+-------------------+
                    | (Live Mode)                           | (Fallback Mode)
                    v                                       v
+-----------------------------------+   +---------------------------------------+
|    Supabase Cloud PostgreSQL     |   |    Local Storage Sandbox Storage      |
|  - Row Level Security (RLS)       |   |  - Complete In-Memory Persistence      |
|  - Triggers (Immutable Asset IDs) |   |  - Identical Business Logic Rules     |
|  - Stored Procedures (RPCs)       |   +---------------------------------------+
|  - Foreign Key Cascades & Views   |
+-----------------------------------+
```

---

## 9. Known Assumptions & Operational Notes
* Single university tenant (`Central State University`) with multi-faculty and multi-department topology, plus an external university entity to demonstrate Case 4 transfers.
* New accounts are created through the registration form and begin with standard user access.
* Standard Borrow/Reservation requests approved by departmental or faculty administrators transition into `WAITING FOR EXECUTION` status before physical check-out.
