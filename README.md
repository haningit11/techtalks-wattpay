# ⚡ WattPay

**Electricity Billing & Payment Management System**

WattPay is a web-based electricity billing and payment management system designed for private generator operators in Lebanon.

The system aims to simplify and organize electricity operations by providing subscriber management, building and collection route management, monthly meter readings, electricity bill generation, payment tracking, and outstanding balance management.

WattPay is being developed as part of the TechTalks project.

---

# 👥 1. Project Team

| Team Member | Role |
|---|---|
| Hanin Idriss | Team Leader |
| Aya Hage | Developer |
| Aleen Amer | Developer |
| Mohamad Hotait | Developer |

---

# 🛠️ 2. Technology Stack

The project uses the following technologies:

| Technology | Purpose |
|---|---|
| Next.js 16 | Frontend and backend application framework |
| React 19 | Building interactive user interfaces |
| TypeScript | Main programming language |
| Tailwind CSS 4 | Styling and responsive design |
| PostgreSQL | Relational database |
| Neon | Cloud-hosted PostgreSQL database |
| Prisma 7 | ORM for database access and migrations |
| Auth.js | Authentication framework |
| bcryptjs | Secure password hashing |
| Node.js | JavaScript runtime |
| npm | Package and dependency management |
| Git & GitHub | Version control and team collaboration |

### How the technologies work together

- **Next.js:** Handles the application pages, server-side functionality, and API endpoints.
- **React:** Builds the user interface and reusable components.
- **TypeScript:** Provides type safety and helps identify errors during development.
- **Tailwind CSS:** Provides the styling system.
- **PostgreSQL:** Stores WattPay's structured application data.
- **Neon:** Hosts the PostgreSQL database online so the team can access the same development database.
- **Prisma:** Connects the application to PostgreSQL and manages database models and migrations.
- **Auth.js:** Supports the application's authentication implementation.
- **bcryptjs:** Hashes account passwords before they are stored in the database.

### Application architecture

WattPay follows a unified Next.js architecture.

The frontend and backend are part of the same Next.js project. Server-side requests communicate with PostgreSQL through Prisma.

The database is hosted separately on Neon.

There is no separate Express.js backend server in the current MVP architecture.

---

# 📋 3. Prerequisites

Before starting development, make sure you have installed the following software.

### 3.1 Node.js

Node.js is required to run the Next.js application and development tools.

**Recommended version:** Node.js 24.x.

Download: https://nodejs.org/

To check your installation:

```bash
node -v
```

### 3.2 npm

npm is installed together with Node.js. It manages the project's dependencies.

Check your version:

```bash
npm -v
```

### 3.3 Git

Git is used to download the project and collaborate with other developers.

Download: https://git-scm.com/

Check your installation:

```bash
git --version
```

### 3.4 Visual Studio Code

VS Code is the recommended editor for WattPay.

Download: https://code.visualstudio.com/

### 3.5 GitHub account

You need a GitHub account with access to the private WattPay repository.

Repository:

https://github.com/haningit11/techtalks-wattpay

### 3.6 Neon database access

WattPay uses a shared Neon development database.

The team leader must provide each authorized developer with their own database connection credentials.

Do not use or distribute the Neon project owner's credentials.

---

# 🚀 4. Getting Started — Downloading WattPay

Follow these steps in order.

### Step 1: Choose a project location

Open VS Code.

Select:

**File → Open Folder**

Choose where you want to store the WattPay project.

For example:

```text
C:\Users\YourName\Desktop\Projects
```

### Step 2: Open the terminal

In VS Code, select:

**Terminal → New Terminal**

A terminal will appear at the bottom of VS Code.

### Step 3: Clone the GitHub repository

Run:

```bash
git clone https://github.com/haningit11/techtalks-wattpay.git
```

This downloads the WattPay repository onto your computer.

### Step 4: Enter the project folder

Run:

```bash
cd techtalks-wattpay
```

Make sure you are inside the actual project folder before running the remaining commands.

### Step 5: Open the project in VS Code

If necessary, run:

```bash
code .
```

The WattPay project should now appear in the VS Code Explorer.

---

# 📦 5. Installing Project Dependencies

Before running WattPay, you must install its dependencies.

Run:

```bash
npm ci
```

### What does this command do?

It reads the `package-lock.json` file and installs the exact dependency versions recorded in the project.

This helps ensure that all four developers use consistent package versions.

**Important:**

