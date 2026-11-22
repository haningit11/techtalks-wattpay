# ⚡ WattPay
## Electricity Billing & Payment Management System

WattPay is a web-based electricity billing and payment management system designed for private generator operators in Lebanon.

The system aims to simplify and organize electricity operations through subscriber management, building and collection route management, monthly meter readings, electricity bill generation, payment tracking, and outstanding balance management.

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

- **Next.js:** Handles application pages, server-side functionality, and API endpoints.
- **React:** Builds the user interface and reusable components.
- **TypeScript:** Provides type safety and helps identify errors.
- **Tailwind CSS:** Provides the styling system.
- **PostgreSQL:** Stores WattPay's structured application data.
- **Neon:** Hosts the PostgreSQL databases online.
- **Prisma:** Connects the application to PostgreSQL and manages database models and migrations.
- **Auth.js:** Supports application authentication.
- **bcryptjs:** Hashes account passwords before they are stored.

### Application architecture

WattPay follows a unified Next.js architecture.

The frontend and backend are part of the same Next.js project. Server-side functionality communicates with PostgreSQL through Prisma.

The database is hosted separately on Neon.

There is no separate Express.js backend server in the current MVP architecture.

---

# 📋 3. Prerequisites

Before starting development, make sure you have installed the following software.

### 3.1 Node.js

Node.js is required to run Next.js and the development tools.

Recommended version: **Node.js 24.x**

Download: https://nodejs.org/

Check your installation:

```bash
node -v
```

### 3.2 npm

npm is installed together with Node.js. It manages project dependencies.

```bash
npm -v
```

### 3.3 Git

Git is used to download the project and collaborate with other developers.

Download: https://git-scm.com/

```bash
git --version
```

### 3.4 Visual Studio Code

VS Code is the recommended code editor.

Download: https://code.visualstudio.com/

### 3.5 GitHub account

You need a GitHub account with access to the WattPay repository.

Repository:

https://github.com/haningit11/techtalks-wattpay

**Note:** The repository is currently public. Do not assume that source code is private simply because you are a project collaborator.

### 3.6 Neon database access

WattPay uses Neon to host its PostgreSQL databases.

Each authorized developer has:
- An individual Neon development branch.
- An individual PostgreSQL database role.
- Their own pooled connection string.
- Their own direct connection string.

The team leader provides the necessary access and credentials.

Never use the Neon project owner's credentials.

---

# 🚀 4. Getting Started — Downloading WattPay

Follow these steps in order.

### Step 1: Choose a project location

Open VS Code.

Select:

**File → Open Folder**

Choose where you want to store WattPay.

For example:

```text
C:\Users\YourName\Desktop\Projects
```

### Step 2: Open the terminal

In VS Code, select:

**Terminal → New Terminal**

### Step 3: Clone the GitHub repository

Run:

```bash
git clone https://github.com/haningit11/techtalks-wattpay.git
```

This downloads the WattPay repository onto your computer.

### Step 4: Enter the project folder

```bash
cd techtalks-wattpay
```

Make sure you are inside the actual project directory before running the remaining commands.

### Step 5: Open the project in VS Code

If necessary, run:

```bash
code .
```

The WattPay project should now appear in the VS Code Explorer.

---

# 📦 5. Installing Project Dependencies

Before running WattPay, install its dependencies.

Run:

```bash
npm ci
```

### What does this command do?

It reads `package-lock.json` and installs the exact dependency versions recorded in the project.

This helps ensure that all four developers use consistent package versions.

**Important:**

- Use `npm ci` when setting up the project for the first time.
- Do not run `create-next-app` again.
- Do not manually install packages that are already listed in `package.json`.
- If a teammate adds a dependency, pull the updated GitHub changes and run `npm ci` again.

---

# 🔐 6. Environment Variables & Database Connection

This is one of the most important parts of setting up WattPay.

The application connects to PostgreSQL databases hosted on Neon.

Each developer must create their own local `.env` file and configure it using their personal Neon branch credentials.

### 6.1 What is an environment variable?

Environment variables store configuration information that an application needs to run.

Examples include:

