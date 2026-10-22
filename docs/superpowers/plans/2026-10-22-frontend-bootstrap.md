# Frontend Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Vite placeholder in `frontend/` into a React app with Tailwind, shadcn/ui, React Router and the shared App Shell (collapsible sidebar, mode switch, streak widget), ready for the real screens in issue #5.

**Architecture:** One `AppShell` layout route renders the sidebar, header and an `<Outlet/>`; each of the five pages is a placeholder under it. Design tokens live in Tailwind config and CSS variables (dark only), so screens built later use classes, not hard-coded hex. Components are tested with Vitest + React Testing Library; every task is one commit.

**Tech Stack:** React 18.3, Vite 5.4 (already installed), React Router 6, Tailwind CSS 3.4, shadcn/ui (JavaScript, no TypeScript), lucide-react, Axios, Vitest + @testing-library/react + jsdom.

**Spec:** GitHub issue #4 (`[W1] Khởi tạo frontend`), `README.md` "Design System", `KeHoach.md` §1-2, and the sidebar/header markup in `design/Main.dc.html` (lines 54-155). Mock screens in `design/*.dc.html` are reference only.

## Global Constraints

- Language is JavaScript/JSX. No TypeScript.
- Dark mode only. Page background `slate-950` (`#020617`), card `slate-900` (`#0f172a`) with `slate-800` (`#1e293b`) border, accent `indigo-600` (`#4f46e5`). Semantic: `emerald-500` pass, `amber-500` needs work, `rose-500` error.
- Fonts: Inter for UI, JetBrains Mono for numbers and code.
- Sidebar width is exactly 264px expanded and 76px collapsed.
- Routes: `/`, `/interview`, `/english`, `/flashcards`, `/profile`.
- Sidebar labels, in order: `Dashboard`, `Tech Mock Interview`, `English Writing & Speaking`, `Mistake Flashcards`, `CV & JD Profile`.
- Mode switch labels: `Tech Interview`, `English Coach`.
- Sidebar toggle button has `aria-label="Collapse or expand sidebar"`.
- Active nav link carries `aria-current="page"`.
- API base URL comes from `VITE_API_BASE_URL`, default `http://localhost:8000/api/v1`.
- Anything animated respects `prefers-reduced-motion`.
- Run all npm commands inside the container: `docker compose exec frontend <cmd>` (start with `docker compose up -d frontend`). `node_modules` lives in the container only.

## Review Focus

- An unknown URL (e.g. `/nope`) renders a visible "not found" page inside the shell, not a blank screen. Pinned in Task 6.
- A collapsed (icon-only) sidebar still gives every link an accessible name. Pinned in Task 7.
- `/interview/123` keeps "Tech Mock Interview" active, while `/` does not make Dashboard active on other pages. Pinned in Task 6.
- The sidebar toggle works from the keyboard (Enter and Space). Pinned in Task 7.
- On a 360px-wide viewport the page has no horizontal scrollbar. Checked by hand in Task 9 (layout is not testable in jsdom).

---

### Task 1: React, Vitest and the `@` alias

**Files:**
- Modify: `frontend/package.json`, `frontend/vite.config.js`, `frontend/index.html`, `frontend/Dockerfile`
- Create: `frontend/jsconfig.json`, `frontend/src/main.jsx`, `frontend/src/App.jsx`, `frontend/src/test/setup.js`, `frontend/src/App.test.jsx`, `frontend/package-lock.json` (generated)

**Interfaces:**
- Produces: `App` (default export of `src/App.jsx`, no props) returning the whole app; alias `@` → `frontend/src` for Vite, Vitest and editors; npm script `test` = `vitest run`.

- [ ] **Step 1: Install dependencies**

Run `docker compose exec frontend npm install react@18.3.1 react-dom@18.3.1` and `docker compose exec frontend npm install -D @vitejs/plugin-react@4.3.4 vitest@2.1.8 jsdom@25.0.1 @testing-library/react@16.1.0 @testing-library/jest-dom@6.6.3 @testing-library/user-event@14.5.2`. Add script `"test": "vitest run"`.

- [ ] **Step 2: Write the failing test** `src/App.test.jsx`: renders `<App />` and asserts `screen.getByText('DevCoach AI')` is in the document (`getAllByText` length ≥ 1 is not acceptable; it must be exactly one match).

- [ ] **Step 3: Run it, expect FAIL** — `docker compose exec frontend npm test` fails because `App` does not exist.

