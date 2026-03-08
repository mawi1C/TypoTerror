"use client";
// src/components/GameRoom.js
import { useEffect, useRef, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, update, push, off, get, remove, onDisconnect } from "firebase/database";
import { calcWPM, getAttackForWPM, GAME_DURATION, WORD_QUOTA, PLAYER_KEYS, MAX_PLAYERS, resolveDifficulty, makeWordList } from "@/lib/gameData";
import { useRouter } from "next/navigation";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const SLOT_ACCENTS = {
  host:  "#6ee7f7",
  guest: "#ff6b6b",
  p2:    "#ff6b6b",
  p3:    "#e8b84b",
  p4:    "#b084f5",
  p5:    "#6bffb8",
};

const T = {
  bg:       "#0e0e0e",
  bgCard:   "#161616",   // was #111111 — too close to bg
  bgDeep:   "#0c0c0c",   // was #0a0a0a — kept near-black but slightly lifted
  border:   "#2e2e2e",   // was #1a1a1a — nearly invisible against bg
  borderMd: "#333333",   // was #222222 — bumped
  borderHi: "#3a3a3a",   // was #2a2a2a — bumped
  text:     "#e8e0c8",   // unchanged — good contrast
  muted:    "#888888",   // was #555555 — too dim for small text
  dim:      "#666666",   // was #333333 — nearly invisible at small sizes
  ghost:    "#2a2a2a",   // was #1e1e1e — bumped so ghost borders/text are visible
  mono:     "'JetBrains Mono', monospace",
  syne:     "'Syne', sans-serif",
};

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const glb = `
  @keyframes shake      { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }
  @keyframes countdown  { 0%{opacity:1;transform:scale(1.2)} 100%{opacity:0;transform:scale(0.8)} }
  @keyframes pulse-glow { 0%,100%{box-shadow:0 0 0px #ffdd4400} 50%{box-shadow:0 0 14px #ffdd4444} }
  @keyframes banner-in  { 0%{opacity:0;transform:translateX(-50%) translateY(-8px)} 100%{opacity:1;transform:translateX(-50%) translateY(0)} }
  @keyframes fade-in    { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes glow-pulse { 0%,100%{opacity:.55} 50%{opacity:1} }
  @keyframes winner-shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
`;