- Database connection strings.
- Passwords.
- Secret keys.
- API credentials.

These values should not be written directly inside application source code or uploaded to GitHub.

### 6.2 Create your `.env` file

Inside the main `techtalks-wattpay` folder:

1. Open VS Code.
2. Right-click the project folder.
3. Select **New File**.
4. Name the file:

```text
.env
```

5. Open it and add:

```env
DATABASE_URL="YOUR_POOLED_NEON_CONNECTION"
DIRECT_URL="YOUR_DIRECT_NEON_CONNECTION"
```

Replace both placeholders with your own authorized Neon development connection strings.

Do not copy another developer's credentials.

The project also contains `.env.example`. This is a safe configuration template committed to GitHub. It does not contain actual database credentials.

### 6.3 Understanding the two database connections

WattPay uses two different PostgreSQL connection types.

**DATABASE_URL — Pooled connection**

This connection uses Neon's connection pooler.

It is used by:
- Prisma Client.
- Next.js server-side functionality.
- Application database queries.

When retrieving it from Neon, turn **Connection pooling ON**.

**DIRECT_URL — Direct connection**

This connection connects directly to PostgreSQL without using the pooler.

It is used by:
- Prisma database migrations.
- Initial development database seeding.

When retrieving it from Neon, turn **Connection pooling OFF**.

### 6.4 How to obtain your Neon connection strings

Each developer must retrieve their own credentials.

Follow these steps:

1. Open https://console.neon.tech.
2. Open the WattPayDB project.
3. Select your personal development branch.
4. Click **Connect**.
5. Select the `neondb` database.
6. Select your assigned PostgreSQL role.
7. Turn Connection pooling ON.
8. Copy the connection string and use it as `DATABASE_URL`.
9. Turn Connection pooling OFF.
10. Copy the connection string and use it as `DIRECT_URL`.

Make sure both strings belong to your personal branch.

### 6.5 Understanding the individual Neon branches

The WattPay Neon project contains the following branches:

| Branch | Developer | PostgreSQL Role |
|---|---|---|
| `production` | Live environment | Production role |
| `development` | Shared development baseline | Development owner role |
| `dev-hanin` | Hanin Idriss | `hanin_dev` |
| `dev-aya` | Aya Hage | `aya_dev` |
| `dev-aleen` | Aleen Amer | `aleen_dev` |
| `dev-mohamad` | Mohamad Hotait | `mohamad_dev` |

Each developer must connect to their own branch.

For example:

- Hanin connects to `dev-hanin`.
- Aya connects to `dev-aya`.
- Aleen connects to `dev-aleen`.
- Mohamad connects to `dev-mohamad`.

Each branch has its own database state.

This means that changes made to records in one developer's branch do not automatically appear in another developer's branch.

### 6.6 Understanding Neon branch isolation

A Neon branch is an independent database environment based on a parent branch at the time it is created.

Our personal branches were created from the shared `development` branch.

They initially inherit the database structure and records available in the parent branch at that point.

After creation, each branch can have its own database changes.

**Important:**

Neon branches do not automatically synchronize future changes with their parent branches.

For example, if a new migration is applied to `development`, it does not automatically appear in `dev-hanin`, `dev-aya`, `dev-aleen`, or `dev-mohamad`.

The team must coordinate database migrations so that all required development branches receive the approved schema changes.

### 6.7 Why does every developer need their own `.env`?

Each developer has their own local project folder and Neon credentials.

This allows:

- Every developer to run WattPay locally.
- Every developer to work with their own database branch.
- Developers to test changes without directly modifying another developer's database.
- The team to work independently while following the same application codebase.

The `.env` file is not shared through GitHub.

### 6.8 Security rules

Never:

- Upload `.env` to GitHub.
- Share database passwords in public messages.
- Put connection strings directly in TypeScript files.
- Commit private API keys.
- Distribute the Neon owner credentials.
- Use production credentials for development.

---

# 🗄️ 7. Database Architecture

WattPay uses PostgreSQL hosted on Neon.

The database currently contains 11 core entities.