- [ ] **Step 4: Implement** `src/App.jsx` (default export `App`, renders `<div>DevCoach AI</div>`), `src/main.jsx` (`createRoot(#root).render(<App />)`), `index.html` loads `/src/main.jsx` and has `<html lang="en" class="dark">`. `vite.config.js`: add `react()` plugin, `resolve.alias['@']` → `src`, keep the existing `server` block, add `test: { environment: 'jsdom', setupFiles: './src/test/setup.js', globals: true }`. `src/test/setup.js` imports `@testing-library/jest-dom/vitest`. `jsconfig.json` maps `@/*` → `./src/*`. Dockerfile: `COPY package*.json ./` and `RUN npm ci`.

- [ ] **Step 5: Run tests and build** — `npm test` → PASS; `npm run build` → exits 0.

- [ ] **Step 6: Commit** `git add frontend && git commit -m "Set up React, Vitest and the @ alias"`

### Task 2: Tailwind and design tokens

**Files:**
- Create: `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/src/index.css`
- Modify: `frontend/index.html` (Google Fonts link), `frontend/src/main.jsx` (import `./index.css`), `frontend/package.json`

**Interfaces:**
- Produces: Tailwind classes `font-sans` (Inter) and `font-mono` (JetBrains Mono); shadcn CSS variables on `:root` (dark values below); `darkMode: 'class'`.

- [ ] **Step 1: Install** `tailwindcss@3.4.17 postcss@8.4.49 autoprefixer@10.4.20 tailwindcss-animate@1.0.7` (dev).

- [ ] **Step 2: Write `tailwind.config.js`**: content `./index.html` and `./src/**/*.{js,jsx}`; `fontFamily.sans = ['Inter','system-ui','sans-serif']`, `fontFamily.mono = ['"JetBrains Mono"','ui-monospace','monospace']`; shadcn color mapping `border|input|ring|background|foreground|primary|secondary|muted|accent|destructive|card|popover` each as `hsl(var(--name))` with `DEFAULT`/`foreground` pairs; `borderRadius` from `--radius`; plugin `tailwindcss-animate`.

- [ ] **Step 3: Write `src/index.css`** with `@tailwind base/components/utilities` and `:root` variables (HSL, dark only): `--background: 229 84% 5%` (slate-950), `--foreground: 214 32% 91%`, `--card: 222 47% 11%`, `--card-foreground: 214 32% 91%`, `--popover: 222 47% 11%`, `--popover-foreground: 214 32% 91%`, `--primary: 243 75% 59%` (indigo-600), `--primary-foreground: 0 0% 100%`, `--secondary: 217 33% 17%`, `--secondary-foreground: 214 32% 91%`, `--muted: 217 33% 17%`, `--muted-foreground: 215 20% 65%`, `--accent: 217 33% 17%`, `--accent-foreground: 214 32% 91%`, `--destructive: 350 89% 60%`, `--destructive-foreground: 0 0% 100%`, `--border: 217 33% 17%`, `--input: 215 25% 27%`, `--ring: 239 84% 67%`, `--radius: 0.5rem`. Body: `bg-background text-foreground font-sans antialiased`. Google Fonts `<link>` for Inter 400-700 and JetBrains Mono 400-600, same URL as the design files.

- [ ] **Step 4: Verify** — change `App` to `<div className="bg-slate-950 font-mono text-indigo-600">DevCoach AI</div>`; `npm run build`; then assert the built CSS contains the three generated rules: `docker compose exec frontend sh -c "grep -l 'bg-slate-950' dist/assets/*.css"` prints a file name. Revert the `App` change.

- [ ] **Step 5: Commit** `"Add Tailwind and dark design tokens"`

### Task 3: shadcn/ui, Lucide and the `cn` helper

**Files:**
- Create: `frontend/components.json`, `frontend/src/lib/utils.js`, `frontend/src/lib/utils.test.js`, `frontend/src/components/ui/button.jsx` (generated)

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` in `@/lib/utils` (clsx + tailwind-merge); `Button` and `buttonVariants` from `@/components/ui/button`.

- [ ] **Step 1: Install** `class-variance-authority@0.7.1 clsx@2.1.1 tailwind-merge@2.5.5 lucide-react@0.468.0 @radix-ui/react-slot@1.1.1`.

- [ ] **Step 2: Write the failing test** `src/lib/utils.test.js`: `cn('px-2', 'px-4')` equals `'px-4'`; `cn('a', false && 'b', 'c')` equals `'a c'`.

- [ ] **Step 3: Run, expect FAIL** (`cn` not defined).

- [ ] **Step 4: Implement** `cn` in `src/lib/utils.js`. Write `components.json` by hand: `style: "default"`, `rsc: false`, `tsx: false`, tailwind config `tailwind.config.js`, css `src/index.css`, `baseColor: "slate"`, `cssVariables: true`, aliases `components: "@/components"`, `utils: "@/lib/utils"`, `ui: "@/components/ui"`. Then add the button with `docker compose exec frontend npx shadcn@2.1.8 add button --yes`.

- [ ] **Step 5: Run tests and build** — PASS; build exits 0.

- [ ] **Step 6: Commit** `"Add shadcn/ui, Lucide and the cn helper"`

### Task 4: Axios client

**Files:**
- Create: `frontend/src/api/client.js`, `frontend/src/api/client.test.js`, `frontend/.env.example`

**Interfaces:**
- Produces: `api` (an Axios instance, named export from `@/api/client`) with `baseURL` from `import.meta.env.VITE_API_BASE_URL` defaulting to `http://localhost:8000/api/v1`, `timeout: 15000`.

