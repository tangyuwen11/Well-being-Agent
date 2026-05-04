# Fit Agent Web

个人训练、营养、身体指标和 HealthKit 导入追踪工具。

## Local

```bash
npm install
npm run dev
```

Open `http://localhost:5173/`.

## Storage

The app is local-first. Without Supabase environment variables, it stores data in browser `localStorage`.
When Supabase is configured, users can sign in and sync the same app data to Postgres through row-level security.

It supports:

- workouts
- nutrition with calories, macros, fiber, sugar, sodium, vitamin C, vitamin D, calcium, iron, and water
- body metrics with height, weight, body fat, and waist
- Apple Health export import from `.zip` or `export.xml`
- meal photo upload flow with an editable nutrition estimate

## Supabase Auth + Cloud Database

1. Create a Supabase project.
2. Open Supabase SQL Editor and run [`supabase/schema.sql`](./supabase/schema.sql).
3. Copy the project URL and public anon key from Supabase Project Settings > API.
4. Create a local `.env` from `.env.example`:

```bash
cp .env.example .env
```

5. Fill in:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

6. Restart the dev server.

For Vercel, add the same two variables in Project Settings > Environment Variables, then redeploy.

## HealthKit Path

A browser web app cannot directly read iOS HealthKit or Apple Watch samples. Apple Watch writes workouts and biometrics into Apple Health on the paired iPhone; HealthKit access then requires an iOS app with the HealthKit capability, `HKHealthStore`, and user-granted read permissions.

Recommended production architecture:

1. Web app for dashboards, manual logging, and multi-device review.
2. Auth + database for synced user data.
3. iOS companion app reads HealthKit with user permission.
4. Companion app syncs selected health samples to the backend.
5. Web app reads normalized records from the backend.

## Photo Nutrition Agent Path

The current local app keeps photos on-device and uses a local editable estimate. A production VLM version should use:

1. Web app captures or uploads the meal photo.
2. Backend receives the image after explicit user consent.
3. Backend calls a VLM to identify foods, estimate portions, and return structured nutrition.
4. Web app displays the estimate for user correction before saving.
5. Saved records store structured nutrition data, not necessarily the raw photo.

## Production Deploy

The current production path:

1. Deploy the Vite web app to Vercel.
2. Add Supabase Auth and Postgres for persistent synced data.
3. Add explicit consent screens for HealthKit sync and server upload.
4. Add an iOS companion app that reads HealthKit and syncs selected records to Supabase.
