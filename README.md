# ⚡ WattPay

WattPay is a web-based electricity billing and payment management system designed for private generator operators in Lebanon.

The application aims to simplify subscriber management, monthly meter readings, electricity bill generation, payment tracking, and outstanding balance management.

## 👥 Team Members

- Hanin Idriss — Team Leader
- Aya Hage
- Aleen Amer
- Mohamad Hotait

## 🛠️ Tech Stack

- **Next.js** — Frontend and backend
- **React** — User interface
- **TypeScript** — Programming language
- **Tailwind CSS** — Styling
- **PostgreSQL** — Proposed database (not yet configured)
- **Prisma** — Proposed ORM (not yet configured)

## 📋 Prerequisites

Before starting, make sure you have installed:

1. **Node.js** — Version 20.9 or newer (use a supported LTS version).
2. **Git** — For cloning the repository and collaborating.
3. **Visual Studio Code** — Recommended code editor.
4. **GitHub account** — With access to the private WattPay repository.

You can check your installations by opening a terminal and running:

```bash
node -v
npm -v
git --version
```

If these commands display version numbers, the tools are installed.

## 🚀 Getting Started

### 1. Clone the repository

Open VS Code and choose the folder where you want to keep the project.

Open the terminal and run:

```bash
git clone https://github.com/haningit11/techtalks-wattpay.git
```


### 2. Open the project folder

```bash
cd techtalks-wattpay
```

### 3. Install dependencies

```bash
npm ci
```

This installs the project's dependencies using the committed `package-lock.json`, so teammates use consistent dependency versions.

If the lockfile is not yet available, use `npm install` instead.

### 4. Start the development server

```bash
npm run dev
```

### 5. Open WattPay

Open your browser and visit:

http://localhost:3000

You should see the Next.js starter page.

## 🔄 Basic Git Collaboration

Before starting work, update your local project:

```bash
git pull origin main
```

Create a new branch for your task:

```bash
git switch -c feature/task-name
```

After making changes:

```bash
git add .
git commit -m "Describe your changes"
git push -u origin feature/task-name
```

Then open GitHub and create a **Pull Request** to merge your changes into `main` after review.

Avoid pushing unfinished feature work directly to `main`.

## 📁 Project Status

**Current stage:** Initial Next.js project setup and technical planning.

The project is currently a starter application. WattPay features, database integration, and authentication have not yet been implemented.

Development work should follow the reviewed PRD, TDD, and TechTalks instructions.

## 🔐 Important Notes

- Do not upload `node_modules` to GitHub.
- Do not commit `.env` files, database passwords, API keys, or other secrets.
- Do not run `create-next-app` again after cloning the repository.
- Use `npm ci` to install dependencies after cloning.
- Coordinate changes with teammates through feature branches and Pull Requests.