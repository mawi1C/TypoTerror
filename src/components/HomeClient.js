"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { ref, set, get, update } from "firebase/database";
import { generateRoomCode, makeWordList, ATTACKS, PLAYER_KEYS, MAX_PLAYERS } from "@/lib/gameData";
import TypoLogo from "../app/icon-web.png";
import Image from "next/image";

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [name, setName]         = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState("");
  const [mode, setMode]         = useState("1v1"); // "1v1" | "deathmatch"
  const [showInfo, setShowInfo] = useState(false);

  // ─── CREATE ───────────────────────────────────────────────────────────────
  async function createRoom() {
    if (!name.trim()) { setError("Enter your name first"); return; }
    setLoading("create");
    const code  = generateRoomCode();
    const words = makeWordList(120);

    if (mode === "1v1") {
      await set(ref(db, `rooms/${code}`), {
        code, words, mode: "1v1",
        status: "waiting",
        host:  { name: name.trim(), typedCount: 0, chars: 0, wpm: 0, charge: 0, ready: false },
        guest: null,
        attacks: [],
        createdAt: Date.now(),
      });
    } else {
      await set(ref(db, `rooms/${code}`), {
        code, words, mode: "deathmatch",
        status: "waiting",
        host: { name: name.trim(), typedCount: 0, chars: 0, wpm: 0, charge: 0, ready: false },
        attacks: [],
        createdAt: Date.now(),
      });
    }

    sessionStorage.setItem("tb_name", name.trim());
    sessionStorage.setItem("tb_role", "host");
    router.push(`/room/${code}`);
  }

  // ─── JOIN ─────────────────────────────────────────────────────────────────
  async function joinRoom() {
    if (!name.trim()) { setError("Enter your name first"); return; }
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setError("Room code must be 6 characters"); return; }
    setLoading("join");

    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) { setError("Room not found"); setLoading(""); return; }
    const room = snap.val();
    if (room.status !== "waiting") { setError("That game has already started"); setLoading(""); return; }

    if (room.mode === "deathmatch") {
      const takenKeys = PLAYER_KEYS.filter(k => !!room[k]);
      if (takenKeys.length >= MAX_PLAYERS) { setError("Room is full (5/5)"); setLoading(""); return; }
      const nextKey = PLAYER_KEYS.find(k => !room[k]);
      await update(ref(db, `rooms/${code}/${nextKey}`), {
        name: name.trim(), typedCount: 0, chars: 0, wpm: 0, charge: 0, ready: false,
      });
      sessionStorage.setItem("tb_name", name.trim());
      sessionStorage.setItem("tb_role", nextKey);
    } else {
      if (room.guest) { setError("Room is full"); setLoading(""); return; }
      await set(ref(db, `rooms/${code}/guest`), {
        name: name.trim(), typedCount: 0, chars: 0, wpm: 0, charge: 0, ready: false,
      });
      sessionStorage.setItem("tb_name", name.trim());
      sessionStorage.setItem("tb_role", "guest");
    }

    router.push(`/room/${code}`);
  }

  return (
    <main className="min-h-screen bg-[#0e0e0e] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center -mb-12 -mt-16">
          <div className="flex justify-center">
            <Image src={TypoLogo} alt="Typo Terror Logo" width={600} height={200} priority />
          </div>
        </div>

        {/* Name input */}
        <div className="mb-4">
          <label className="block text-[10px] tracking-[4px] text-[#444] mb-2">YOUR NAME</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            placeholder="enter username..."
            className="w-full bg-transparent border border-[#222] px-4 py-3 text-[#e8e0c8] text-sm tracking-widest outline-none focus:border-[#e8b84b] transition-colors"
            style={{ fontFamily: "'JetBrains Mono',monospace" }}
            maxLength={18}
          />
        </div>

        {/* Mode selector */}
        <div className="mb-5">
          <label className="block text-[10px] tracking-[4px] text-[#444] mb-2">GAME MODE</label>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("1v1")}
              style={{
                flex: 1, padding: "12px 0", fontSize: 12, letterSpacing: 4,
                fontFamily: "'JetBrains Mono',monospace", cursor: "pointer", transition: "all 0.15s",
                background: mode === "1v1" ? "#6ee7f711" : "transparent",
                border:     `1px solid ${mode === "1v1" ? "#6ee7f7" : "#222"}`,
                color:      mode === "1v1" ? "#6ee7f7" : "#444",
              }}
            >⚔ 1v1</button>
            <button
              onClick={() => setMode("deathmatch")}
              style={{
                flex: 1, padding: "12px 0", fontSize: 12, letterSpacing: 4,
                fontFamily: "'JetBrains Mono',monospace", cursor: "pointer", transition: "all 0.15s",
                background: mode === "deathmatch" ? "#ff6b6b11" : "transparent",
                border:     `1px solid ${mode === "deathmatch" ? "#ff6b6b" : "#222"}`,
                color:      mode === "deathmatch" ? "#ff6b6b" : "#444",
              }}
            >💀 DEATHMATCH</button>
          </div>
          <p style={{ color: "#fff", fontSize: 9, letterSpacing: 3, marginTop: 8, textAlign: "center", fontFamily: "'JetBrains Mono',monospace" }}>
            {mode === "1v1"
              ? "2 PLAYERS · 60s RACE · MOST WORDS WINS"
              : "2–5 PLAYERS · FIRST TO 50 WORDS WINS · ATTACKS HIT ALL"}
          </p>
        </div>

        {/* Create */}
        <button
          onClick={createRoom}
          disabled={!!loading}
          className="w-full border border-[#e8b84b] text-[#e8b84b] py-4 text-sm tracking-[5px] mb-3 hover:bg-[#e8b84b11] transition-all disabled:opacity-40"
          style={{ fontFamily: "'JetBrains Mono',monospace" }}
        >
          {loading === "create" ? "CREATING..." : "CREATE ROOM"}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 my-4">
          <div className="flex-1 h-px bg-[#1a1a1a]" />
          <span className="text-[#333] text-xs tracking-[4px]">OR</span>
          <div className="flex-1 h-px bg-[#1a1a1a]" />
        </div>

        {/* Join */}
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(""); }}
            placeholder="ROOM CODE"
            maxLength={6}
            className="flex-1 bg-transparent border border-[#222] px-4 py-3 text-[#e8e0c8] text-sm tracking-[6px] outline-none focus:border-[#6ee7f7] transition-colors text-center"
            style={{ fontFamily: "'JetBrains Mono',monospace" }}
          />
          <button
            onClick={joinRoom}
            disabled={!!loading}
            className="border border-[#6ee7f7] text-[#6ee7f7] px-6 text-sm tracking-[3px] hover:bg-[#6ee7f711] transition-all disabled:opacity-40"
            style={{ fontFamily: "'JetBrains Mono',monospace" }}
          >
            {loading === "join" ? "..." : "JOIN"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="text-[#ff6b6b] text-xs tracking-[3px] mt-4 text-center">{error}</p>
        )}

        {/* Attacks preview */}
        <div className="mt-10 border-t border-[#141414] pt-8">
          <p className="text-[#333] text-[9px] tracking-[5px] text-center mb-4">ATTACKS</p>
          <div className="grid grid-cols-3 gap-2">
            {ATTACKS.map((a) => (
              <div key={a.id} className="bg-[#111] border border-[#1a1a1a] p-3 text-center">
                <div className="text-xs tracking-wider text-[#e8e0c8] mb-1">{a.label}</div>
                <div className="text-[10px] text-[#e8b84b]">≥{a.wpm} wpm</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Info icon ── */}
      <button
        onClick={() => setShowInfo(true)}
        style={{
          position: "fixed", bottom: 24, right: 24,
          width: 36, height: 36, borderRadius: "50%",
          border: "1px solid #2a2a2a", background: "#111",
          color: "#444", fontSize: 15, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'JetBrains Mono',monospace", fontWeight: 700,
          transition: "border-color 0.15s, color 0.15s, box-shadow 0.15s",
          zIndex: 40,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#e8b84b"; e.currentTarget.style.color = "#e8b84b"; e.currentTarget.style.boxShadow = "0 0 12px #e8b84b22"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#444"; e.currentTarget.style.boxShadow = "none"; }}
        title="How to play"
      >
        ?
      </button>

      {/* ── Info modal — full screen ── */}
      {showInfo && (
        <div style={{
          position: "fixed", inset: 0, background: "#0e0e0e",
          zIndex: 50, overflowY: "auto",
          fontFamily: "'JetBrains Mono',monospace",
        }}>
          {/* Top bar */}
          <div style={{
            position: "sticky", top: 0, background: "#0e0e0e",
            borderBottom: "1px solid #1a1a1a", padding: "20px 32px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            zIndex: 10,
          }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 4, fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>
                <span style={{ color: "#e8e0c8" }}>HOW TO</span><span style={{ color: "#e8b84b" }}>PLAY</span>
              </div>
              <div style={{ fontSize: 10, letterSpacing: 5, color: "#ffffff", marginTop: 5 }}>TYPO TERROR — QUICK GUIDE</div>
            </div>
            <button onClick={() => setShowInfo(false)} style={{
              background: "transparent", border: "1px solid #2a2a2a",
              color: "#555", fontSize: 13, letterSpacing: 3,
              padding: "10px 20px", cursor: "pointer",
              fontFamily: "'JetBrains Mono',monospace",
              transition: "border-color 0.15s, color 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#e8b84b"; e.currentTarget.style.color = "#e8b84b"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#555"; }}
            >✕ CLOSE</button>
          </div>

          {/* Content */}
          <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 32px 80px" }}>

            {/* Objective */}
            <Section label="OBJECTIVE">
              <p style={{ fontSize: 16, color: "#888", lineHeight: 2, margin: 0 }}>
                Type the words displayed on screen as fast and accurately as you can.
                Press <Chip color="#6ee7f7">SPACE</Chip> after each word to confirm it.
                Only <span style={{ color: "#e8e0c8" }}>correctly typed</span> words count — typos are rejected and must be retyped.
              </p>
            </Section>

            {/* Modes */}
            <Section label="GAME MODES">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <ModeCard icon="⚔" title="1V1" color="#6ee7f7">
                  Race head-to-head against one opponent for <Chip color="#6ee7f7">60 seconds</Chip>.
                  The player who types the most correct words when time runs out wins.
                  Attacks target your opponent only.
                </ModeCard>
                <ModeCard icon="💀" title="DEATHMATCH" color="#ff6b6b">
                  2 to 5 players compete simultaneously. The <span style={{ color: "#e8e0c8" }}>first player</span> to reach <Chip color="#ff6b6b">50 words</Chip> wins instantly.
                  There is no timer — pure speed. Attacks hit every opponent at once.
                </ModeCard>
              </div>
            </Section>

            {/* Attacks */}
            <Section label="ATTACKS">
              <p style={{ fontSize: 15, color: "#666", lineHeight: 2, marginBottom: 24 }}>
                Every correct word charges your <Chip color="#e8b84b">⚡ attack bar</Chip>. Once it hits <Chip color="#e8b84b">100%</Chip>,
                press <Chip color="#e8b84b">TAB</Chip> to fire. Higher WPM unlocks more powerful attacks.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {ATTACKS.map(a => (
                  <div key={a.id} style={{ background: "#111", border: "1px solid #1e1e1e", padding: "18px 16px", borderTop: "2px solid #e8b84b33" }}>
                    <div style={{ fontSize: 15, color: "#e8e0c8", letterSpacing: 2, marginBottom: 6, fontWeight: 700 }}>{a.label}</div>
                    <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7, marginBottom: 10 }}>{a.desc}</div>
                    <div style={{ fontSize: 12, color: "#e8b84b", letterSpacing: 2 }}>≥ {a.wpm} WPM</div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Difficulty */}
            <Section label="DIFFICULTY VOTE" last>
              <p style={{ fontSize: 15, color: "#666", lineHeight: 2, marginBottom: 20 }}>
                Before each game, all players vote on the word difficulty.
                The <span style={{ color: "#e8e0c8" }}>majority wins</span> — ties are broken randomly.
                Harder words are longer and trickier to type at speed.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  ["EASY",   "#6bffb8", "Short, common words like the, and, run, big. Great for beginners."],
                  ["MEDIUM", "#e8b84b", "Everyday vocabulary like travel, garden, window. A balanced challenge."],
                  ["HARD",   "#ff6b6b", "Contractions like don't, they've plus tricky words like rhythm and queue."],
                ].map(([label, color, desc]) => (
                  <div key={label} style={{ border: `1px solid ${color}33`, background: `${color}07`, padding: "20px 16px" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color, letterSpacing: 3, marginBottom: 10 }}>{label}</div>
                    <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Tips */}
            <Section label="TIPS" last>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  ["⚡", "Charge attacks by typing accurately, not just fast — every word adds charge."],
                  ["❄", "If frozen, wait it out. You can't type through a freeze effect."],
                  ["👻", "GHOST hides your typed characters. Keep going — your input still registers."],
                  ["💣", "BOMB adds 10 words to your opponent. Fire it when they're close to winning."],
                ].map(([icon, tip]) => (
                  <div key={icon} style={{ display: "flex", gap: 14, alignItems: "flex-start", background: "#0d0d0d", border: "1px solid #181818", padding: "16px 14px" }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: 13, color: "#555", lineHeight: 1.7 }}>{tip}</span>
                  </div>
                ))}
              </div>
            </Section>

          </div>
        </div>
      )}
    </main>
  );
}
function Section({ label, children, last = false }) {
  return (
    <div style={{ marginBottom: last ? 0 : 56, paddingBottom: last ? 0 : 56, borderBottom: last ? "none" : "1px solid #141414" }}>
      <div style={{ fontSize: 10, letterSpacing: 6, color: "#333", marginBottom: 24, fontFamily: "'JetBrains Mono',monospace" }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace" }}>{children}</div>
    </div>
  );
}

function ModeCard({ icon, title, color, children }) {
  return (
    <div style={{ border: `1px solid ${color}22`, background: `${color}06`, padding: "24px 20px", borderTop: `3px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color, letterSpacing: 4, fontFamily: "'JetBrains Mono',monospace" }}>{title}</span>
      </div>
      <div style={{ fontSize: 13, color: "#555", lineHeight: 1.9, fontFamily: "'JetBrains Mono',monospace" }}>{children}</div>
    </div>
  );
}

function Chip({ color, children }) {
  return (
    <span style={{
      color, background: `${color}14`, border: `1px solid ${color}33`,
      padding: "2px 8px", fontSize: 11, letterSpacing: 1,
      fontFamily: "'JetBrains Mono',monospace",
      display: "inline-block", verticalAlign: "middle", margin: "0 3px",
    }}>
      {children}
    </span>
  );
}