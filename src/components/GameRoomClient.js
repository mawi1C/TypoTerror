"use client";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { ref, get, set, update } from "firebase/database";
import { PLAYER_KEYS, MAX_PLAYERS } from "@/lib/gameData";

const GameRoom = dynamic(() => import("@/components/GameRoom"), { ssr: false });

// ─── THEME (mirrors GameRoom.js) ─────────────────────────────────────────────
const T = {
  bg:       "#0e0e0e",
  bgCard:   "#111111",
  border:   "#1a1a1a",
  borderHi: "#2a2a2a",
  text:     "#e8e0c8",
  muted:    "#555555",
  dim:      "#333333",
  ghost:    "#1e1e1e",
  mono:     "'JetBrains Mono', monospace",
  syne:     "'Syne', sans-serif",
};

const glb = `
  @keyframes fade-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse-border { 0%,100%{box-shadow:0 0 0px #e8b84b00} 50%{box-shadow:0 0 12px #e8b84b33} }
`;

// ─── JOIN PROMPT ──────────────────────────────────────────────────────────────
function JoinPrompt({ code, onJoined }) {
  const router = useRouter();
  const [name, setName]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [roomInfo, setRoomInfo] = useState(null);
  const [checking, setChecking] = useState(true);

  // Pre-fetch room info so we can show mode / player count
  useEffect(() => {
    async function check() {
      const snap = await get(ref(db, `rooms/${code}`));
      if (!snap.exists()) {
        setError("Room not found. It may have been closed.");
        setChecking(false);
        return;
      }
      const room = snap.val();
      if (room.status !== "waiting") {
        setError("This game has already started.");
        setChecking(false);
        return;
      }
      setRoomInfo(room);
      setChecking(false);
    }
    check();
  }, [code]);

  async function handleJoin() {
    if (!name.trim()) { setError("Enter your name first"); return; }
    setLoading(true);
    setError("");

    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) { setError("Room not found"); setLoading(false); return; }
    const room = snap.val();
    if (room.status !== "waiting") { setError("This game has already started"); setLoading(false); return; }

    if (room.mode === "deathmatch") {
      const takenKeys = PLAYER_KEYS.filter(k => !!room[k]);
      if (takenKeys.length >= MAX_PLAYERS) { setError("Room is full (5/5)"); setLoading(false); return; }
      const nextKey = PLAYER_KEYS.find(k => !room[k]);
      await update(ref(db, `rooms/${code}/${nextKey}`), {
        name: name.trim(), typedCount: 0, chars: 0, wpm: 0, charge: 0, ready: false,
      });
      sessionStorage.setItem("tb_name", name.trim());
      sessionStorage.setItem("tb_role", nextKey);
    } else {
      if (room.guest) { setError("Room is full (1v1)"); setLoading(false); return; }
      await set(ref(db, `rooms/${code}/guest`), {
        name: name.trim(), typedCount: 0, chars: 0, wpm: 0, charge: 0, ready: false,
      });
      sessionStorage.setItem("tb_name", name.trim());
      sessionStorage.setItem("tb_role", "guest");
    }

    onJoined();
  }

  const modeLabel = roomInfo?.mode === "deathmatch" ? "💀 DEATHMATCH" : "⚔ 1V1";
  const modeColor = roomInfo?.mode === "deathmatch" ? "#ff6b6b" : "#6ee7f7";
  const playerCount = roomInfo
    ? PLAYER_KEYS.filter(k => !!roomInfo[k]).length
    : null;

  return (
    <main style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: T.bg,
      padding: "0 16px", fontFamily: T.mono,
    }}>
      <style>{glb}</style>

      <div style={{
        width: "100%", maxWidth: 400,
        animation: "fade-in .4s ease",
      }}>

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{
            fontSize: 32, fontWeight: 900, letterSpacing: "0.08em",
            fontFamily: T.syne, margin: 0, lineHeight: 1,
          }}>
            <span style={{ color: T.text }}>TYPO</span>
            <span style={{ color: "#ff6b6b" }}>TERROR</span>
          </h1>
          <p style={{ fontSize: 9, letterSpacing: 5, color: T.dim, marginTop: 8 }}>
            YOU'VE BEEN INVITED
          </p>
        </div>

        {/* Room info card */}
        <div style={{
          border: `1px solid ${T.border}`,
          background: T.bgCard,
          padding: "22px 24px",
          marginBottom: 20,
          textAlign: "center",
          animation: "pulse-border 2s ease-in-out infinite",
        }}>
          <p style={{ fontSize: 9, letterSpacing: 5, color: T.dim, marginBottom: 10 }}>
            ROOM CODE
          </p>
          <div style={{
            fontSize: 38, fontWeight: 900, color: "#e8b84b",
            fontFamily: T.syne, letterSpacing: 12, paddingLeft: 12,
            marginBottom: 14,
          }}>
            {code}
          </div>

          {checking ? (
            <p style={{ fontSize: 9, letterSpacing: 3, color: T.dim }}>checking room...</p>
          ) : roomInfo ? (
            <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
              <span style={{
                fontSize: 9, letterSpacing: 3, color: modeColor,
                border: `1px solid ${modeColor}33`,
                background: `${modeColor}0d`,
                padding: "3px 10px",
              }}>{modeLabel}</span>
              {roomInfo.mode === "deathmatch" && (
                <span style={{
                  fontSize: 9, letterSpacing: 3, color: T.muted,
                  border: `1px solid ${T.borderHi}`,
                  padding: "3px 10px",
                }}>
                  {playerCount}/{MAX_PLAYERS} PLAYERS
                </span>
              )}
            </div>
          ) : null}
        </div>

        {/* Error state (room not found / started) */}
        {error && !name && (
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <p style={{ color: "#ff6b6b", fontSize: 11, letterSpacing: 3, marginBottom: 20 }}>
              {error}
            </p>
            <button
              onClick={() => router.push("/")}
              style={{
                border: "1px solid #e8b84b", color: "#e8b84b",
                padding: "12px 32px", fontSize: 11, letterSpacing: 5,
                fontFamily: T.mono, background: "transparent", cursor: "pointer",
              }}
            >← BACK TO HOME</button>
          </div>
        )}

        {/* Join form */}
        {!checking && roomInfo && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{
                display: "block", fontSize: 9, letterSpacing: 4,
                color: T.dim, marginBottom: 8,
              }}>YOUR NAME</label>
              <input
                value={name}
                onChange={e => { setName(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleJoin()}
                placeholder="enter username..."
                maxLength={18}
                autoFocus
                style={{
                  width: "100%", background: "transparent",
                  border: `1px solid ${T.borderHi}`,
                  padding: "12px 16px",
                  color: T.text, fontSize: 13, letterSpacing: 4,
                  outline: "none", fontFamily: T.mono,
                  boxSizing: "border-box",
                  transition: "border-color .15s",
                }}
                onFocus={e => e.target.style.borderColor = "#e8b84b"}
                onBlur={e => e.target.style.borderColor = T.borderHi}
              />
            </div>

            {error && (
              <p style={{ color: "#ff6b6b", fontSize: 10, letterSpacing: 3, marginBottom: 10 }}>
                {error}
              </p>
            )}

            <button
              onClick={handleJoin}
              disabled={loading || !name.trim()}
              style={{
                width: "100%", border: "1px solid #e8b84b",
                color: "#e8b84b", padding: "14px 0",
                fontSize: 12, letterSpacing: 5,
                fontFamily: T.mono, background: "transparent",
                cursor: loading || !name.trim() ? "default" : "pointer",
                opacity: loading || !name.trim() ? 0.4 : 1,
                transition: "opacity .2s, background .15s",
              }}
              onMouseEnter={e => { if (!loading && name.trim()) e.currentTarget.style.background = "#e8b84b0d"; }}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {loading ? "JOINING..." : "JOIN ROOM →"}
            </button>

            <button
              onClick={() => router.push("/")}
              style={{
                marginTop: 10, width: "100%", background: "transparent",
                border: `1px solid ${T.border}`, color: T.muted,
                fontSize: 10, letterSpacing: 4, padding: "10px 0",
                fontFamily: T.mono, cursor: "pointer",
                transition: "border-color .15s, color .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.borderHi; }}
              onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border; }}
            >← BACK TO HOME</button>
          </>
        )}

      </div>
    </main>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export default function GameRoomClient({ code }) {
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const role = sessionStorage.getItem("tb_role");
    const name = sessionStorage.getItem("tb_name");
    if (role && name) {
      setReady(true);
    }
    setChecked(true);
  }, []);

  if (!checked) return null; // avoid flash

  if (!ready) {
    return <JoinPrompt code={code} onJoined={() => setReady(true)} />;
  }

  return <GameRoom code={code} />;
}