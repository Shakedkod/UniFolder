# XeLaTeX Compilation Microservice (`latex-service`)

A lightweight, dedicated Docker-based microservice that receives LaTeX source files and assets, compiles them using **XeLaTeX** (with full Hebrew support via Culmus fonts), and returns compiled PDF documents.

This microservice enables PDF compilation on **Vercel** or any serverless platform where local TeX Live cannot be installed.

---

## 🚀 Quick Deployment Options

### Option A: Railway (Fastest & Easiest)
1. Push your repository to GitHub (or push the `latex-service` directory to a new repo).
2. Go to [railway.app](https://railway.app) and click **"New Project"** -> **"Deploy from GitHub repo"**.
3. In settings:
   - If deploying from the monorepo, set **Root Directory** to `/latex-service`.
   - Railway will automatically detect the `Dockerfile`.
4. (Optional) In **Variables**, add:
   - `LATEX_SERVICE_SECRET`: (Any secure random string to protect your endpoint)
5. Under **Settings -> Networking**, click **"Generate Domain"** (e.g., `https://uni-latex-production.up.railway.app`).

## 🔗 Connecting to your Vercel Deployment

Once your microservice is running:
1. Open your Vercel Dashboard -> Go to your project (`uni-folder`).
2. Navigate to **Settings** -> **Environment Variables**.
3. Add:
   - `LATEX_COMPILER_URL`: `https://your-service-url.railway.app` (or your Render URL)
   - `LATEX_COMPILER_SECRET`: (Only if you set `LATEX_SERVICE_SECRET` on the microservice)
4. Redeploy on Vercel.
