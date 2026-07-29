# Supabase SaaS Application

This project is configured and ready for export to **GitHub** and instant deployment on **Vercel**.

## 1. How to Push / Connect to GitHub

You can export this code directly from AI Studio:
1. Click on the **Settings / Export** menu in the top-right toolbar of AI Studio.
2. Select **Export to GitHub** (or **Download ZIP** if you prefer pushing manually).
3. If using Export to GitHub, select your repository name and click **Create Repository**.

---

## 2. How to Deploy on Vercel

Once your code is in a GitHub repository:
1. Go to [Vercel](https://vercel.com/) and sign in with your GitHub account.
2. Click **Add New Project** -> **Import Git Repository**.
3. Select your GitHub repository.
4. Leave the **Build and Output Settings** as default (Vercel will detect `vercel.json`).
5. Click **Deploy**.

---

## 3. Supabase Environment Setup

Make sure your Supabase Database is ready:
1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** -> **New Query**.
3. Paste the contents of the `schema.sql` file included in this repository and click **Run**.
4. Disable "Confirm Email" under **Authentication** -> **Providers** -> **Email** for fast user sign-ups if needed.
