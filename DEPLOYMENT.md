# Deployment DuaDompet

- Production: https://duadompet-ashy.vercel.app
- Vercel project: kuadrat / duadompet (Hobby)
- Database: duadompet-db, Neon Free, Washington DC (iad1)
- Database authentication and realtime add-ons: disabled (application uses NextAuth).
- Integration manages DATABASE_URL and DATABASE_URL_UNPOOLED; production login/cron secrets are stored as Vercel Secrets.
- NEXTAUTH_URL: https://duadompet-ashy.vercel.app
- Vercel Build Command override: `DATABASE_URL="$DATABASE_URL_UNPOOLED" npx prisma migrate deploy && npm run build`

For source updates, upload the source directory again from the project's Overview, or connect a Git repository. Never upload a live `.env`, `node_modules`, or `.next` directory. Keep the Vercel build override so checked-in Prisma migrations run before the new application is promoted.

Email recovery delivery still requires SMTP_URL and MAIL_FROM from an email provider. The application can register, sign in and store transactions without SMTP; password-recovery emails are not delivered until configured.

Free plans have provider usage limits; no paid plan was selected during setup.
