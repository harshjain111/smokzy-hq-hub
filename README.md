# Smokzy HQ Hub

Head-office operations app for Smokzy, a chain of hookah lounges/clubs — attendance, sales,
stock, rostering, inspections, and management dashboards. Installable PWA, mobile-first for
staff.

See [CLAUDE.md](./CLAUDE.md) for the full architecture map, roles/access model, and working
agreements.

## Stack

- **Frontend**: Vite + React 18 + TypeScript, shadcn-ui (Radix) + Tailwind, React Router, TanStack Query
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions)
- **Hosting**: Vercel

## Local development

```sh
git clone https://github.com/harshjain111/smokzy-hq-hub.git
cd smokzy-hq-hub
npm i
cp .env.example .env   # fill in your Supabase project's URL/anon key/project ID
npm run dev
```

```sh
npm run build     # production build
npm run lint       # eslint
```

## Backend (Supabase)

```sh
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push                                                 # apply migrations
npx supabase functions deploy                                        # deploy edge functions
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

## Deployment

Hosted on Vercel (`harshjain111s-projects/club`), connected to this repo — pushes to `main`
deploy automatically. `vercel.json` handles the SPA rewrite so client-side routes work on a
direct hit/refresh.
