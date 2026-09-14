# Techtivo AGENTS

Internal platform for managing functional QA agents by project. This is the
`v0.1` product shell: private login, protected `/agents` dashboard, and a
minimal JIRITA agent detail page. No test execution or persistence yet.

## Getting Started

1. Copy the environment file and set your local credentials:

   ```bash
   cp .env.example .env.local
   ```

2. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) and sign in with the
   credentials set in `.env.local`.

## Environment variables

| Variable                | Description                                         |
| ------------------------ | ---------------------------------------------------- |
| `AGENTS_ADMIN_EMAIL`     | Email address allowed to sign in.                    |
| `AGENTS_ADMIN_PASSWORD`  | Password for the admin account.                      |
| `AGENTS_SESSION_SECRET`  | Secret used to sign the session cookie. Keep private. |

Never commit real values — only `.env.example` (with placeholders) is tracked
in git.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
