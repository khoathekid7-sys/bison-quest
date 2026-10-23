# Publishing Bison Quest (GitHub Pages + photo checker)

Bison Quest has two parts:

| Part | Where it lives | Why |
|---|---|---|
| **The app** (all screens, map, album) | **GitHub Pages**, free, at `https://YOUR-USERNAME.github.io/bison-quest/` | Anyone can open the link and add it to their home screen |
| **The photo checker** (one small program) | **Cloudflare Workers**, free | GitHub Pages can only serve files and can't keep secrets. The checker holds your Anthropic API key so nobody can copy it from the website |

Plan on about 30–45 minutes the first time. After that, publishing a change is one click.

You'll need: a computer with the **Terminal** app, and free accounts at
**GitHub**, **Cloudflare** and **Anthropic** (for the API key).

---

## Part 1: Install the tools (once)

1. **Node.js:** download the **LTS** installer from <https://nodejs.org> and run it.
   Check it worked: open Terminal and type `node -v` (you should see `v24…` or similar).
2. **GitHub Desktop:** download from <https://desktop.github.com> and sign in with your
   GitHub account (create one at <https://github.com> if needed).
3. In Terminal, go into the project folder and install its parts:

   ```bash
   cd path/to/bison-quest
   ```

   ```bash
   npm install
   ```

   *Tip:* type `cd ` (with a space), drag the `bison-quest` folder from Finder into the
   Terminal window, and press Return.

## Part 2: Put the project on GitHub

1. Open **GitHub Desktop** → **File → Add Local Repository…** → choose the `bison-quest` folder.
2. It will say "this directory does not appear to be a Git repository". Click
   **create a repository**, keep the name `bison-quest`, and click **Create Repository**.
3. Click **Publish repository**. **Untick "Keep this code private"** (free GitHub Pages
   needs a public repository). Your API key is *not* in the code, so this is safe.
4. On github.com, open your new repository → **Settings → Pages**. Under
   **Build and deployment → Source**, choose **GitHub Actions**.

> If you name the repository something other than `bison-quest`, use that name
> wherever this guide says `bison-quest` in a web address.

## Part 3: Publish the photo checker on Cloudflare

1. Create a free account at <https://dash.cloudflare.com/sign-up>.
2. Open [wrangler.jsonc](wrangler.jsonc) in a text editor. Replace **both**
   `YOUR-GITHUB-USERNAME` with your GitHub username (lowercase). Save.

   ```jsonc
   "ALLOWED_ORIGINS": "https://khoa123.github.io,http://localhost:3000",
   "SITE_URL": "https://khoa123.github.io/bison-quest",
   ```

3. In Terminal (still in the project folder), log in to Cloudflare. A browser window opens; click **Allow**:

   ```bash
   npx wrangler login
   ```

4. Publish the checker. The first time, Cloudflare may ask you to pick a free
   `workers.dev` subdomain. Follow the link it prints:

   ```bash
   npx wrangler deploy
   ```

   At the end it prints an address like
   `https://bison-quest-checker.your-subdomain.workers.dev`. **Copy it.** This is your
   checker address.

5. Give the checker your Anthropic API key (create one at <https://platform.claude.com/>
   → Settings → API keys). Paste the key when asked; it won't show on screen:

   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY
   ```

6. Check it: open `https://…your checker address…/status` in your browser. You should see
   `"verificationConfigured":true` and `"passes":true`.

> **Cost:** Cloudflare Workers and GitHub Pages are free at this size. Anthropic charges
> a small amount per photo check. Set a monthly spend limit in the Claude Console
> (<https://platform.claude.com/>) so testing can never surprise you.

## Part 4: Connect the app to the checker and publish

1. On github.com, in your repository: **Settings → Secrets and variables → Actions**
   → **Variables** tab → **New repository variable**.
   - Name: `VERIFY_URL`
   - Value: your checker address from Part 3, e.g. `https://bison-quest-checker.your-subdomain.workers.dev` (no slash at the end)
2. In **GitHub Desktop**, you'll see your `wrangler.jsonc` change. Type a summary like
   "Set my GitHub username", click **Commit to main**, then **Push origin**.
3. On github.com, open the **Actions** tab. A run called **Deploy to GitHub Pages**
   starts. Wait for the green ✓ (about 2–3 minutes).
4. Your app is live at **`https://YOUR-USERNAME.github.io/bison-quest/`** 🎉

## Part 5: Try it on your phone

1. Open the link in **Safari** (iPhone) or **Chrome** (Android).
2. Tap **☰ → Setup status (organizers)**. It should say **API key set**.
3. Tap **☰ → Add to Home Screen** and follow the steps. Then open Bison Quest from
   the new icon. It runs full-screen like an app.
   - **iPhone:** add it to the home screen *before* starting the hunt. The home-screen
     app and Safari keep separate progress.
4. Walk the route with the checklist in [TESTING.md](TESTING.md).

---

## Making changes later

| You changed… | Do this |
|---|---|
| Clues, hints, discovery text, coordinates, photo rules (`src/config/hunt.ts`) | Commit + **Push** in GitHub Desktop (the app updates in ~3 min) **and** run `npx wrangler deploy` (the checker uses the same file) |
| Reference photos (`public/references/…`) | Commit + Push. They're shrunk automatically during publishing |
| Your API key | `npx wrangler secret put ANTHROPIC_API_KEY` |
| Anything in `worker/` or `wrangler.jsonc` | `npx wrangler deploy` |

Players' phones pick up the new version the next time they open the app with a connection.

### Automatic checker updates (optional)

To skip running `npx wrangler deploy` yourself after editing `hunt.ts`:

1. Cloudflare dashboard → **My Profile → API Tokens → Create Token** → use the
   **Edit Cloudflare Workers** template → Create → copy the token.
2. Copy your Cloudflare **Account ID** (shown on the Workers & Pages overview page in the dashboard).
3. GitHub repo → **Settings → Secrets and variables → Actions**:
   - **Secrets** tab: add `CLOUDFLARE_API_TOKEN` (the token) and `CLOUDFLARE_ACCOUNT_ID`.
   - **Variables** tab: add `DEPLOY_CHECKER` = `true`.

Now every push publishes both the app and the checker.

## Testing on your computer first (optional)

Two Terminal windows, both in the project folder:

```bash
cp .env.example .env.local
```

```bash
cp .dev.vars.example .dev.vars
```

Put your API key in `.dev.vars`. Then run the checker in one window:

```bash
npm run checker:dev
```

…and the app in the other:

```bash
npm run dev
```

Open <http://localhost:3000>. Use **☰ → Demo Mode** to move around campus from your desk.

## Troubleshooting

| What you see | Fix |
|---|---|
| github.io shows **404** | Settings → Pages → Source must be **GitHub Actions**; wait for the Actions run to finish; check the address ends with `/bison-quest/` |
| Actions run is red | Click it to see which step failed. "Unit tests" failing usually means a `hunt.ts` edit broke the 500 ft rule or has a typo |
| "Photo verification isn't set up on this site yet (no photo checker address)" | The `VERIFY_URL` variable is missing. Add it (Part 4) and re-run the Actions workflow |
| "isn't set up yet (no API key on the photo checker)" | Run `npx wrangler secret put ANTHROPIC_API_KEY` |
| "The photo checker didn't answer" every time | Check `ALLOWED_ORIGINS` in `wrangler.jsonc` is exactly `https://your-username.github.io` (no `/bison-quest`, no trailing slash), then `npx wrangler deploy` |
| Reference photos make every check fail | Check `SITE_URL` in `wrangler.jsonc` points at your published app, and the file names in `hunt.ts` match exactly (they're case-sensitive) |
| Location never works | It must be opened from the `https://` link, and location must be allowed for Safari/Chrome in the phone's settings |