- Use `npm ci` when setting up the project for the first time.
- Do not run `create-next-app` again.
- Do not manually install packages that are already listed in `package.json`.
- If a teammate adds a new dependency, pull the updated GitHub changes and run `npm ci` again.

---

# 🔐 6. Environment Variables & Database Connection

This is one of the most important parts of setting up WattPay.

Your application connects to a shared PostgreSQL database hosted on Neon.

Each developer must have their own local `.env` file.

## 6.1 What is an environment variable?

Environment variables store configuration information that an application needs to run.

For example:

- Database connection strings.
- Passwords.
- Secret keys.
- API credentials.

These values should not be written directly inside application source code or uploaded to GitHub.

## 6.2 Create your `.env` file

Inside the main `techtalks-wattpay` folder:

1. Right-click the project folder in VS Code.
2. Select **New File**.
3. Name the file:

```text
.env
```

4. Open it and add the connection configuration provided by the team leader.

```env
DATABASE_URL="YOUR_POOLED_NEON_CONNECTION"
DIRECT_URL="YOUR_DIRECT_NEON_CONNECTION"
```

Replace the placeholders with your own authorized Neon development connection strings.

Do not copy real credentials from another developer's `.env` file.

## 6.3 Understanding the two database connections

WattPay uses two different PostgreSQL connection types.

### DATABASE_URL — Pooled connection

This connection is used by the Next.js application.

It uses Neon's connection pooling to manage application database connections efficiently.

It is used by:

- Prisma Client.
- Next.js server-side functionality.
- Application database queries.

### DIRECT_URL — Direct connection

This connection bypasses Neon's connection pooler.

It is used for:

- Prisma database migrations.
- Initial development database seeding.

Schema migration privileges should be restricted to the designated database maintainer.

### Important connection rules

Both connections must point to:

| Setting | Value |
|---|---|
| Neon project | WattPayDB |
| Branch | development |
| Database | neondb |
| PostgreSQL schema | public |

Never connect your local development application to the production branch.

## 6.4 Why does every developer need their own `.env`?

Each developer has their own local project folder.

The `.env` file is not shared through GitHub.

However, all authorized developers connect to the same Neon development database.

This means:

- You can run WattPay locally on your computer.
- Aya can run WattPay locally on her computer.
- Aleen can run WattPay locally on her computer.
- Mohamad can run WattPay locally on his computer.

All four applications can access the same shared development records.

For example, if one developer creates a subscriber in the shared database, the other developers can see that subscriber when they query the database.

**Important:** Sharing the database does not mean sharing the project owner's password. Each developer must use credentials authorized by the team leader.

## 6.5 Security rules

Never:

- Upload `.env` to GitHub.
- Share database passwords in public messages.
- Put connection strings directly in TypeScript files.
- Commit private API keys.
- Distribute the Neon owner credentials.

---

# 🗄️ 7. Database Architecture

WattPay uses PostgreSQL hosted on Neon.

The database contains 11 core entities.

| Entity | Purpose |
|---|---|
| User | Stores all four user roles and authentication information. |
| Building | Stores physical subscriber building information. |
| CollectionRoute | Organizes subscribers into collection routes. |
| UserRouteAssignment | Connects staff members to their assigned routes. |
| Subscriber | Stores customer information. |
| Subscription | Stores each subscriber's electricity service and amperage information. |
| MeterReading | Stores cumulative meter readings and review information. |
| Tariff | Stores monthly electricity rates and fixed fees. |
| Bill | Stores generated itemized electricity bills. |
| Payment | Stores recorded payments and receipt information. |
| AuditLog | Stores records of important application actions. |

### 7.1 User roles

The application supports four roles:

- OPERATOR
- METER_READER
- PAYMENT_COLLECTOR
- SUBSCRIBER

Each role has different responsibilities and permissions.

### 7.2 Neon branches

The Neon project contains separate database branches.

| Branch | Purpose |
|---|---|
| production | Protected production environment. |
| development | Shared database for the development team. |

All current development work must use the `development` branch.

Do not experiment with or apply development migrations to `production`.

### 7.3 Shared development database

The development database is shared between the four team members.

This means database records are not isolated per developer.

If someone inserts, updates, or deletes a record in the shared development database, the other developers will see the resulting change.

Therefore:

- Coordinate database changes.
- Avoid deleting records another developer is testing.
- Do not reset the shared database.
- Use synthetic test data.
- Communicate before making significant database changes.

---

# 🔄 8. Prisma Setup

Prisma is the ORM used to communicate with PostgreSQL.

It allows developers to work with database entities through TypeScript instead of manually writing SQL for every database operation.