| Entity | Purpose |
|---|---|
| User | Stores user accounts, roles, and authentication information. |
| Building | Stores physical subscriber building information. |
| CollectionRoute | Organizes subscribers into collection routes. |
| UserRouteAssignment | Connects staff members to assigned routes. |
| Subscriber | Stores customer information. |
| Subscription | Stores electricity service and amperage information. |
| MeterReading | Stores cumulative meter readings and review information. |
| Tariff | Stores monthly electricity rates and fixed fees. |
| Bill | Stores generated electricity bills. |
| Payment | Stores recorded payments and receipt information. |
| AuditLog | Stores records of important application actions. |

### 7.1 User roles

The application supports four roles:

- `OPERATOR`
- `METER_READER`
- `PAYMENT_COLLECTOR`
- `SUBSCRIBER`

Each role has different responsibilities and permissions.

### 7.2 Database environments

WattPay separates its database environments into:

**Production**
- Intended for the live application.
- Will contain real application data.
- Must never be used for ordinary development or testing.

**Development**
- Shared baseline environment.
- Used to establish and coordinate database changes.

**Personal development branches**
- Each developer has their own Neon branch.
- Used for individual testing and development.
- Changes remain isolated between branches.

### 7.3 Important distinction: GitHub branches vs. Neon branches

These are two different concepts.

| GitHub | Neon |
|---|---|
| Stores different versions of application code. | Stores different versions of database structure and data. |
| Example: `main`. | Example: `dev-hanin`. |
| Used for feature development and Pull Requests. | Used for database isolation and testing. |

Merging a GitHub Pull Request does not automatically merge Neon database branches.

Database migrations and changes must be coordinated separately.

### 7.4 Production safety

Never use the production database for development.

Production migrations must be reviewed and applied through a controlled deployment process.

Do not copy synthetic development data into production.

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
├── generated/
│   └── prisma/
│
└── lib/
    └── prisma.ts