- [ ] **Step 1: Install** `axios@1.7.9`.

- [ ] **Step 2: Failing test**: `api.defaults.baseURL === 'http://localhost:8000/api/v1'` and `api.defaults.timeout === 15000`.

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: Implement** `client.js`. `.env.example` documents `VITE_API_BASE_URL=http://localhost:8000/api/v1`.

- [ ] **Step 5: Run tests** — PASS.

- [ ] **Step 6: Commit** `"Add Axios client with env-based base URL"`

### Task 5: Router and placeholder pages

**Files:**
- Create: `frontend/src/routes.jsx`, `frontend/src/pages/{Dashboard,InterviewRoom,WritingCoach,Flashcards,Profile,NotFound}.jsx`, `frontend/src/components/PageHeader.jsx`, `frontend/src/routes.test.jsx`
- Modify: `frontend/src/App.jsx`, `frontend/src/main.jsx`

**Interfaces:**
- Produces: `PageHeader({ title: string, description?: string })` rendering an `<h1>` and optional `<p>`; `routes` (array of route objects, exported from `@/routes`) with `path: '/'` element `<AppShell/>` (a stub `Outlet` wrapper until Task 6) and children `index`, `interview`, `english`, `flashcards`, `profile`, `*`; `App` renders `<RouterProvider router={createBrowserRouter(routes)} />`. Pages are default exports. Each page's `<h1>`: `Dashboard`, `Tech Mock Interview`, `English Writing Coach`, `Mistake Flashcards`, `CV & JD Profile`, and NotFound shows `Page not found`.

- [ ] **Step 1: Install** `react-router-dom@6.28.0`.

- [ ] **Step 2: Failing test** `routes.test.jsx` using `createMemoryRouter(routes, { initialEntries: [path] })`: for each of `/`, `/interview`, `/english`, `/flashcards`, `/profile` the matching `h1` text above is present; for `/nope` the heading `Page not found` is present.

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: Implement** the files above. A stub layout (`<Outlet />` only) lives in `src/components/layout/AppShell.jsx` so Task 6 can replace its body.

- [ ] **Step 5: Run tests and build** — PASS.

- [ ] **Step 6: Commit** `"Add React Router with placeholder pages"`

### Task 6: Sidebar navigation

**Files:**
- Create: `frontend/src/components/layout/navItems.js`, `frontend/src/components/layout/Sidebar.jsx`, `frontend/src/components/layout/Sidebar.test.jsx`
- Modify: `frontend/src/components/layout/AppShell.jsx`

**Interfaces:**
- Consumes: `routes` shape from Task 5.
- Produces: `NAV_ITEMS` — array of `{ to: string, label: string, icon: LucideIcon, end?: boolean }` in the order and with the labels from Global Constraints (icons: `LayoutDashboard`, `SquareTerminal`, `PenLine`, `Layers`, `FileUser`; only Dashboard has `end: true`). `Sidebar({ collapsed: boolean })` — an `<aside data-collapsed={collapsed}>` with brand block ("DevCoach AI", "v1.0 · beta"), a `<nav aria-label="Primary">` of `NavLink`s, width classes `w-[264px]` / `w-[76px]`. `AppShell` renders `<Sidebar collapsed={false} />` next to `<main><Outlet/></main>`.

- [ ] **Step 1: Failing tests** (render `Sidebar` inside `MemoryRouter`): at `/` the link named `Dashboard` has `aria-current="page"` and `Tech Mock Interview` does not; at `/interview/123` `Tech Mock Interview` has `aria-current="page"` and `Dashboard` does not; there are exactly 5 links in `NAV_ITEMS` order; `/nope` through `AppShell` still shows the sidebar plus `Page not found`.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `NAV_ITEMS`, `Sidebar` (active link classes from the design: `bg-indigo-600/[.18] text-indigo-200`, idle `text-slate-400 hover:bg-slate-900 hover:text-slate-200`, height 44px) and update `AppShell`.

- [ ] **Step 4: Run tests and build** — PASS.

- [ ] **Step 5: Commit** `"Add sidebar navigation"`

### Task 7: Collapsible sidebar and header