// ─── LANE ─────────────────────────────────────────────────────────────────────
function Lane({ label, accent, words = [], typedCount = 0, currentInput = "",
  wpm = 0, charge = 0, attackReady, onFireAttack,
  effects = {}, isPlayer, compact = false, quota = null }) {

  const visStart = Math.max(0, typedCount - 6);
  const visWords = words.slice(visStart, visStart + (compact ? 22 : 38));
  const isBlurred = !!effects.blur;
  const isShaking = !!effects.shake;
  const isGhost   = !!effects.ghost;
  const isFrozen  = !!effects.freeze;

  return (
    <div style={{
      width: "100%", display: "flex", flexDirection: "column", gap: compact ? 8 : 12,
      padding: compact ? "14px 18px" : "22px 26px",
      background: isPlayer ? T.bgCard : T.bgDeep,
      border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${isPlayer ? accent : T.ghost}`,
      boxShadow: isPlayer ? `inset 0 0 40px ${accent}06, 0 0 0 0 transparent` : "none",
      transition: "border-color .2s",
      animation: isShaking ? "shake .12s infinite" : "none",
    }}>

      {/* ── Header row ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, overflow: "hidden" }}>
          {isPlayer && (
            <span style={{
              fontSize: 8, letterSpacing: 3, color: accent,
              background: `${accent}18`, padding: "2px 7px",
              border: `1px solid ${accent}44`, flexShrink: 0,   // was 14/33 — more visible
              fontFamily: T.mono,
            }}>YOU</span>
          )}
          <span style={{
            color: isPlayer ? T.text : T.muted,   // muted is now #888, readable
            fontSize: compact ? 10 : 11, letterSpacing: 4, fontWeight: 700,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            fontFamily: T.mono,
          }}>{label}</span>

          {/* Active effects */}
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {isFrozen && <EffectTag color="#88ccff" icon="❄" label="FROZEN"  />}
            {isBlurred && <EffectTag color="#ffcc44" icon="👁" label="BLIND"  />}
            {isGhost   && <EffectTag color="#cc88ff" icon="👻" label="GHOST"  />}
            {isShaking && <EffectTag color="#ff8844" icon="💥" label="QUAKE"  />}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: compact ? 10 : 18, flexShrink: 0 }}>
          {/* Charge bar (player only, non-compact) */}
          {isPlayer && !compact && (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              {/* ⚡ label: was T.dim (#333) → now #777 */}
              <span style={{ fontSize: 8, color: "#777", letterSpacing: 2, fontFamily: T.mono }}>⚡</span>
              <div style={{ width: 72, height: 2, background: T.border, overflow: "hidden" }}>
                <div style={{
                  height: "100%", transition: "width .25s",
                  width: `${charge}%`,
                  background: charge >= 100
                    ? "linear-gradient(90deg,#ffaa00,#ffee44)"
                    : `linear-gradient(90deg,${accent}99,${accent})`,
                  boxShadow: charge >= 100 ? "0 0 8px #ffdd44" : `0 0 4px ${accent}55`,
                }}/>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, fontFamily: T.mono,
                /* charge % color: was T.dim (#333) when not ready → now #777 */
                color: charge >= 100 ? "#ffdd44" : "#777", minWidth: 30, textAlign: "right",
              }}>{Math.floor(charge)}%</span>
            </div>
          )}

          {/* WPM */}
          <div style={{ textAlign: "right" }}>
            <span style={{
              fontSize: compact ? 18 : 30, fontWeight: 900,
              fontFamily: T.syne, lineHeight: 1, color: accent,
            }}>{wpm}</span>
            {/* wpm label: was T.dim (#333) → #777 */}
            <span style={{ fontSize: 8, color: "#777", marginLeft: 2, fontFamily: T.mono }}>wpm</span>
          </div>
        </div>
      </div>

      {/* ── Progress bar ── */}
      {quota ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            {/* PROGRESS label: was T.ghost (#1e1e1e) → #555 */}
            <span style={{ fontSize: 8, letterSpacing: 4, color: "#555", fontFamily: T.mono }}>PROGRESS</span>
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: T.mono, color: typedCount >= quota ? "#ffdd44" : accent }}>
              {/* /quota: was T.dim (#333) → #666 */}
              {typedCount}<span style={{ color: "#666" }}>/{quota}</span>
            </span>
          </div>
          <div style={{ height: compact ? 2 : 3, background: T.border, overflow: "hidden" }}>
            <div style={{
              height: "100%", transition: "width .3s",
              width: `${Math.min(100, (typedCount / quota) * 100)}%`,
              background: typedCount >= quota
                ? "linear-gradient(90deg,#ffaa00,#ffee44)"
                : `linear-gradient(90deg,${accent}66,${accent})`,
              boxShadow: `0 0 8px ${accent}55`,
            }}/>
          </div>
        </div>
      ) : (
        <div style={{ height: 2, background: T.border, overflow: "hidden" }}>
          <div style={{
            height: "100%", transition: "width .3s",
            width: `${Math.min(100, (typedCount / Math.max(1, words.length)) * 100)}%`,
            background: `linear-gradient(90deg,${accent}55,${accent})`,
          }}/>
        </div>
      )}

      {/* ── Word display ── */}
      <div style={{
        height: compact ? 52 : 112,
        overflow: "hidden",
        lineHeight: compact ? "1.9rem" : "2.6rem",
        fontSize: compact ? 13 : 19,
        wordBreak: "keep-all", overflowWrap: "normal", whiteSpace: "normal",
        filter: isBlurred ? "blur(7px)" : "none",
        opacity: isFrozen ? 0.25 : 1,
        transition: "filter .15s, opacity .15s",
        cursor: "text", userSelect: "none",
        fontFamily: T.mono,
      }}>
        {visWords.map((word, i) => {
          const absIdx = visStart + i;
          const isDone   = absIdx < typedCount;
          const isActive = absIdx === typedCount;
          let content;

          if (isActive && isPlayer && !isGhost) {
            const chars = word.split("").map((ch, ci) => {
              const t = currentInput[ci];
              const color = t === undefined ? T.muted : t === ch ? "#ffffff" : "#ff4455";
              return <span key={ci} style={{ color }}>{ch}</span>;
            });
            for (let ci = word.length; ci < currentInput.length; ci++) {
              chars.push(
                <span key={`x${ci}`} style={{ color: "#ff5566", textDecoration: "underline" }}>
                  {currentInput[ci]}
                </span>
              );
            }
            content = chars;
          } else if (isDone) {
            /* completed words: compact was #2e5c3e (too dark) → #3d7a52; full was #4aaa66 (good) */
            content = <span style={{ color: compact ? "#3d7a52" : "#4aaa66" }}>{word}</span>;
          } else {
            /* pending words: compact was #252525 (unreadable) → #444; full was #3a3a3a → #4a4a4a */
            content = <span style={{ color: compact ? "#444444" : "#4a4a4a" }}>{word}</span>;
          }

          return (
            <span key={absIdx} style={{
              marginRight: "0.7em", display: "inline-block",
              borderBottom: isActive ? `2px solid ${accent}` : "2px solid transparent",
              paddingBottom: 1,
            }}>
              {content}
            </span>
          );
        })}
      </div>

      {/* ── Attack button (player, full size only) ── */}
      {isPlayer && !compact && (
        <button
          onClick={onFireAttack}
          disabled={!attackReady}
          style={{
            width: "100%", padding: "11px 0",
            background: attackReady ? `${attackReady ? "#ffdd4408" : "transparent"}` : "transparent",
            /* inactive border/text: was T.ghost (#1e1e1e) → #3a3a3a so it's visible */
            border: `1px solid ${attackReady ? "#ffdd44" : "#3a3a3a"}`,
            color: attackReady ? "#ffdd44" : "#555",
            fontSize: 11, letterSpacing: 5,
            fontFamily: T.mono, fontWeight: 700,
            cursor: attackReady ? "pointer" : "default",
            animation: attackReady ? "pulse-glow .9s ease-in-out infinite" : "none",
            transition: "border-color .2s, color .2s, background .2s",
          }}
        >
          {attackReady
            ? `▶  ${attackReady.label}   [TAB]`
            : "▶  CHARGING..."}
        </button>
      )}
    </div>
  );
}

function EffectTag({ color, icon, label }) {
  return (
    <span style={{
      fontSize: 7, letterSpacing: 2, color,
      background: `${color}18`, border: `1px solid ${color}44`,  // was 12/33
      padding: "1px 5px", fontFamily: T.mono,
    }}>{icon} {label}</span>
  );
}

// ─── VOTE PANEL ───────────────────────────────────────────────────────────────
function VotePanel({ votes = {}, myVote, onVote, presentKeys = [], locked = false }) {
  const DIFFS = [
    { id: "easy",   label: "EASY",   color: "#6bffb8", desc: "common short words"       },
    { id: "medium", label: "MEDIUM", color: "#e8b84b", desc: "everyday vocabulary"      },
    { id: "hard",   label: "HARD",   color: "#ff6b6b", desc: "contractions & tricky"    },
  ];
  const tally = { easy: 0, medium: 0, hard: 0 };
  // Only tally votes from players still in the room (presentKeys)
  presentKeys.forEach(k => {
    const v = votes[k];
    if (v && tally[v] !== undefined) tally[v]++;
  });

  return (
    <div style={{ marginBottom: 16, animation: "fade-in .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ fontSize: 9, letterSpacing: 5, color: T.dim, margin: 0, fontFamily: T.mono }}>
          VOTE · WORD DIFFICULTY
        </p>
        {locked && (
          <span style={{ fontSize: 8, letterSpacing: 3, color: "#4aaa5a", fontFamily: T.mono }}>✓ LOCKED IN</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {DIFFS.map(d => {
          const active = myVote === d.id;
          const count  = tally[d.id];
          return (
            <button key={d.id}
              onClick={() => !locked && onVote(d.id)}
              disabled={locked}
              style={{
                flex: 1, padding: "12px 8px",
                cursor: locked ? "default" : "pointer",
                background: active ? `${d.color}14` : "transparent",
                border: `1px solid ${active ? d.color : "#2e2e2e"}`,
                color: active ? d.color : "#666",
                opacity: locked && !active ? 0.35 : 1,
                fontFamily: T.mono, transition: "all .15s",
              }}>
              <div style={{ fontSize: 10, letterSpacing: 3, fontWeight: 700, marginBottom: 3 }}>{d.label}</div>
              <div style={{ fontSize: 8, color: active ? d.color : "#555", marginBottom: 6 }}>{d.desc}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: count > 0 ? d.color : "#444" }}>
                {count > 0 ? `${count}v` : "—"}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        {presentKeys.map(k => {
          const v = votes[k];
          const color = { easy: "#6bffb8", medium: "#e8b84b", hard: "#ff6b6b" }[v] || "#444";
          return (
            <span key={k} style={{ fontSize: 8, letterSpacing: 2, color: v ? color : "#444", fontFamily: T.mono }}>
              {k === "host" ? "HOST" : k.toUpperCase()} {v ? `→ ${v.toUpperCase()}` : "· —"}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── DIVIDER ─────────────────────────────────────────────────────────────────
function Divider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0" }}>
      <div style={{ flex: 1, height: 1, background: T.border }}/>
      {/* label: was T.dim (#333) → #666 */}
      {label && <span style={{ fontSize: 9, letterSpacing: 4, color: T.dim, fontFamily: T.mono }}>{label}</span>}
      <div style={{ flex: 1, height: 1, background: T.border }}/>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function GameRoom({ code }) {
  const router = useRouter();
  const [role, setRole]           = useState(null);
  const [myName, setMyName]       = useState("");
  const [room, setRoom]           = useState(null);
  const [input, setInput]         = useState("");
  const [typedCount, setTyped]    = useState(0);
  const [wpm, setWpm]             = useState(0);
  const [charge, setCharge]       = useState(0);
  const [attackReady, setAtkReady]= useState(null);
  const [myEffects, setMyEffects] = useState({});
  const [timeLeft, setTimeLeft]   = useState(GAME_DURATION);
  const [countdown, setCountdown] = useState(null);
  const [banner, setBanner]       = useState(null);
  const [gamePhase, setPhase]     = useState("lobby");
  const [mounted, setMounted]     = useState(false);
  const [myVote, setMyVote]       = useState(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showStartConfirm, setShowStartConfirm] = useState(false);

  const inputRef      = useRef(null);
  const startTime     = useRef(null);
  const timerRef      = useRef(null);
  const typedRef      = useRef(0);
  const charsRef      = useRef(0);
  const chargeRef     = useRef(0);
  const gameActive    = useRef(false);
  const effectsRef    = useRef({});
  const phaseRef      = useRef("lobby");
  const fireAttackRef = useRef(null);

  const isDeathMatch = room?.mode === "deathmatch";
  const myKey    = role || "host";
  const oppKey   = role === "host" ? "guest" : "host";
  const words    = room?.words || [];
  const myAccent = SLOT_ACCENTS[myKey] || "#6ee7f7";

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const r = sessionStorage.getItem("tb_role");
    const n = sessionStorage.getItem("tb_name");
    if (!r || !n) { router.push("/"); return; }
    setRole(r); setMyName(n);
  }, [mounted]);

  useEffect(() => {
    if (!role) return;

    // ── Presence: auto-remove this player's slot if they close the tab/browser ──
    if (role !== "host") {
      const playerRef = ref(db, `rooms/${code}/${role}`);
      const voteRef   = ref(db, `rooms/${code}/votes/${role}`);
      onDisconnect(playerRef).remove();
      onDisconnect(voteRef).remove();
    } else {
      // Host disconnect closes the room for everyone
      const statusRef = ref(db, `rooms/${code}/status`);
      onDisconnect(statusRef).set("closed");
    }

    const roomRef = ref(db, `rooms/${code}`);
    onValue(roomRef, snap => {
      if (!snap.exists()) { router.push("/"); return; }
      const data = snap.val();
      setRoom(data);
      if (data.status === "closed" && phaseRef.current !== "closed") {
        const r = sessionStorage.getItem("tb_role");
        if (r !== "host") { phaseRef.current = "closed"; setPhase("closed"); }
      }
      if (data.status === "countdown" && phaseRef.current === "lobby") {
        phaseRef.current = "countdown"; startCountdown();
      }
      if (data.status === "playing" && phaseRef.current !== "playing" && phaseRef.current !== "finished") {
        phaseRef.current = "playing"; beginGame(data.mode);
      }
      if (data.status === "finished" && phaseRef.current !== "finished") {
        phaseRef.current = "finished"; endGame();
      }
      // Host triggered play again — non-host players reset to lobby
      if (data.status === "waiting" && phaseRef.current === "finished") {
        phaseRef.current = "lobby";
        setPhase("lobby");
        setTyped(0); setWpm(0); setCharge(0); setAtkReady(null);
        setMyEffects({}); setInput(""); setMyVote(null);
      }      if (data.attacks) {
        Object.entries(data.attacks).forEach(([key, a]) => {
          const amTarget = data.mode === "deathmatch"
            ? (a.target === "all" && a.from !== role)
            : (a.target === role);
          if (amTarget && Date.now() - a.ts < 2500 && !a[`proc_${role}`]) {
            applyAttack(a);
            update(ref(db, `rooms/${code}/attacks/${key}`), { [`proc_${role}`]: true });
          }
        });
      }
    });
    return () => {
      off(ref(db, `rooms/${code}`));
      // Cancel scheduled onDisconnect ops when component unmounts cleanly
      if (role !== "host") {
        onDisconnect(ref(db, `rooms/${code}/${role}`)).cancel();
        onDisconnect(ref(db, `rooms/${code}/votes/${role}`)).cancel();
      } else {
        onDisconnect(ref(db, `rooms/${code}/status`)).cancel();
      }
    };
  }, [role]);

  const startCountdown = () => {
    setPhase("countdown");
    let c = 3; setCountdown(c);
    const iv = setInterval(() => { c--; if (c <= 0) { clearInterval(iv); setCountdown(null); } else setCountdown(c); }, 1000);
  };

  const beginGame = useCallback((gameMode) => {
    setPhase("playing"); gameActive.current = true; startTime.current = Date.now();
    setTimeLeft(GAME_DURATION); setInput(""); setTyped(0); setWpm(0); setCharge(0); setAtkReady(null);
    typedRef.current = 0; charsRef.current = 0; chargeRef.current = 0;
    clearInterval(timerRef.current);
    if (gameMode !== "deathmatch") {
      let t = GAME_DURATION;
      timerRef.current = setInterval(async () => {
        t--; setTimeLeft(t);
        if (t <= 0) {
          clearInterval(timerRef.current); gameActive.current = false;
          if (sessionStorage.getItem("tb_role") === "host")
            await update(ref(db, `rooms/${code}`), { status: "finished" });
        }
      }, 1000);
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [code]);

  const endGame = () => { setPhase("finished"); gameActive.current = false; clearInterval(timerRef.current); };
  useEffect(() => () => clearInterval(timerRef.current), []);

  const handleVote = async (diff) => {
    const r = sessionStorage.getItem("tb_role");
    setMyVote(diff);
    await update(ref(db, `rooms/${code}/votes`), { [r]: diff });
  };

  const handleReady = async () => {
    if (!myVote) return;
    const r = sessionStorage.getItem("tb_role");
    await update(ref(db, `rooms/${code}/${r}`), { ready: true });
    const snap = await get(ref(db, `rooms/${code}`));
    const d = snap.val();
    // Only count votes from players still present in the room
    const presentKeys = d.mode === "deathmatch"
      ? PLAYER_KEYS.filter(k => !!d[k])
      : ["host", "guest"].filter(k => !!d[k]);
    const allVotes = d.votes || {};
    const presentVotes = Object.fromEntries(
      Object.entries(allVotes).filter(([k]) => presentKeys.includes(k))
    );
    const difficulty = resolveDifficulty(presentVotes);
    const newWords = makeWordList(120, difficulty);
    if (d.mode === "deathmatch") {
      // deathmatch: just mark ready — host manually starts via handleStart
    } else {
      if (d.host?.ready && d.guest?.ready) {
        await update(ref(db, `rooms/${code}`), { status: "countdown", difficulty, words: newWords });
        setTimeout(() => update(ref(db, `rooms/${code}`), { status: "playing" }), 3200);
      }
    }
  };

  const handleStart = async () => {
    const snap = await get(ref(db, `rooms/${code}`));
    const d = snap.val();
    // Only count votes from players still present in the room
    const presentKeys = PLAYER_KEYS.filter(k => !!d[k]);
    const allVotes = d.votes || {};
    const presentVotes = Object.fromEntries(
      Object.entries(allVotes).filter(([k]) => presentKeys.includes(k))
    );
    const difficulty = resolveDifficulty(presentVotes);
    const newWords = makeWordList(120, difficulty);
    await update(ref(db, `rooms/${code}`), { status: "countdown", difficulty, words: newWords });
    setTimeout(() => update(ref(db, `rooms/${code}`), { status: "playing" }), 3200);
  };

  const handleLeave = async () => {
    const r = sessionStorage.getItem("tb_role");
    if (r === "host") {
      await update(ref(db, `rooms/${code}`), { status: "closed" });
      setTimeout(() => remove(ref(db, `rooms/${code}`)), 8000);
    } else {
      // Clear this player's vote before removing them
      await update(ref(db, `rooms/${code}/votes`), { [r]: null });
      await remove(ref(db, `rooms/${code}/${r}`));
    }
    sessionStorage.removeItem("tb_name");
    sessionStorage.removeItem("tb_role");
    router.push("/");
  };

  const handlePlayAgain = async () => {
    const r = sessionStorage.getItem("tb_role");
    if (isDeathMatch) {
      // Deathmatch: immediate reset (existing behaviour)
      await update(ref(db, `rooms/${code}/${r}`), {
        typedCount: 0, chars: 0, wpm: 0, charge: 0, ready: false,
      });
      await update(ref(db, `rooms/${code}/votes`), { [r]: null });
      if (r === "host") {
        await update(ref(db, `rooms/${code}`), {
          status: "waiting", winner: null, attacks: null, difficulty: null,
        });
      }
      setTyped(0); setWpm(0); setCharge(0); setAtkReady(null);
      setMyEffects({}); setInput(""); setMyVote(null);
      phaseRef.current = "lobby"; setPhase("lobby");
    } else {
      // 1v1: send a play-again request; other player must accept
      await update(ref(db, `rooms/${code}`), { playAgainRequest: r });
    }
  };

  const handleAcceptPlayAgain = async () => {
    // Both players agree — reset everything and go back to lobby
    const snap = await get(ref(db, `rooms/${code}`));
    const d = snap.val();
    const updates = {};
    ["host", "guest"].forEach(k => {
      if (d[k]) {
        updates[`${k}/typedCount`] = 0;
        updates[`${k}/chars`]      = 0;
        updates[`${k}/wpm`]        = 0;
        updates[`${k}/charge`]     = 0;
        updates[`${k}/ready`]      = false;
      }
    });
    updates["votes/host"]    = null;
    updates["votes/guest"]   = null;
    updates["status"]        = "waiting";
    updates["winner"]        = null;
    updates["attacks"]       = null;
    updates["difficulty"]    = null;
    updates["playAgainRequest"] = null;
    await update(ref(db, `rooms/${code}`), updates);
    setTyped(0); setWpm(0); setCharge(0); setAtkReady(null);
    setMyEffects({}); setInput(""); setMyVote(null);
    phaseRef.current = "lobby"; setPhase("lobby");
  };

  const handleDeclinePlayAgain = async () => {
    await update(ref(db, `rooms/${code}`), { playAgainRequest: null });
  };

  const applyAttack = (atk) => {
    showBanner(atk.label, "incoming");
    if (atk.id === "reverse") {
      const newT = Math.max(0, typedRef.current - 5);
      typedRef.current = newT; setTyped(newT); setInput("");
    } else {
      effectsRef.current = { ...effectsRef.current, [atk.id]: true };
      setMyEffects(e => ({ ...e, [atk.id]: true }));
      if (atk.dur) setTimeout(() => {
        delete effectsRef.current[atk.id];
        setMyEffects(e => { const n = { ...e }; delete n[atk.id]; return n; });
      }, atk.dur);
    }
  };

  const fireAttack = async () => {
    if (!attackReady || !gameActive.current) return;
    const atk = attackReady;
    chargeRef.current = 0; setCharge(0); setAtkReady(null);
    showBanner(atk.label, "outgoing");
    const target = isDeathMatch ? "all" : oppKey;
    await push(ref(db, `rooms/${code}/attacks`), {
      id: `${Date.now()}`, target, from: myKey, ...atk, ts: Date.now(),
    });
  };

  fireAttackRef.current = fireAttack;

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Tab") { e.preventDefault(); fireAttackRef.current?.(); }
  }, []);

  const handleInput = useCallback((e) => {
    if (!gameActive.current || effectsRef.current.freeze) return;
    const val = e.target.value;
    const currentWord = words[typedRef.current] || "";
    setInput(val);
    if (val.endsWith(" ")) {
      const typed = val.trim();
      if (typed === currentWord) {
        const newTyped = typedRef.current + 1;
        const newChars = charsRef.current + typed.length + 1;
        typedRef.current = newTyped; charsRef.current = newChars;
        setTyped(newTyped); setInput("");
        const w = calcWPM(newChars, startTime.current); setWpm(w);
        const newCharge = Math.min(100, chargeRef.current + 9 + Math.floor(w / 18));
        chargeRef.current = newCharge; setCharge(newCharge);
        if (newCharge >= 100) { const atk = getAttackForWPM(w); if (atk) setAtkReady(atk); }
        update(ref(db, `rooms/${code}/${myKey}`), { typedCount: newTyped, chars: newChars, wpm: w, charge: newCharge });
        if (newTyped >= WORD_QUOTA) {
          get(ref(db, `rooms/${code}/mode`)).then(s => {
            if (s.val() === "deathmatch") {
              gameActive.current = false;
              update(ref(db, `rooms/${code}`), { status: "finished", winner: myKey });
            }
          });
        }
      } else { setInput(""); }
    }
  }, [words, myKey, code]);

  const showBanner = (label, dir) => { setBanner({ label, dir }); setTimeout(() => setBanner(null), 1500); };

  // ─── ROOM CLOSED ─────────────────────────────────────────────────────────────
  if (gamePhase === "closed") {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, padding: "0 16px", fontFamily: T.mono }}>
        <style>{glb}</style>
        <div style={{ textAlign: "center", maxWidth: 360, width: "100%", animation: "fade-in .4s ease" }}>
          {/* label: was T.dim (#333) → #666 */}
          <div style={{ fontSize: 9, letterSpacing: 6, color: T.dim, marginBottom: 24 }}>TYPO TERROR</div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 4, fontFamily: T.syne, color: "#ff6b6b", marginBottom: 8 }}>
            ROOM CLOSED
          </div>
          <div style={{ width: 40, height: 1, background: "#ff6b6b44", margin: "0 auto 24px" }}/>  {/* was 33 */}
          <p style={{ color: T.muted, fontSize: 11, letterSpacing: 2, lineHeight: 2, marginBottom: 36 }}>
            The host has closed this room.
          </p>
          <button onClick={() => { sessionStorage.removeItem("tb_name"); sessionStorage.removeItem("tb_role"); router.push("/"); }}
            style={{
              width: "100%", border: "1px solid #e8b84b", color: "#e8b84b",
              padding: "14px 0", fontSize: 11, letterSpacing: 5,
              fontFamily: T.mono, background: "transparent", cursor: "pointer",
              transition: "background .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#e8b84b0d"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >← BACK TO HOME</button>
        </div>
      </main>
    );
  }

  // ─── LOBBY ───────────────────────────────────────────────────────────────────
  if (gamePhase === "lobby") {
    const me     = room?.[myKey];
    const isHost = myKey === "host";

    const LeaveModal = ({ accentColor }) => showLeaveConfirm ? (
      <div style={{
        position: "fixed", inset: 0, background: "#0e0e0ef0",
        zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px",
      }}>
        <div style={{
          width: "100%", maxWidth: 340,
          border: `1px solid ${T.borderHi}`,  // was #2a2a2a → #3a3a3a
          background: T.bgCard, padding: 32, textAlign: "center", animation: "fade-in .2s ease"
        }}>
          {/* label: was T.dim (#333) → #666 */}
          <div style={{ fontSize: 9, letterSpacing: 6, color: T.dim, marginBottom: 12, fontFamily: T.mono }}>CONFIRM</div>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 3, fontFamily: T.syne, color: accentColor, marginBottom: 20 }}>
            LEAVE ROOM?
          </div>
          <p style={{ color: T.muted, fontSize: 10, letterSpacing: 2, lineHeight: 2, marginBottom: 28, fontFamily: T.mono }}>
            {isHost
              ? "You are the HOST. Leaving will close the room and disconnect all players."
              : "You will be removed. Other players will remain."}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowLeaveConfirm(false)} style={{
              flex: 1, padding: "12px 0", background: "transparent",
              border: `1px solid ${T.borderHi}`, color: T.muted,  // borderHi now #3a3a3a, muted now #888
              fontSize: 10, letterSpacing: 4, fontFamily: T.mono, cursor: "pointer",
            }}>CANCEL</button>
            <button onClick={handleLeave} style={{
              flex: 1, padding: "12px 0", background: "transparent",
              border: `1px solid ${accentColor}`, color: accentColor,
              fontSize: 10, letterSpacing: 4, fontFamily: T.mono, cursor: "pointer",
            }}>LEAVE</button>
          </div>
        </div>
      </div>
    ) : null;

    // ── DEATHMATCH LOBBY ──
    if (isDeathMatch) {
      const presentPlayers = PLAYER_KEYS.filter(k => !!room?.[k]);
      // Host doesn't need to ready — only non-host players do
      const nonHostPlayers = presentPlayers.filter(k => k !== "host");
      const allReady = presentPlayers.length >= 2 && nonHostPlayers.every(k => !!room?.[k]?.ready);
      const readyCount = nonHostPlayers.filter(k => !!room?.[k]?.ready).length;
      const hasEmptySlots = presentPlayers.length < MAX_PLAYERS;
      const canStart = allReady && presentPlayers.length >= 2;

      const StartModal = () => showStartConfirm ? (
        <div style={{
          position: "fixed", inset: 0, background: "#0e0e0ef0",
          zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px",
        }}>
          <div style={{
            width: "100%", maxWidth: 360,
            border: `1px solid #e8b84b55`,
            background: T.bgCard, padding: 32, textAlign: "center",
            animation: "fade-in .2s ease", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, #e8b84b55, transparent)" }} />
            <div style={{ fontSize: 9, letterSpacing: 6, color: T.dim, marginBottom: 12, fontFamily: T.mono }}>CONFIRM</div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 3, fontFamily: T.syne, color: "#e8b84b", marginBottom: 8 }}>
              START GAME?
            </div>
            <p style={{ color: "#e8b84b", fontSize: 10, letterSpacing: 3, marginBottom: 4, fontFamily: T.mono }}>
              {presentPlayers.length}/5 PLAYERS · {MAX_PLAYERS - presentPlayers.length} SLOT{MAX_PLAYERS - presentPlayers.length > 1 ? "S" : ""} EMPTY
            </p>
            <p style={{ color: T.muted, fontSize: 9, letterSpacing: 2, lineHeight: 2, marginBottom: 28, fontFamily: T.mono }}>
              Empty slots won't be fillable once the game starts. Start anyway?
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowStartConfirm(false)}
                style={{
                  flex: 1, padding: "12px 0", background: "transparent",
                  border: `1px solid ${T.borderHi}`, color: T.muted,
                  fontSize: 10, letterSpacing: 4, fontFamily: T.mono, cursor: "pointer",
                  transition: "all .15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.muted; e.currentTarget.style.color = T.text; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.color = T.muted; }}
              >CANCEL</button>
              <button
                onClick={() => { setShowStartConfirm(false); handleStart(); }}
                style={{
                  flex: 1, padding: "12px 0", background: "#e8b84b0d",
                  border: `1px solid #e8b84b`, color: "#e8b84b",
                  fontSize: 10, letterSpacing: 4, fontFamily: T.mono, cursor: "pointer",
                  transition: "all .15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#e8b84b1a"}
                onMouseLeave={e => e.currentTarget.style.background = "#e8b84b0d"}
              >START ANYWAY</button>
            </div>
          </div>
        </div>
      ) : null;

      return (
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px", background: T.bg }}>
          <style>{glb}</style>
          <LeaveModal accentColor="#ff6b6b" />
          <StartModal />
          <div style={{ width: "100%", maxWidth: 640, animation: "fade-in .35s ease" }}>

            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "0.08em", fontFamily: T.syne, margin: 0, lineHeight: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
                <span style={{ color: T.text }}>TYPO</span>
                <span style={{ color: "#ff6b6b" }}>TERROR</span>
              </h1>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
                <span style={{ width: 20, height: 1, background: "#ff6b6b44" }}/>
                <span style={{ fontSize: 9, letterSpacing: 5, color: "#ff6b6b", fontFamily: T.mono }}>💀 DEATHMATCH</span>
                <span style={{ width: 20, height: 1, background: "#ff6b6b44" }}/>
              </div>
            </div>

            {/* Room code */}
            <div style={{ border: `1px solid ${T.border}`, background: T.bgCard, padding: "20px 24px", marginBottom: 12, textAlign: "center" }}>
              <p style={{ fontSize: 9, letterSpacing: 5, color: T.text, marginBottom: 10, fontFamily: T.mono }}>ROOM CODE</p>
              <div style={{ fontSize: 34, fontWeight: 900, color: "#e8b84b", fontFamily: T.syne }}>
                <span style={{ letterSpacing: 12, paddingLeft: 12 }}>{code}</span>
              </div>
              <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/room/${code}`)}
                style={{ marginTop: 8, fontSize: 9, letterSpacing: 3, color: T.text, background: "none", border: "none", cursor: "pointer", fontFamily: T.mono }}>
                copy invite link →
              </button>
            </div>

            <p style={{ fontSize: 8, letterSpacing: 4, color: "#555", textAlign: "center", marginBottom: 16, fontFamily: T.mono }}>
              FIRST TO {WORD_QUOTA} WORDS WINS · ATTACKS HIT ALL
            </p>

            {/* Player slots */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16 }}>
              {PLAYER_KEYS.map(k => {
                const p  = room?.[k];
                const ac = SLOT_ACCENTS[k];
                const isMe = k === myKey;
                const isHostSlot = k === "host";
                return (
                  <div key={k} style={{
                    border: `1px solid ${p ? T.border : T.ghost}`,
                    background: isMe ? "#141414" : T.bgDeep,
                    padding: "10px 14px",
                    borderLeft: `2px solid ${p ? ac : T.ghost}`,
                    transition: "border-color .2s",
                  }}>
                    <div style={{ fontSize: 8, letterSpacing: 3, color: ac, marginBottom: 4, fontFamily: T.mono }}>
                      {isHostSlot ? "HOST" : `SLOT ${PLAYER_KEYS.indexOf(k) + 1}`}{isMe ? " · YOU" : ""}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: p ? T.text : "#555", fontFamily: T.syne, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p ? p.name : "empty"}
                    </div>
                    {/* Host shows "HOST" badge instead of ready; others show ready tick */}
                    {p && (isHostSlot
                      ? <div style={{ fontSize: 8, letterSpacing: 3, color: "#e8b84b88", marginTop: 4, fontFamily: T.mono }}>CONTROLS START</div>
                      : p.ready
                        ? <div style={{ fontSize: 8, letterSpacing: 3, color: "#4aaa5a", marginTop: 4, fontFamily: T.mono }}>✓ READY</div>
                        : <div style={{ fontSize: 8, letterSpacing: 3, color: "#555", marginTop: 4, fontFamily: T.mono }}>not ready</div>
                    )}
                  </div>
                );
              })}
            </div>

            {presentPlayers.length >= 2 && (
              <VotePanel votes={room?.votes || {}} myVote={myVote} onVote={handleVote} presentKeys={presentPlayers} locked={!!me?.ready} />
            )}

            {/* READY UP — guests only */}
            {!isHost && (
              <button onClick={handleReady}
                disabled={presentPlayers.length < 2 || !myVote || me?.ready}
                style={{
                  width: "100%", border: `1px solid ${me?.ready ? "#4aaa5a" : "#ff6b6b"}`,
                  color: me?.ready ? "#4aaa5a" : "#ff6b6b", padding: "14px 0",
                  fontSize: 12, letterSpacing: 5, fontFamily: T.mono,
                  background: me?.ready ? "#4aaa5a0a" : "transparent", cursor: "pointer",
                  opacity: (presentPlayers.length < 2 || !myVote || me?.ready) ? 0.35 : 1,
                  transition: "all .2s", marginBottom: 8,
                }}>
                {me?.ready ? "✓ READY" : !myVote ? "VOTE TO UNLOCK" : "READY UP"}
              </button>
            )}

            {/* Single status line */}
            <p style={{
              color: allReady ? (isHost ? "#4aaa5a" : "#e8b84b") : T.muted,
              fontSize: 10, letterSpacing: 3, marginBottom: 10,
              textAlign: "center", fontFamily: T.mono, transition: "color .3s",
            }}>
              {presentPlayers.length < 2
                ? `WAITING FOR PLAYERS · ${presentPlayers.length}/5`
                : allReady
                  ? isHost ? "ALL PLAYERS READY" : "ALL READY · WAITING FOR HOST"
                  : `${readyCount}/${nonHostPlayers.length} READY`}
            </p>

            {/* HOST START BUTTON */}
            {isHost && (
              <button
                onClick={() => (canStart && hasEmptySlots) ? setShowStartConfirm(true) : handleStart()}
                disabled={!canStart}
                style={{
                  width: "100%", padding: "16px 0", marginBottom: 4,
                  fontSize: 13, letterSpacing: 6, fontFamily: T.mono, fontWeight: 700,
                  cursor: canStart ? "pointer" : "default",
                  opacity: canStart ? 1 : 0.25,
                  border: `1px solid ${canStart ? "#e8b84b" : T.border}`,
                  color: canStart ? "#e8b84b" : T.muted,
                  background: canStart ? "#e8b84b0d" : "transparent",
                  transition: "all .2s",
                  animation: canStart ? "pulse-glow .9s ease-in-out infinite" : "none",
                }}
                onMouseEnter={e => { if (canStart) e.currentTarget.style.background = "#e8b84b1a"; }}
                onMouseLeave={e => { if (canStart) e.currentTarget.style.background = canStart ? "#e8b84b0d" : "transparent"; }}
              >
                {!canStart
                  ? "▶  WAITING FOR PLAYERS"
                  : hasEmptySlots
                    ? `▶  START GAME  (${presentPlayers.length}/5)`
                    : "▶  START GAME"}
              </button>
            )}

            {/* Guest: all ready — status line above already shows this */}

            <button onClick={() => setShowLeaveConfirm(true)} style={{
              marginTop: 16, width: "100%", background: "transparent",
              border: `1px solid ${T.border}`, color: T.muted,
              fontSize: 10, letterSpacing: 4, padding: "10px 0",
              fontFamily: T.mono, cursor: "pointer", transition: "border-color .15s, color .15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.color = "#ff6b6b"; e.currentTarget.style.borderColor = "#ff6b6b"; }}
              onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border; }}
            >← {isHost ? "CLOSE ROOM" : "LEAVE ROOM"}</button>

          </div>
        </main>
      );
    }

    // ── 1V1 LOBBY ──
    const opp      = room?.[oppKey];
    const isHost1v1 = myKey === "host";
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px", background: T.bg }}>
        <style>{glb}</style>
        <LeaveModal accentColor="#e8b84b" />
        <div style={{ width: "100%", maxWidth: 560, animation: "fade-in .35s ease" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "0.08em", fontFamily: T.syne, margin: 0, lineHeight: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
              <span style={{ color: T.text }}>TYPO</span>
              <span style={{ color: "#ff6b6b" }}>TERROR</span>
            </h1>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
              <span style={{ width: 20, height: 1, background: "#e8b84b44" }}/>  {/* was 33 */}
              {/* subtitle: was #fff at tiny size → warm muted */}
              <span style={{ fontSize: 9, letterSpacing: 5, color: "#aaa", fontFamily: T.mono }}>⚔ 1V1 LOBBY</span>
              <span style={{ width: 20, height: 1, background: "#e8b84b44" }}/>
            </div>
          </div>

          {/* Room code */}
          <div style={{ border: `1px solid ${T.border}`, background: T.bgCard, padding: "22px 24px", marginBottom: 20, textAlign: "center" }}>
            <p style={{ fontSize: 9, letterSpacing: 5, color: T.text, marginBottom: 10, fontFamily: T.mono }}>SHARE ROOM CODE</p>
            <div style={{ fontSize: 38, fontWeight: 900, color: "#e8b84b", fontFamily: T.syne }}>
              <span style={{ letterSpacing: 12, paddingLeft: 12 }}>{code}</span>
            </div>
            <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/room/${code}`)}
              style={{ marginTop: 10, fontSize: 9, letterSpacing: 3, color: T.text, background: "none", border: "none", cursor: "pointer", fontFamily: T.mono }}>
              copy invite link →
            </button>
          </div>

          {/* Player slots */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <PlayerSlot name={me?.name}  label="YOU"  accent="#6ee7f7" ready={me?.ready} />
            <div style={{ display: "flex", alignItems: "center" }}>
              {/* VS: was T.ghost (#1e1e1e) → #555 */}
              <span style={{ fontSize: 9, letterSpacing: 3, color: "#555", fontFamily: T.mono }}>VS</span>
            </div>
            <PlayerSlot name={opp?.name} label={isHost1v1 ? "GUEST" : "HOST"} accent="#ff6b6b" ready={opp?.ready} />
          </div>

          {/* waiting: was T.dim (#333) → #666 */}
          {!opp && (
            <p style={{ color: T.dim, fontSize: 9, letterSpacing: 3, textAlign: "center", marginBottom: 16, fontFamily: T.mono }}>
              waiting for opponent...
            </p>
          )}

          {opp && (
            <VotePanel votes={room?.votes || {}} myVote={myVote} onVote={handleVote} presentKeys={["host", "guest"]} locked={!!me?.ready} />
          )}

          <button onClick={handleReady} disabled={!opp || !myVote || me?.ready}
            style={{
              width: "100%", border: `1px solid ${me?.ready ? "#4aaa5a" : "#e8b84b"}`,
              color: me?.ready ? "#4aaa5a" : "#e8b84b", padding: "14px 0",
              fontSize: 12, letterSpacing: 5, fontFamily: T.mono,
              background: "transparent", cursor: "pointer",
              opacity: (!opp || !myVote || me?.ready) ? 0.35 : 1,
              transition: "opacity .2s",
            }}>
            {me?.ready ? "✓ READY" : !myVote ? "VOTE TO UNLOCK" : "READY UP"}
          </button>

          <button onClick={() => setShowLeaveConfirm(true)} style={{
            marginTop: 10, width: "100%", background: "transparent",
            border: `1px solid ${T.border}`, color: T.muted,
            fontSize: 10, letterSpacing: 4, padding: "10px 0",
            fontFamily: T.mono, cursor: "pointer", transition: "border-color .15s, color .15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.color = "#e8b84b"; e.currentTarget.style.borderColor = "#e8b84b"; }}
            onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border; }}
          >← {isHost1v1 ? "CLOSE ROOM" : "LEAVE ROOM"}</button>

        </div>
      </main>
    );
  }

  // ─── FINISHED ────────────────────────────────────────────────────────────────
  if (gamePhase === "finished" && room) {

    // Deathmatch results
    if (isDeathMatch) {
      const winnerKey  = room.winner;
      const winnerName = room[winnerKey]?.name || "???";
      const iWon       = winnerKey === myKey;
      const accent     = iWon ? "#ffdd44" : "#ff6b6b";
      const allPlayers = PLAYER_KEYS
        .filter(k => !!room[k])
        .map(k => ({ key: k, ...room[k], accent: SLOT_ACCENTS[k] }))
        .sort((a, b) => b.typedCount - a.typedCount);

      return (
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, padding: "20px 16px" }}>
          <style>{glb}</style>
          <div style={{ textAlign: "center", maxWidth: 620, width: "100%", animation: "fade-in .4s ease" }}>
            {/* label: was T.dim (#333) → #666 */}
            <div style={{ fontSize: 9, letterSpacing: 6, color: T.dim, marginBottom: 12, fontFamily: T.mono }}>DEATHMATCH · RESULT</div>
            <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: 5, fontFamily: T.syne, color: accent, textShadow: `0 0 40px ${accent}33`, marginBottom: 4, lineHeight: 1, textAlign: "center", whiteSpace: "nowrap" }}>
              {iWon ? "VICTORY" : "DEFEATED"}
            </div>
            {/* winner name: was T.muted (#555) → #888 */}
            <p style={{ color: T.muted, fontSize: 9, letterSpacing: 6, marginBottom: 32, fontFamily: T.mono }}>
              {winnerName.toUpperCase()} · FIRST TO {WORD_QUOTA} WORDS
            </p>

            {/* Scoreboard */}
            <div style={{ border: `1px solid ${T.border}`, background: T.bgDeep, marginBottom: 28, overflow: "hidden" }}>
              {allPlayers.map((p, i) => {
                const isWinner = i === 0;
                const isMe = p.key === myKey;
                return (
                  <div key={p.key} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: isWinner ? "18px 20px" : "12px 20px",
                    borderBottom: i < allPlayers.length - 1 ? `1px solid ${T.border}` : "none",
                    background: isWinner
                      ? "linear-gradient(90deg, #ffdd4412 0%, #ffdd4406 60%, transparent 100%)"
                      : isMe ? T.bgCard : "transparent",
                    borderLeft: `3px solid ${isWinner ? "#ffdd44" : "#2e2e2e"}`,
                    position: "relative",
                  }}>
                    {/* winner glow line at top */}
                    {isWinner && (
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, #ffdd4488, #ffdd4422, transparent)" }} />
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      {/* rank number / crown */}
                      {isWinner
                        ? <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>👑</span>
                        : <span style={{ fontSize: 15, fontWeight: 900, color: "#555", fontFamily: T.syne, minWidth: 22 }}>{i + 1}</span>
                      }
                      <span style={{ width: isWinner ? 7 : 5, height: isWinner ? 7 : 5, borderRadius: "50%", background: p.accent, flexShrink: 0, boxShadow: isWinner ? `0 0 8px ${p.accent}` : "none" }}/>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                        <span style={{
                          fontSize: isWinner ? 15 : 12, fontWeight: 700,
                          color: isWinner ? "#ffdd44" : isMe ? T.text : T.muted,
                          fontFamily: T.mono, letterSpacing: isWinner ? 2 : 0,
                        }}>
                          {p.name}{isMe ? " (you)" : ""}
                        </span>
                        {isWinner && (
                          <span style={{ fontSize: 8, letterSpacing: 4, color: "#ffdd4499", fontFamily: T.mono }}>WINNER</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 20 }}>
                      <Stat label="WPM"   v={p.wpm || 0}        color={isWinner ? "#ffdd44" : p.accent} small />
                      <Stat label="WORDS" v={p.typedCount || 0} color={isWinner ? "#ffdd4488" : T.muted} small />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={handlePlayAgain} style={{
                border: `1px solid #6ee7f7`, color: "#6ee7f7", padding: "13px 32px",
                fontSize: 12, letterSpacing: 5, fontFamily: T.mono, background: "transparent", cursor: "pointer",
                transition: "background .15s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "#6ee7f712"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >↺ PLAY AGAIN</button>
              <button onClick={handleLeave} style={{
                border: `1px solid ${T.border}`, color: T.muted, padding: "13px 32px",
                fontSize: 12, letterSpacing: 5, fontFamily: T.mono, background: "transparent", cursor: "pointer",
                transition: "all .15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#ff6b6b"; e.currentTarget.style.color = "#ff6b6b"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}
              >← LEAVE</button>
            </div>
          </div>
        </main>
      );
    }

    // 1v1 results
    const me  = room[myKey]; const opp = room[oppKey];
    const myT = me?.typedCount || typedCount; const oppT = opp?.typedCount || 0;
    const myW = me?.wpm || wpm;               const oppW = opp?.wpm        || 0;
    const isTie = myT === oppT;
    const won   = !isTie && myT > oppT;
    const accent = isTie ? "#e8b84b" : won ? "#6ee7f7" : "#ff6b6b";

    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, padding: "20px 16px" }}>
        <style>{glb}</style>
        <div style={{ textAlign: "center", maxWidth: 580, width: "100%", animation: "fade-in .4s ease" }}>
          <div style={{ fontSize: 9, letterSpacing: 6, color: T.dim, marginBottom: 12, fontFamily: T.mono }}>1V1 · RESULT</div>
          <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: 5, fontFamily: T.syne, color: accent, textShadow: `0 0 40px ${accent}33`, marginBottom: 4, lineHeight: 1, textAlign: "center", whiteSpace: "nowrap" }}>
            {isTie ? "DRAW" : won ? "VICTORY" : "DEFEATED"}
          </div>
          <p style={{ color: T.muted, fontSize: 9, letterSpacing: 6, marginBottom: 20, fontFamily: T.mono }}>
            {isTie ? "EXACT TIE · SAME WORDS TYPED" : `${won ? myName.toUpperCase() : (opp?.name?.toUpperCase() || "OPPONENT")} WINS`}
          </p>

          {/* Winner / tie highlight card */}
          <div style={{
            border: `1px solid ${isTie ? "#e8b84b44" : won ? "#ffdd4455" : "#ff6b6b44"}`,
            background: isTie
              ? "linear-gradient(135deg, #e8b84b10, #e8b84b05)"
              : won
                ? "linear-gradient(135deg, #ffdd4410, #ffdd4405)"
                : "linear-gradient(135deg, #ff6b6b10, #ff6b6b05)",
            padding: "16px 24px", marginBottom: 16,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${isTie ? "#e8b84b66" : won ? "#ffdd4466" : "#ff6b6b55"}, transparent)` }} />
            <span style={{ fontSize: 22 }}>{isTie ? "🤝" : "👑"}</span>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 5, color: isTie ? "#e8b84b88" : won ? "#ffdd4488" : "#ff6b6b88", fontFamily: T.mono, marginBottom: 3 }}>
                {isTie ? "TIED" : "WINNER"}
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 3, fontFamily: T.syne, color: isTie ? "#e8b84b" : won ? "#ffdd44" : "#ff6b6b" }}>
                {isTie ? "BOTH PLAYERS" : won ? myName.toUpperCase() : (opp?.name?.toUpperCase() || "OPPONENT")}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", border: `1px solid ${T.border}`, background: T.bgDeep, marginBottom: 32, overflow: "hidden" }}>
            {[
              { label: "YOUR WPM",  v: myW,  color: "#6ee7f7"  },
              { label: "YOUR WORDS", v: myT,  color: T.text     },
              { label: "OPP WPM",   v: oppW, color: "#ff6b6b"  },
              { label: "OPP WORDS", v: oppT, color: T.muted    },
            ].map((s, i) => (
              <div key={i} style={{
                flex: 1, padding: "20px 0", textAlign: "center",
                borderRight: i < 3 ? `1px solid ${T.border}` : "none",
              }}>
                {/* stat labels: was T.dim (#333) → #666 */}
                <div style={{ fontSize: 8, letterSpacing: 3, color: T.dim, marginBottom: 6, fontFamily: T.mono }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: s.color, fontFamily: T.syne, textShadow: `0 0 12px ${s.color}33` }}>{s.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {(() => {
              const req = room?.playAgainRequest;
              const iRequested  = req === myKey;
              const theyRequested = req && req !== myKey;

              if (theyRequested) {
                // ── Incoming request modal-style banner ──
                return (
                  <div style={{
                    position: "fixed", inset: 0, background: "#0e0e0ef0",
                    zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px",
                  }}>
                    <div style={{
                      width: "100%", maxWidth: 360,
                      border: `1px solid #6ee7f755`,
                      background: T.bgCard, padding: 32, textAlign: "center",
                      animation: "fade-in .2s ease", position: "relative", overflow: "hidden",
                    }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, #6ee7f755, transparent)" }} />
                      <div style={{ fontSize: 9, letterSpacing: 6, color: T.dim, marginBottom: 12, fontFamily: T.mono }}>REMATCH REQUEST</div>
                      <div style={{ fontSize: 22, marginBottom: 8 }}>⚔</div>
                      <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 3, fontFamily: T.syne, color: "#6ee7f7", marginBottom: 8 }}>
                        {(room?.[req]?.name || "OPPONENT").toUpperCase()}
                      </div>
                      <p style={{ color: T.muted, fontSize: 10, letterSpacing: 2, lineHeight: 2, marginBottom: 28, fontFamily: T.mono }}>
                        wants a rematch. Do you accept?
                      </p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={handleDeclinePlayAgain}
                          style={{
                            flex: 1, padding: "12px 0", background: "transparent",
                            border: `1px solid ${T.borderHi}`, color: T.muted,
                            fontSize: 10, letterSpacing: 4, fontFamily: T.mono, cursor: "pointer",
                            transition: "all .15s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = "#ff6b6b"; e.currentTarget.style.color = "#ff6b6b"; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.color = T.muted; }}
                        >DECLINE</button>
                        <button
                          onClick={handleAcceptPlayAgain}
                          style={{
                            flex: 1, padding: "12px 0", background: "#6ee7f70d",
                            border: `1px solid #6ee7f7`, color: "#6ee7f7",
                            fontSize: 10, letterSpacing: 4, fontFamily: T.mono, cursor: "pointer",
                            transition: "all .15s",
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "#6ee7f71a"}
                          onMouseLeave={e => e.currentTarget.style.background = "#6ee7f70d"}
                        >ACCEPT</button>
                      </div>
                    </div>
                  </div>
                );
              }

              if (iRequested) {
                return (
                  <>
                    <button disabled style={{
                      border: `1px solid #6ee7f755`, color: "#6ee7f788", padding: "13px 32px",
                      fontSize: 12, letterSpacing: 5, fontFamily: T.mono, background: "transparent",
                      cursor: "default", animation: "glow-pulse 1.4s ease-in-out infinite",
                    }}>↺ WAITING...</button>
                    <button onClick={handleDeclinePlayAgain} style={{
                      border: `1px solid ${T.border}`, color: T.muted, padding: "13px 32px",
                      fontSize: 12, letterSpacing: 5, fontFamily: T.mono, background: "transparent", cursor: "pointer",
                      transition: "all .15s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#ff6b6b"; e.currentTarget.style.color = "#ff6b6b"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}
                    >CANCEL</button>
                  </>
                );
              }

              return (
                <>
                  <button onClick={handlePlayAgain} style={{
                    border: `1px solid #6ee7f7`, color: "#6ee7f7", padding: "13px 32px",
                    fontSize: 12, letterSpacing: 5, fontFamily: T.mono, background: "transparent", cursor: "pointer",
                    transition: "background .15s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "#6ee7f712"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >↺ PLAY AGAIN</button>
                  <button onClick={handleLeave} style={{
                    border: `1px solid ${T.border}`, color: T.muted, padding: "13px 32px",
                    fontSize: 12, letterSpacing: 5, fontFamily: T.mono, background: "transparent", cursor: "pointer",
                    transition: "all .15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#ff6b6b"; e.currentTarget.style.color = "#ff6b6b"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}
                  >← LEAVE</button>
                </>
              );
            })()}
          </div>
        </div>
      </main>
    );
  }

  // ─── PLAYING ─────────────────────────────────────────────────────────────────
  const timerPct   = (timeLeft / GAME_DURATION) * 100;
  const timerColor = timeLeft > 20 ? T.text : timeLeft > 10 ? "#ffaa00" : "#ff4444";

  const opponents = isDeathMatch
    ? PLAYER_KEYS.filter(k => k !== myKey && !!room?.[k]).map(k => ({ key: k, ...room[k], accent: SLOT_ACCENTS[k] }))
    : (room?.[oppKey] ? [{ key: oppKey, ...room[oppKey], accent: SLOT_ACCENTS[oppKey] }] : []);

  const diffMeta = room?.difficulty
    ? { easy: { label: "EASY", color: "#6bffb8" }, medium: { label: "MEDIUM", color: "#e8b84b" }, hard: { label: "HARD", color: "#ff6b6b" } }[room.difficulty]
    : null;

  return (
    <main
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: T.bg, maxWidth: isDeathMatch ? 1280 : 960, margin: "0 auto", padding: "0 20px" }}
      onClick={() => inputRef.current?.focus()}
    >
      <style>{glb}</style>

      {/* ── Attack banner ── */}
      {banner && (
        <div style={{
          position: "fixed", top: 68, left: "50%",
          transform: "translateX(-50%)",
          padding: "10px 22px", fontSize: 11, fontWeight: 700, letterSpacing: 4, zIndex: 50,
          border: `1px solid ${banner.dir === "incoming" ? "#ff6b6b" : myAccent}`,
          color: banner.dir === "incoming" ? "#ff6b6b" : myAccent,
          background: banner.dir === "incoming" ? "#ff333318" : `${myAccent}12`,  // was 12/0c — boosted
          fontFamily: T.mono, backdropFilter: "blur(10px)",
          animation: "banner-in .2s ease",
          whiteSpace: "nowrap",
        }}>
          {banner.dir === "incoming" ? `⚡ INCOMING: ${banner.label}` : `✊ SENT: ${banner.label}`}
        </div>
      )}

      {/* ── Countdown overlay ── */}
      {countdown && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, background: "#0e0e0ed0", pointerEvents: "none" }}>
          <div style={{ textAlign: "center" }}>
            <span key={countdown} style={{
              fontSize: 130, fontWeight: 900, fontFamily: T.syne, color: "#e8b84b",
              textShadow: "0 0 60px #e8b84b44", display: "block",
              animation: "countdown .9s ease forwards",
            }}>{countdown}</span>
            {/* GET READY: was T.dim (#333) → #666 */}
            <span style={{ fontSize: 10, letterSpacing: 6, color: T.dim, fontFamily: T.mono }}>GET READY</span>
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 0", borderBottom: `1px solid ${T.border}`, flexShrink: 0, gap: 12,
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: 3, fontFamily: T.syne }}>
            <span style={{ color: T.text }}>TYPO</span>
            <span style={{ color: isDeathMatch ? "#ff6b6b" : "#e8b84b" }}>TERROR</span>
          </span>
          {/* DEATHMATCH badge: was #ff6b6b55 → #ff6b6b88 */}
          {isDeathMatch && (
            <span style={{ fontSize: 8, letterSpacing: 4, color: "#ff6b6b88", fontFamily: T.mono }}>💀 DEATHMATCH</span>
          )}
        </div>

        {/* Timer / quota */}
        {isDeathMatch ? (
          <div style={{ textAlign: "center" }}>
            {/* FIRST TO: was T.ghost (#1e1e1e) → #555 */}
            <div style={{ fontSize: 8, letterSpacing: 4, color: "#555", fontFamily: T.mono }}>FIRST TO</div>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: T.syne, color: "#e8b84b", lineHeight: 1.1 }}>{WORD_QUOTA}</div>
            {/* WORDS: was T.ghost (#1e1e1e) → #555 */}
            <div style={{ fontSize: 8, letterSpacing: 3, color: "#555", fontFamily: T.mono }}>WORDS</div>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 700, fontFamily: T.syne, lineHeight: 1, color: timerColor, transition: "color .5s" }}>{timeLeft}</div>
            <div style={{ width: 100, height: 2, background: T.border, margin: "5px auto 0", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${timerPct}%`, background: timerColor, transition: "width 1s linear, background .5s" }}/>
            </div>
          </div>
        )}

        {/* Right info */}
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          {diffMeta && (
            <span style={{
              fontSize: 8, letterSpacing: 3, color: diffMeta.color,
              border: `1px solid ${diffMeta.color}44`, padding: "2px 8px",  // was 33 → 44
              fontFamily: T.mono,
            }}>{diffMeta.label}</span>
          )}
          {/* room code: was T.ghost (#1e1e1e) → #555 */}
          <span style={{ fontSize: 8, letterSpacing: 2, color: "#555", fontFamily: T.mono }}>{code}</span>
        </div>
      </div>

      {/* ── Game area ── */}
      {isDeathMatch ? (
        <div style={{ display: "flex", gap: 14, flex: 1, paddingTop: 16, paddingBottom: 16, overflow: "hidden", minHeight: 0 }}>
          {/* Player lane */}
          <div style={{ flex: "0 0 44%", minWidth: 0 }}>
            <Lane label={myName.toUpperCase()} accent={myAccent} words={words}
              typedCount={typedCount} currentInput={input} wpm={wpm} charge={charge}
              attackReady={attackReady} onFireAttack={fireAttack}
              effects={myEffects} isPlayer quota={WORD_QUOTA} />
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: T.border, alignSelf: "stretch", flexShrink: 0 }}/>

          {/* Opponents */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
            {/* OPPONENTS label: was T.ghost (#1e1e1e) → #555 */}
            <div style={{ fontSize: 8, letterSpacing: 5, color: "#555", marginBottom: 4, fontFamily: T.mono }}>
              OPPONENTS · {opponents.length}
            </div>
            {opponents.length === 0 && (
              <p style={{ color: T.muted, fontSize: 11, fontFamily: T.mono }}>no opponents</p>
            )}
            {opponents.map(opp => (
              <Lane key={opp.key} label={(opp.name || "???").toUpperCase()} accent={opp.accent}
                words={words} typedCount={opp.typedCount || 0} wpm={opp.wpm || 0}
                charge={opp.charge || 0} effects={{}} isPlayer={false} compact quota={WORD_QUOTA} />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, paddingTop: 18, paddingBottom: 18 }}>
          <Lane label={myName.toUpperCase()} accent={myAccent} words={words}
            typedCount={typedCount} currentInput={input} wpm={wpm} charge={charge}
            attackReady={attackReady} onFireAttack={fireAttack} effects={myEffects} isPlayer />
          <Divider label="VS" />
          {opponents[0] && (
            <Lane label={(opponents[0].name || "OPPONENT").toUpperCase()} accent={opponents[0].accent}
              words={words} typedCount={opponents[0].typedCount || 0} wpm={opponents[0].wpm || 0}
              charge={opponents[0].charge || 0} effects={{}} isPlayer={false} compact />
          )}
        </div>
      )}

      <input ref={inputRef} value={input} onChange={handleInput} onKeyDown={handleKeyDown}
        style={{ position: "fixed", top: -9999, left: -9999, opacity: 0 }}
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
        disabled={!!myEffects.freeze || !gameActive.current} />
    </main>
  );
}

// ─── HELPER COMPONENTS ────────────────────────────────────────────────────────
function PlayerSlot({ name, label, accent, ready }) {
  return (
    <div style={{ flex: 1, border: `1px solid ${T.border}`, background: T.bgCard, padding: "14px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 8, letterSpacing: 4, color: accent, marginBottom: 6, fontFamily: T.mono }}>{label}</div>
      {/* empty state: was T.ghost (#1e1e1e) → #555 */}
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, fontFamily: T.syne, color: name ? T.text : "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name || "empty"}
      </div>
      {/* READY: was #3a8a4a → #4aaa5a */}
      {ready && <div style={{ fontSize: 8, letterSpacing: 3, color: "#4aaa5a", marginTop: 5, fontFamily: T.mono }}>✓ READY</div>}
    </div>
  );
}

function Stat({ label, v, color, small = false }) {
  return (
    <div style={{ textAlign: "center" }}>
      {/* stat label: was T.dim (#333) → #666 */}
      <div style={{ fontSize: 8, letterSpacing: 3, color: T.dim, fontFamily: T.mono, marginBottom: small ? 2 : 4 }}>{label}</div>
      <div style={{ fontSize: small ? 17 : 30, fontWeight: 900, color, fontFamily: T.syne, textShadow: `0 0 10px ${color}33` }}>{v}</div>
    </div>
  );
}