```

**schema.prisma**

Defines the database models, fields, relationships, enums, and constraints represented by Prisma.

**seed.ts**

Contains the script used to insert synthetic development data.

**migrations/**

Stores the SQL migration history used to create and update the database structure.

**migration.sql**

Contains the SQL statements generated for the initial database migration, including custom database integrity constraints.

**prisma7.config.ts**

Configures Prisma, the schema location, migration directory, direct database connection, and seed command.

**src/generated/prisma/**

Contains the generated Prisma Client used by the application.

This directory is generated locally and should not be manually edited or committed to GitHub.

**src/lib/prisma.ts**

Contains the Prisma Client configuration used by the application.

### 8.2 Generate Prisma Client

After installing dependencies and configuring `.env`, run:

```bash
npx prisma generate
```

This generates the TypeScript client from `schema.prisma`.

Whenever the database schema changes and a new client is required, generate it again.

### 8.3 Check migration status

To see whether your database is synchronized with the migration files, run:

```bash
npx prisma migrate status
```

The expected result for a fully synchronized development branch is:

```text
Database schema is up to date!
```

### 8.4 Applying migrations

The designated database maintainer coordinates the application of reviewed migrations.

The command used to deploy committed migrations is:

```bash
npx prisma migrate deploy
```

This applies migration files that have not yet been applied to the database specified by `DIRECT_URL`.

**Do not independently apply migrations to shared or other developers' branches.**

Before applying a new migration:

1. Discuss the schema change with the team.
2. Review the updated Prisma schema.
3. Generate and inspect the migration SQL.
4. Commit the migration files to GitHub through the agreed workflow.
5. Coordinate with the database maintainer.
6. Apply the approved migration to the required development branches.
7. Verify migration status on each relevant branch.
8. Inform the other developers that the schema has changed.

Never edit an already-applied migration file.

Create a new migration for future schema changes.

Do not use `prisma db push` or `prisma migrate reset` against the established development databases.

---

# 🌱 9. Database Seeding & Synthetic Data

### 9.1 What is database seeding?

Database seeding means inserting initial or sample records into a database automatically through a script.

Instead of manually creating every user, subscriber, building, and subscription, Prisma executes the seed script.

WattPay has an existing seed script:

```text
prisma/seed.ts
```

### 9.2 Current synthetic development data

The initial seed has already been successfully executed on the shared Neon development database.

The initial personal branches were created from that development environment and were intended to inherit its existing data.

The initial records are:

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

November bills and payments are intentionally not included in the initial seed data.

They will be created and tested through the billing and payment workflows.

**Note:** Developers should verify that their personal Neon branch contains the expected records rather than assuming every branch has been independently tested.

### 9.3 Do developers need to run the seed?

**No.**

The initial seed has already been executed.

Personal branches created from the seeded development branch should inherit the initial synthetic records.

Developers connecting to their own correctly initialized branch should be able to access those records.

Do not run the seed simply because you cloned the repository.

Only run it when the team leader or database maintainer explicitly requests it.

### 9.4 Demo login accounts

The initial seed creates these synthetic accounts:

| Role | Email |
|---|---|
| Operator | operator@wattpay.local |
| Meter Reader | reader@wattpay.local |
| Payment Collector | collector@wattpay.local |
| Subscriber | s2@wattpay.local |

All four accounts use the same initial development demo password.

The password was provided through the `SEED_DEMO_PASSWORD` environment variable when the seed was executed.

Ask the team leader for the demo password through a private channel.

Never put demo passwords in GitHub or this README.

### 9.5 Understanding SEED_DEMO_PASSWORD

`SEED_DEMO_PASSWORD` is only required when intentionally executing the seed script.

It is not required simply to:

- Clone the repository.
- Start WattPay.
- Connect to Neon.
- Generate Prisma Client.
- Test the database connection.
- Log in using an already-created demo account.

The seed script hashes the password using bcryptjs before storing it in the database.

The original password is not stored as plain text.

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

The current homepage is still the Next.js starter page until the WattPay homepage is implemented.

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
| `npx prisma migrate status` | Checks migration status. |
| `npx prisma migrate deploy` | Applies committed migrations. |
| `npx prisma studio` | Opens a visual database browser. |

Use Prisma Studio carefully because changes made through it affect the Neon branch configured in your `.env`.

---

# 🔄 11. Git & GitHub Collaboration

Git allows all four developers to work on the same project without directly overwriting one another's code.

We use feature branches and Pull Requests.

### 11.1 Before starting work

Always update your local `main` branch.

```bash
git switch main
```

Then:

```bash
git pull origin main
```

This downloads the latest changes from GitHub.

### 11.2 Create a feature branch

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

### 11.3 Save your changes

After completing a task, check the changed files:

```bash
git status
```

Stage the relevant files:

```bash
git add .
```

Before committing, inspect what you staged:

```bash
git diff --cached
```

Create a commit:

```bash
git commit -m "Add subscriber management page"
```

### 11.4 Push your feature branch

```bash
git push -u origin feature/task-name
```

Replace `feature/task-name` with your actual branch name.

### 11.5 Create a Pull Request

1. Open the WattPay GitHub repository.
2. Select the Pull Requests tab.
3. Click New Pull Request.
4. Select your feature branch as the source.
5. Select `main` as the destination.
6. Describe the changes.
7. Submit the Pull Request.
8. Request a review from a teammate.
9. Address any feedback.
10. Merge only after the review is completed.

Avoid pushing unfinished feature work directly to `main`.

### 11.6 After your Pull Request is merged

Update your local `main`:

```bash
git switch main
git pull origin main
```

Delete your completed local feature branch if you no longer need it:

```bash
git branch -d feature/task-name
```

### 11.7 Important: GitHub and Neon are separate

Merging a GitHub Pull Request updates application code.

It does not automatically update your Neon database branches.

If a Pull Request includes a database migration, the database maintainer must coordinate applying that migration to the required development branches.

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
│
├── src/
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
│   │   ├── api/
│   │   ├── collector/
│   │   ├── portal/
│   │   └── reader/
│   │
│   ├── components/
│   │   ├── layout/
│   │   └── ui/
│   │
│   ├── generated/
│   │   └── prisma/          # Generated locally
│   │
│   ├── lib/
│   │   └── prisma.ts
│   │
│   ├── server/
│   │   └── auth/
│   │
│   └── auth.ts
│
├── tests/
│   ├── auth.test.ts
│   └── authorization.test.ts
│
├── .env                     # Local secrets - never commit
├── .env.example             # Safe configuration template
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

Contains Next.js application pages and API routes.

**src/components/**

Contains reusable React components.

**src/lib/**

Contains shared utilities and database client configuration.

**src/server/**

Contains server-side authentication and authorization logic.

**src/generated/prisma/**

Contains the generated Prisma Client.

This directory is created locally and ignored by Git.

**tests/**

Contains automated tests for authentication and authorization.

**scripts/**

Contains development and database verification scripts.

---

# 🧪 13. Testing & Code Quality

Before submitting changes through a Pull Request, run the relevant checks.

### TypeScript check

```bash
npx tsc --noEmit
```

Checks for TypeScript errors without generating build output.

### Prisma schema validation

```bash
npx prisma validate
```

Verifies that the Prisma schema is valid.

### Prisma Client generation

```bash
npx prisma generate
```

Regenerate the client after schema changes.

### Database connection test

```bash
npx tsx scripts/test-prisma.ts
```

This verifies the Prisma Client connection and checks whether subscriber records are accessible.

### ESLint

```bash
npm run lint
```

Checks the project for linting issues.

### Production build

```bash
npm run build
```

Checks whether the application can be built for production.

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
3. Verify that it uses your personal Neon pooled connection.
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

**Cause:** Your migration files and the selected Neon branch may not be synchronized.

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
2. Confirm that you selected your own development branch.
3. Check your pooled and direct connection strings.
4. Verify your internet connection.
5. Confirm that the selected database and PostgreSQL role are correct.
6. Contact the database maintainer if the problem continues.

### Problem 8: Port 3000 is already in use

**Cause:** Another Next.js application is already running.

**Solution:**

Stop the other development server using `Ctrl + C`, or use the alternative port suggested by Next.js.

### Problem 9: Generated Prisma files appear in Git status

**Cause:** The generated Prisma Client has been created locally.

**Solution:**

Check the `.gitignore` rule:

```gitignore
/src/generated/
```

Verify:

```bash
git check-ignore -v src/generated/prisma/client.ts
```

Do not manually add generated Prisma files to Git.

---

# 🔒 15. Important Team Development Rules

All developers must follow these rules.

1. Never commit `.env` or private credentials.
2. Never use the production database for development.
3. Always use your assigned personal Neon development branch.
4. Never reset a development database without authorization.
5. Never run `prisma db push` against established development databases.
6. Do not modify an already-applied migration.
7. Coordinate database schema changes with the designated database maintainer.
8. Do not rerun the seed unnecessarily.
9. Do not manually edit files inside `src/generated/prisma/`.
10. Use Git feature branches and Pull Requests.
11. Pull the latest changes before starting new work.
12. Communicate before performing operations that could modify shared resources.

Remember:

- GitHub `main` is the shared application codebase.
- Neon personal branches are separate database environments.
- Database schema changes must be coordinated.
- Production must remain separate from development.

---

# 📊 16. Current Project Status

**Project stage:** Initial development and database setup completed; application feature development is ongoing.

The following infrastructure has been configured:

- Next.js application initialized.
- PostgreSQL database hosted on Neon.
- Production and development database environments created.
- Four personal Neon development branches created.
- Individual PostgreSQL development roles configured.
- Prisma 7.10.1 installed.
- Eleven database entities created.
- Initial database migration applied.
- Four PostgreSQL enums configured.
- Foreign keys, indexes, and integrity constraints added.
- Prisma Client generation configured.
- Application-level database connection tested.
- Synthetic development seed data inserted and verified.
- GitHub database setup Pull Request merged.
- Prisma generated-client ignore rule updated and merged.

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

The purpose of this README is to help every developer:

- Install the project.
- Understand its structure.
- Configure their own Neon database connection.
- Generate Prisma Client.
- Run WattPay locally.
- Follow the same Git and Pull Request workflow.
- Understand the rules for database changes.

If you encounter a problem, communicate with the team before changing shared configurations or database structures.

**Let's build WattPay together! ⚡**