# ⌨️ TypoTerror — Setup Guide

Real-time 1v1 typing battle. Challenge friends by sharing a room code.

---

## 🚀 Step 1 — Open in VS Code

```
Open VS Code → File → Open Folder → select the `typoterror` folder
```

Open the **terminal** inside VS Code: `` Ctrl+` `` (backtick)

---

## 📦 Step 2 — Install dependencies

```bash
npm install
```

---

## 🔥 Step 3 — Set up Firebase (FREE)

You need Firebase Realtime Database for real-time multiplayer.

### 3a. Create project
1. Go to → https://console.firebase.google.com
2. Click **"Add project"**
3. Name it `typoterror` → click through, disable Analytics if you want → **Create project**

### 3b. Create Realtime Database
1. In left sidebar → **Build → Realtime Database**
2. Click **"Create database"**
3. Choose any region (e.g. `us-central1`)
4. Select **"Start in test mode"** → Enable

### 3c. Get your config keys
1. Go to ⚙️ **Project Settings** (gear icon, top left)
2. Scroll down → **Your apps** → click **`</>`** (Web app)
3. Register app name `typoterror-web` → **Register app**
4. Copy the `firebaseConfig` object — you need these values ↓

### 3d. Fill in your `.env.local`

Open the file `.env.local` in VS Code and replace each value:

```
NEXT_PUBLIC_FIREBASE_API_KEY=          ← apiKey
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=      ← authDomain
NEXT_PUBLIC_FIREBASE_DATABASE_URL=     ← databaseURL
NEXT_PUBLIC_FIREBASE_PROJECT_ID=       ← projectId
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=   ← storageBucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID= ← messagingSenderId
NEXT_PUBLIC_FIREBASE_APP_ID=           ← appId
```

> ⚠️ The `databaseURL` looks like:
> `https://your-project-default-rtdb.firebaseio.com`

---

## ▶️ Step 4 — Run locally

```bash
npm run dev
```

Open → http://localhost:3000

You can test it yourself by opening **two browser tabs**.

---

## 🌐 Step 5 — Deploy to Vercel (FREE, shareable link)

### 5a. Push to GitHub
1. Install Git if you haven't: https://git-scm.com
2. In VS Code terminal:
```bash
git init
git add .
git commit -m "TypoTerror initial"
```
3. Go to https://github.com → **New repository** → name it `typoterror`
4. Follow the instructions GitHub shows to push your code

### 5b. Deploy on Vercel
1. Go to https://vercel.com → Sign up with GitHub
2. Click **"New Project"** → import your `typoterror` repo
3. Before clicking Deploy → click **"Environment Variables"**
4. Add each variable from your `.env.local` (all 7 of them)
5. Click **Deploy** 🎉

Your game is now live at something like:
`https://typoterror-yourname.vercel.app`

---

## 🎮 How to play

1. Open the link → enter your name → **Create Room**
2. Share the **6-letter room code** OR the invite link with your friend
3. Friend opens link → enters their name → pastes the code → **Join**
4. Both click **Ready Up** → countdown starts → TYPE!

---

## 🗂️ Project structure

```
typoterror/
├── src/
│   ├── app/
│   │   ├── page.js           ← Home / lobby
│   │   ├── layout.js
│   │   ├── globals.css
│   │   └── room/[code]/
│   │       └── page.js       ← Game room
│   ├── components/
│   │   └── GameRoom.js       ← Full game logic + UI
│   └── lib/
│       ├── firebase.js       ← Firebase connection
│       └── gameData.js       ← Words, attacks, utils
├── .env.local                ← Your Firebase keys (never commit!)
└── package.json
```

---

## ⚔️ Attacks

| Attack   | Effect                       | Unlocks at |
|----------|------------------------------|------------|
| 👁 BLIND  | Blurs opponent text for 3s   | 20 wpm     |
| 💥 QUAKE  | Shakes opponent screen for 2s| 30 wpm     |
| 👻 GHOST  | Hides their typed chars      | 40 wpm     |
| ❄ FREEZE | Locks their keyboard for 2s  | 50 wpm     |
| 🔄 REWIND | Deletes 5 of their words     | 60 wpm     |
| 💣 BOMB   | Adds 10 words to opponent    | 75 wpm     |

---

## 🛠 Troubleshooting

**"Room not found"** → Make sure both players are on the same deployment URL

**Firebase permission error** → In Firebase Console, check Realtime Database Rules are in test mode:
```json
{
  "rules": { ".read": true, ".write": true }
}
```

**Vercel build fails** → Make sure all 7 environment variables are set in Vercel dashboard