**Files:**
- Create: `frontend/src/components/layout/Header.jsx`, `frontend/src/components/layout/AppShell.test.jsx`
- Modify: `frontend/src/components/layout/AppShell.jsx`, `frontend/src/components/layout/Sidebar.jsx`

**Interfaces:**
- Consumes: `Sidebar({ collapsed })` from Task 6.
- Produces: `Header({ collapsed: boolean, onToggleSidebar: () => void })` with a `<button aria-label="Collapse or expand sidebar" aria-expanded={!collapsed}>`, a spacer, a notifications icon button (`aria-label="Notifications"`) and an avatar `BT` (`aria-label="Account: BoyTay"`). `AppShell` owns `collapsed` state (`useState(false)`). When `collapsed`, `Sidebar` hides text labels visually (`lbl` spans get `hidden`) but keeps each link's accessible name through `aria-label={label}` and `title={label}`.

- [ ] **Step 1: Failing tests** (`AppShell` in `MemoryRouter`): clicking the toggle changes `aside[data-collapsed]` from `"false"` to `"true"` and back; with the sidebar collapsed `getByRole('link', { name: 'Dashboard' })` still exists and the visible text `Dashboard` is not rendered as a label; focusing the toggle and pressing `{Enter}` then `{Space}` (user-event) toggles twice.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.** Width transition `transition-[width] duration-200 motion-reduce:transition-none`.

- [ ] **Step 4: Run tests and build** — PASS.

- [ ] **Step 5: Commit** `"Make the sidebar collapsible and add the header"`

### Task 8: Mode switch and streak widget

**Files:**
- Create: `frontend/src/components/layout/ModeSwitch.jsx`, `frontend/src/components/layout/StreakWidget.jsx`, `frontend/src/components/layout/ModeSwitch.test.jsx`, `frontend/src/components/layout/StreakWidget.test.jsx`
- Modify: `frontend/src/components/layout/Sidebar.jsx`

**Interfaces:**
- Produces: `ModeSwitch()` — two buttons `Tech Interview` / `English Coach`; the mode is derived from the URL (`/english…` ⇒ English Coach, anything else ⇒ Tech Interview); clicking navigates to `/interview` or `/english`; the active button has `aria-pressed="true"` and `bg-indigo-600`. `StreakWidget({ days: number, week: boolean[7], collapsed: boolean })` — expanded shows `"{days} Day Streak"`, the text `Practice today to extend it`, and 7 bars (filled `bg-amber-500`, empty `bg-slate-700`); collapsed shows only a flame icon and `days`. Sidebar renders `ModeSwitch` (hidden when collapsed) and `StreakWidget days={14} week={[true,true,true,true,true,true,false]}` (mock values until issue #34).

- [ ] **Step 1: Failing tests**: at `/english` the `English Coach` button has `aria-pressed="true"` and `Tech Interview` `"false"`; clicking `English Coach` from `/` navigates so the English page heading appears; `StreakWidget days={14}` shows `14 Day Streak` and exactly 6 filled bars for the mock week; with `collapsed` the text `Day Streak` is absent and `14` is present.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run tests and build** — PASS.

- [ ] **Step 5: Commit** `"Add mode switch and streak widget to the sidebar"`

### Task 9: End-to-end check and docs

**Files:**
- Modify: `README.md` (status line and a short "Chạy frontend" note)

- [ ] **Step 1: Full test run** — `docker compose exec frontend npm test` → all pass; `npm run build` exits 0.

- [ ] **Step 2: Run the app** — `docker compose up -d frontend`; open `http://localhost:5173`; click through all five links, the mode switch, and the sidebar toggle; reload on `/flashcards` (deep link renders the Flashcards page).

- [ ] **Step 3: Narrow viewport** — resize to 360px wide; confirm there is no horizontal page scrollbar and the sidebar stacks above the content.

- [ ] **Step 4: README** — update the status line ("giai đoạn thiết kế" → frontend khung đã dựng) and add the commands to run and test the frontend in Docker.

- [ ] **Step 5: Commit** `"Document frontend commands and update status"`

---

## Self-review notes

- **Issue #4 coverage:** Vite + Tailwind + shadcn/ui (Tasks 1-3), Inter/JetBrains Mono and tokens (2), Lucide (3), Router with the 5 routes (5), AppShell with sidebar/mode switch/streak (6-8), Axios client with env base URL (4), acceptance criteria — no-reload navigation (5), sidebar 76/264 px (6-7), keyboard + `aria-current` (6-7).
- **Not in this plan (issue #5):** real screen content, charts (Recharts), mock data modules.
- **Types:** `NAV_ITEMS` shape, `Sidebar({collapsed})`, `Header({collapsed,onToggleSidebar})` and `StreakWidget({days,week,collapsed})` are used with the same names in the tasks that consume them.
