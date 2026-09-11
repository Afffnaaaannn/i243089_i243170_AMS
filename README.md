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

---

## 6. Verification & Test Walkthrough for All 7 FRs

### FR1 — Authentication (§5.9)
1. **Invalid Login**: Go to `/login`, enter `invalid@ams.edu` with wrong password -> Observe observable error: *"Invalid username/email or password."*
2. **Valid Login**: Click **Student Level 0 (`student0@ams.edu`)** from the seed accounts list -> Click **Sign In** -> Redirects to Dashboard, displays student session.
3. **Protected Routes**: Log out and manually navigate to `http://localhost:5173/approvals` -> Redirects immediately to `/login`.

### FR2 — Manage Inventory Asset (§5.2–5.4)
1. **Immutable Asset ID**: Switch to **DA Admin (`da.cse@ams.edu`)** -> Navigate to **Inventory** -> Click **Edit** on `AST-CSE-001` -> Verify Asset ID is disabled and locked with an immutability alert.
2. **Authorized Edit**: Edit the Asset Name or Condition -> Click **Save Changes** -> Observe success notification: *"Asset updated successfully."*
3. **Scope Authorization Denial**: As `da.cse@ams.edu` (CSE Department), attempt to edit `AST-PHYS-001` (Physics Department) -> Observe rejection toast: *"Unauthorized: You belong to CSE and cannot modify assets in another department."*

### FR3 — Creating a New Location (§5.7)
1. **Unauthorized User Rejection**: Switch to **Student (`student0@ams.edu`)** or **DA Admin** -> Navigate to **Locations** -> Click **Provision New Location** -> Denied with error: *"You are not authorized to create a location. Only authorized IT group members can perform this operation."*
2. **Authorized IT Creation**: Switch to **IT Specialist (`it.admin@ams.edu`)** -> Click **Provision New Location** -> Form unlocks.
3. **Approved Exception Required**: Select the approved exception request `REQ-EXC-2025-001` -> Fill Name ("Robotics Arena"), Building, and Room -> Click **Create Location** -> Observe success message: *"Location created successfully."*

### FR4 — Asset Transfers (4 Distinct Workflows) (§5.1)
Navigate to **Transfers** -> Click **Initiate Asset Transfer**:
* **Case 1 (Same Department)**: Select `AST-CSE-001` (Source: CSE) -> Set destination to **Computer Science (CSE)** -> System evaluates **CASE 1** -> Click submit -> Feedback: *"Transfer completed automatically."*
* **Case 2 (Different Dept, Same Faculty)**: Select `AST-CSE-001` (CSE) -> Set destination to **Electrical Engineering (EE)** (both FET) -> System evaluates **CASE 2** -> Submit -> Feedback: *"Transfer submitted. Department/faculty approval required."* Status: `PENDING_DA_APPROVAL`.
* **Case 3 (Different Faculty)**: Select `AST-CSE-001` (FET) -> Set destination to **Physics (FOS)** -> System evaluates **CASE 3** -> Submit -> Feedback: *"Transfer submitted. Faculty approval required."* Status: `PENDING_FACULTY_APPROVAL`.
* **Case 4 (Outside University)**: Select asset and set destination to **External Partner University** -> System evaluates **CASE 4** -> Submit -> Feedback: *"Transfer submitted. University approval required."* Status: `PENDING_UNIVERSITY_APPROVAL`.

### FR5 — Borrow / Reservation Requests (§5.5)
1. **Level 0 Form Restriction**: Switch to **Student (`student0@ams.edu`)** (Level 0) -> Navigate to **Requests** -> Click **New Borrow / Reservation**:
   * Advanced Form & Exception Form tabs are locked with padlock icon.
   * Attempting to submit non-basic forms is denied: *"You are not authorized to use this request form. Level 0 users can only submit Basic forms."*
2. **Successful Basic Submission**: Complete required fields on Basic Form -> Submit -> Feedback: *"Request submitted successfully."* Request enters `PENDING` status.
3. **Higher Level Form**: Switch to **Senior Researcher (`researcher1@ams.edu`)** (Level 1) -> Open request dialog -> Advanced form tab is unlocked and submittable.

### FR6 — Approving Requests (§5.8)
1. **Scoped Queue Visibility**:
   * Log in as **DA Admin (`da.cse@ams.edu`)** -> Navigate to **Approvals** -> Only requests originating from the CSE department are visible.
   * Log in as **Dean (`dean.fet@ams.edu`)** -> Only faculty-level items appear.
2. **Approve Workflow**: Click **Approve (Advance to Execution)** on a pending request -> Feedback: *"Request approved successfully. Status moved to WAITING FOR EXECUTION."*
3. **Reject Workflow**: Click **Reject** on an item -> Enter mandatory rejection comments -> Feedback: *"Request rejected successfully."*

### FR7 — Changing Permission (§5.10)
1. **Security Rule Test**: Switch to **DA Admin (`da.cse@ams.edu`)** (possesses `manage_assets`, `approve_department_transfers`, etc., but **does NOT possess** `create_locations` or `approve_university_transfers`).
2. Navigate to **Permissions** -> Select `Jordan Lee (Student)`.
3. Try selecting `create_locations` or `approve_university_transfers` (highlighted as beyond your privilege) -> Click **Save & Enforce Delegation**.
4. Observe rejection error: *"You cannot assign permissions greater than your own. Unauthorized permissions: create_locations, approve_university_transfers"*. Database is not modified.
5. Grant only permissions you own (e.g. `manage_assets`) -> Click Save -> Feedback: *"Permissions updated successfully."*

---

## 7. Software Quality & Non-Functional Requirements (NFRs)

The system satisfies critical non-functional software engineering quality standards:

* **NFR-1 — Security & Principle of Least Privilege**:
  * Role-Based Access Control (RBAC) enforced at UI, Service API, and PostgreSQL Row-Level-Security (RLS) layers.
  * Hierarchical privilege gating preventing unauthorized escalation (FR7 non-escalation rule).
  * Strict session validation and route guards on all protected administrative pages.
* **NFR-2 — Data Integrity & ACID Guarantees**:
  * PostgreSQL triggers enforce asset identifier immutability (`prevent_asset_id_change`).
  * Foreign key referential integrity across multi-tiered organizational hierarchy (Universities -> Faculties -> Departments -> Locations -> Assets).
  * Check constraints enforce valid conditions, statuses, and level boundaries (0 to 3).
* **NFR-3 — Usability & Access Control**:
  * Account access and controls are shown according to the signed-in user's role and permissions.
  * Context-aware forms that dynamically hide or lock fields based on user clearance level.
* **NFR-4 — Observable User Feedback**:
  * Zero silent failures: every administrative action, transfer submission, and approval yields immediate toast notifications categorized by severity (`success`, `error`, `warning`, `info`).
  * Inline validation errors on forms with clear rejection rationale.
* **NFR-5 — Auditability & Traceability**:
  * Complete approval audit trails with timestamps, actor IDs, decision status, and review comments on all reservation requests and multi-department transfers.
* **NFR-6 — Reliability & Dual-Mode Fallback**:
  * Resilient backend architecture: connects seamlessly to live Supabase PostgreSQL, and gracefully provides full offline localStorage sandbox persistence if cloud connectivity is absent.

---

## 8. System Architecture & Security Controls

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