### 8.1 Understanding the Prisma files

The project contains:

```text
prisma/
│
├── schema.prisma
│
├── seed.ts
│
└── migrations/
    ├── migration_lock.toml
    │
    └── 20261118200235_init/
        └── migration.sql

prisma7.config.ts

src/
└── generated/
    └── prisma/
```

**schema.prisma**

Defines the database models, fields, relationships, enums, and constraints represented by Prisma.

**seed.ts**

Contains the script used to insert synthetic development data.

**migrations/**

Stores the SQL migration history used to create and update the database structure.

**migration.sql**

Contains the SQL statements generated for the initial database migration, including the custom database integrity constraints.

**prisma7.config.ts**

Configures Prisma, the schema location, migration directory, direct database connection, and seed command.

**src/generated/prisma/**

Contains the generated Prisma Client used by the application.

This directory is generated locally and should not be manually edited.

## 8.2 Generate Prisma Client

After installing dependencies, run:

```bash
npx prisma generate
```

This generates the TypeScript client from `schema.prisma`.

Whenever the database schema changes and a new client is required, generate it again.

## 8.3 Check migration status

To see whether your database is synchronized with the migration files, run:

```bash
npx prisma migrate status
```

The expected result for the current development database is:

```text
Database schema is up to date!
```

## 8.4 Applying migrations

The designated database maintainer is responsible for applying reviewed migrations to the shared development database.

The command is:

```bash
npx prisma migrate deploy
```

This applies migration files that have not yet been applied to the database.

**Do not run migrations independently or simultaneously with another developer.**

Before applying a new migration:

1. Make sure the schema change has been discussed.
2. Review the migration SQL.
3. Commit the migration files to GitHub through the agreed workflow.
4. Coordinate with the database maintainer.
5. Apply the migration to the development database.
6. Inform the other developers that the schema has changed.

Never edit an already-applied migration file. Create a new migration for future schema changes.

Do not use `prisma db push` or `prisma migrate reset` against the shared development database.

---

# 🌱 9. Database Seeding & Synthetic Data

## 9.1 What is database seeding?

Database seeding means inserting initial or sample records into the database automatically through a script.

Instead of manually creating every user, subscriber, building, and subscription, Prisma executes the seed script.

WattPay has an existing seed script:

```text
prisma/seed.ts
```

## 9.2 Current synthetic development data

The seed has already been executed successfully on the shared Neon development database.

The current records are:

| Entity | Records |
|---|---:|
| User | 4 |
| Building | 1 |
| CollectionRoute | 1 |
| UserRouteAssignment | 2 |
| Subscriber | 5 |
| Subscription | 5 |
| MeterReading | 5 |
| Tariff | 1 |
| Bill | 0 |
| Payment | 0 |
| AuditLog | 0 |

The seed creates:

- Four synthetic user accounts.
- One demo building called Building Al-Nour.
- One collection route called Route A.
- Two staff route assignments.
- Five synthetic subscribers.
- Five electricity subscriptions.
- Five October baseline meter readings.
- One November 2026 tariff.

November bills and payments are intentionally not included in the initial seed data. They will be created and tested through the billing and payment workflows.

## 9.3 Do developers need to run the seed?

**No.**

The synthetic records already exist in the shared Neon development database.

Developers who connect to the same database will see those records automatically.

Do not run the seed simply because you cloned the repository.

Only run it when the team leader or database maintainer explicitly requests it.

## 9.4 Demo login accounts

The initial seed creates these synthetic accounts:

| Role | Email |
|---|---|
| Operator | operator@wattpay.local |
| Meter Reader | reader@wattpay.local |
| Payment Collector | collector@wattpay.local |
| Subscriber | s2@wattpay.local |

The accounts use the shared development demo password configured through `SEED_DEMO_PASSWORD` when the seed was executed.

Ask the team leader for the demo password through a private channel.

Never put demo passwords in GitHub or this README.

---

# ▶️ 10. Running WattPay Locally

Once the repository is cloned, dependencies are installed, and your `.env` is configured, you can start the application.

Run:

```bash
npm run dev
```

Next.js will start its local development server.

Open your browser and visit:

http://localhost:3000

You should see the current WattPay application.

Keep the terminal open while developing.

To stop the server, press:

```text
Ctrl + C
```

### Useful development commands

| Command | Purpose |
|---|---|
| `npm run dev` | Starts the development server. |
| `npm run build` | Builds the application for production. |
| `npm run start` | Starts the production build locally. |
| `npm run lint` | Runs ESLint. |
| `npx tsc --noEmit` | Checks TypeScript without generating build files. |
| `npx prisma format` | Formats the Prisma schema. |
| `npx prisma validate` | Validates the Prisma schema. |
| `npx prisma generate` | Generates Prisma Client. |
| `npx prisma migrate status` | Checks database migration status. |
| `npx prisma migrate deploy` | Applies reviewed migrations. |
| `npx prisma studio` | Opens a visual database browser. |

Use Prisma Studio carefully because changes made through it affect the shared development database.

---

# 🔄 11. Git & GitHub Collaboration

Git allows all four developers to work on the same project without directly overwriting one another's code.

We use feature branches and Pull Requests.

## 11.1 Before starting work

Always make sure your local `main` branch is updated.

```bash
git switch main
```

Then:

```bash
git pull origin main
```

This downloads the latest changes from GitHub.

## 11.2 Create a feature branch

Never start new feature work directly on `main`.

Create a branch using:

```bash
git switch -c feature/task-name
```

Examples:

```bash
git switch -c feature/login-page
```

```bash
git switch -c feature/subscriber-management
```

```bash
git switch -c feature/meter-readings
```

Each developer should use a branch that describes the task they are working on.

## 11.3 Save your changes

After completing a task, check the changed files:

```bash
git status
```

Stage the relevant files:

```bash
git add .
```

Create a commit:

```bash
git commit -m "Add subscriber management page"
```

## 11.4 Push your feature branch

```bash
git push -u origin feature/task-name
```

Replace `feature/task-name` with your actual branch name.

## 11.5 Create a Pull Request

1. Open the WattPay GitHub repository.
2. Select the Pull Requests tab.
3. Click New Pull Request.
4. Select your feature branch as the source.
5. Select `main` as the destination.
6. Describe the changes.
7. Submit the Pull Request.
8. Wait for the review before merging.

Avoid pushing unfinished feature work directly to `main`.

## 11.6 After your Pull Request is merged

Update your local `main` branch:

```bash
git switch main
git pull origin main
```

Delete your completed local feature branch if you no longer need it:

```bash
git branch -d feature/task-name
```

---

# 🗂️ 12. Project Folder Structure

The current WattPay project follows this structure:

```text
techtalks-wattpay/
│
├── prisma/
│   ├── migrations/
│   │   ├── migration_lock.toml
│   │   └── 20261118200235_init/
│   │       └── migration.sql
│   │
│   ├── schema.prisma
│   └── seed.ts
│
├── scripts/
│   └── test-prisma.ts
│
├── public/
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
│
├── src/
│   ├── generated/
│   │   └── prisma/
│   │
│   ├── auth.ts
│   │
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   │
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   │
│   │   ├── admin/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   │
│   │   ├── api/
│   │   │   └── auth/
│   │   │       └── [...nextauth]/
│   │   │           └── route.ts
│   │   │
│   │   ├── collector/
│   │   │   └── page.tsx
│   │   │
│   │   ├── portal/
│   │   │   └── page.tsx
│   │   │
│   │   └── reader/
│   │       └── page.tsx
│   │
│   ├── components/
│   │   ├── layout/
│   │   └── ui/
│   │
│   ├── lib/
│   │   └── prisma.ts
│   │
│   └── server/
│       └── auth/
│           ├── guards.ts
│           └── permissions.ts
│
├── tests/
│   ├── auth.test.ts
│   └── authorization.test.ts
│
├── .env                 # Local secrets - never commit
├── .env.example         # Safe configuration template
├── .gitignore
├── package.json
├── package-lock.json
├── prisma7.config.ts
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
└── README.md
```

### Important folders

**prisma/**

Contains the database schema, migrations, and seed script.

**src/app/**

Contains the Next.js application pages and API routes.

**src/components/**

Contains reusable React components.

**src/lib/**

Contains shared utilities and database client configuration.

**src/server/**

Contains server-side authentication and authorization logic.

**src/generated/prisma/**

Contains the generated Prisma Client. Do not manually edit its generated files.

**tests/**

Contains automated tests for authentication and authorization.

**scripts/**

Contains development and database verification scripts.

---

# 🧪 13. Testing & Code Quality

Before submitting your changes through a Pull Request, run the relevant checks.

### TypeScript check

```bash
npx tsc --noEmit
```

This checks for TypeScript errors without generating build output.

### Prisma schema validation

```bash
npx prisma validate
```

This verifies that the Prisma schema is valid.

### Prisma Client generation

```bash
npx prisma generate
```

Regenerate the client after schema changes.

### ESLint

```bash
npm run lint
```

This checks the project for linting issues.

### Production build

```bash
npm run build
```

This checks whether the application can be built for production.

Do not submit code with unresolved errors in the checks relevant to your changes.

---

# ⚠️ 14. Common Problems & Solutions

### Problem 1: `npm` or `node` is not recognized

**Cause:** Node.js is not installed correctly or the terminal has not refreshed its PATH.

**Solution:**

1. Install Node.js 24.x.
2. Restart VS Code.
3. Open a new terminal.
4. Run:

```bash
node -v
npm -v
```

### Problem 2: Cannot find module

**Cause:** Dependencies may not have been installed.

**Solution:**

```bash
npm ci
```

### Problem 3: `DATABASE_URL` is not configured

**Cause:** Your `.env` file is missing or the environment variable is incorrect.

**Solution:**

1. Check that `.env` exists in the project root.
2. Check that `DATABASE_URL` is present.
3. Verify that the connection points to the Neon `development` branch.
4. Restart your development server after changing environment variables.

Never share your connection string publicly.

### Problem 4: `DIRECT_URL` is missing

**Cause:** The direct PostgreSQL connection is not configured.

**Solution:**

Ask the team leader or database maintainer for an authorized direct development connection.

### Problem 5: Prisma Client is outdated

**Cause:** The Prisma schema has changed but the generated client has not been regenerated.

**Solution:**

```bash
npx prisma generate
```

### Problem 6: Database schema is not up to date

**Cause:** Your local migration files or shared database schema may not be synchronized.

**Solution:**

First pull the latest repository changes:

```bash
git pull origin main
```

Then check:

```bash
npx prisma migrate status
```

If a migration needs to be applied, coordinate with the designated database maintainer.

Do not reset or push the database schema independently.

### Problem 7: Neon connection error

**Cause:** Incorrect credentials, inactive compute, or network connectivity problems.

**Solution:**

1. Verify that Neon is available.
2. Confirm that you selected the `development` branch.
3. Check your connection strings.
4. Verify your internet connection.
5. Contact the database maintainer if the problem continues.

### Problem 8: Port 3000 is already in use

**Cause:** Another Next.js application is already running.

**Solution:**

Stop the other development server using `Ctrl + C`, or use the alternative port suggested by Next.js.

---

# 🔒 15. Important Team Development Rules

All developers must follow these rules.

1. Never commit `.env` or private credentials.
2. Never use the production database for development.
3. Always use the shared Neon `development` branch.
4. Never reset the shared database.
5. Never run `prisma db push` against the shared database.
6. Do not modify an already-applied migration.
7. Coordinate database schema changes with the designated database maintainer.
8. Do not rerun the seed unnecessarily.
9. Do not manually edit files inside `src/generated/prisma/`.
10. Use feature branches and Pull Requests.
11. Pull the latest changes before starting new work.
12. Communicate before performing operations that could modify shared data.

Remember that all four developers are working with the same development database. Be careful when inserting, updating, or deleting records.

---

# 📊 16. Current Project Status

**Project stage:** Initial development and database setup completed; application feature development is ongoing.

The following infrastructure has been configured:

- Next.js application initialized.
- PostgreSQL database hosted on Neon.
- Shared development branch created.
- Prisma 7.10.1 installed.
- Eleven database entities created.
- Initial database migration applied.
- Four PostgreSQL enums configured.
- Database foreign keys, indexes, and integrity constraints added.
- Prisma Client generated.
- Application-level database connection tested.
- Synthetic development seed data inserted and verified.

The application features are still being developed.

Future implementation work should follow the approved Product Requirements Document (PRD), Technical Design Document (TDD), database ERD, Jira Sprint plan, and TechTalks requirements.

---

# 📚 17. Project Documentation

The following documents guide WattPay development:

- Product Requirements Document (PRD).
- Technical Design Document (TDD).
- Entity–Relationship Diagram (ERD).
- Database schema and integrity specifications.
- System architecture diagram.
- Jira Sprint 1 backlog and implementation plan.
- TechTalks project requirements.

Developers should refer to these documents before implementing new functionality or changing the database structure.

---

# 🤝 18. Final Note

WattPay is a collaborative project developed by four team members.

The purpose of this README is to help every developer install the project, understand its structure, connect to the shared database, and follow the same development workflow.

If you encounter a problem, communicate with the team before changing shared configurations or database structures.

**Let's build WattPay together! ⚡**