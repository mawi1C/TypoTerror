"use client";
// src/components/GameRoom.js
import { useEffect, useRef, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, update, push, off, get, remove } from "firebase/database";
import { calcWPM, getAttackForWPM, GAME_DURATION, WORD_QUOTA, PLAYER_KEYS, resolveDifficulty, makeWordList } from "@/lib/gameData";
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
  bgCard:   "#111111",
  bgDeep:   "#0a0a0a",
  border:   "#1a1a1a",
  borderMd: "#222222",
  borderHi: "#2a2a2a",
  text:     "#e8e0c8",
  muted:    "#555555",
  dim:      "#333333",
  ghost:    "#1e1e1e",
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
              background: `${accent}14`, padding: "2px 7px",
              border: `1px solid ${accent}33`, flexShrink: 0,
              fontFamily: T.mono,
            }}>YOU</span>
          )}
          <span style={{
            color: isPlayer ? T.text : T.muted,
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
              <span style={{ fontSize: 8, color: T.dim, letterSpacing: 2, fontFamily: T.mono }}>⚡</span>
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
                color: charge >= 100 ? "#ffdd44" : T.dim, minWidth: 30, textAlign: "right",
              }}>{Math.floor(charge)}%</span>
            </div>
          )}

          {/* WPM */}
          <div style={{ textAlign: "right" }}>
            <span style={{
              fontSize: compact ? 18 : 30, fontWeight: 900,
              fontFamily: T.syne, lineHeight: 1, color: accent,
            }}>{wpm}</span>
            <span style={{ fontSize: 8, color: T.dim, marginLeft: 2, fontFamily: T.mono }}>wpm</span>
          </div>
        </div>
      </div>

      {/* ── Progress bar ── */}
      {quota ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 8, letterSpacing: 4, color: T.ghost, fontFamily: T.mono }}>PROGRESS</span>
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: T.mono, color: typedCount >= quota ? "#ffdd44" : accent }}>
              {typedCount}<span style={{ color: T.dim }}>/{quota}</span>
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
            content = <span style={{ color: compact ? "#2e5c3e" : "#4aaa66" }}>{word}</span>;
          } else {
            content = <span style={{ color: compact ? "#252525" : "#3a3a3a" }}>{word}</span>;
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
            background: attackReady ? `${accent}08` : "transparent",
            border: `1px solid ${attackReady ? "#ffdd44" : T.ghost}`,
            color: attackReady ? "#ffdd44" : T.ghost,
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
      background: `${color}12`, border: `1px solid ${color}33`,
      padding: "1px 5px", fontFamily: T.mono,
    }}>{icon} {label}</span>
  );
}

// ─── VOTE PANEL ───────────────────────────────────────────────────────────────
function VotePanel({ votes = {}, myVote, onVote, presentKeys = [] }) {
  const DIFFS = [
    { id: "easy",   label: "EASY",   color: "#6bffb8", desc: "common short words"       },
    { id: "medium", label: "MEDIUM", color: "#e8b84b", desc: "everyday vocabulary"      },
    { id: "hard",   label: "HARD",   color: "#ff6b6b", desc: "contractions & tricky"    },
  ];
  const tally = { easy: 0, medium: 0, hard: 0 };
  Object.values(votes).forEach(v => { if (tally[v] !== undefined) tally[v]++; });

  return (
    <div style={{ marginBottom: 16, animation: "fade-in .3s ease" }}>
      <p style={{ fontSize: 9, letterSpacing: 5, color: T.dim, marginBottom: 10, fontFamily: T.mono }}>
        VOTE · WORD DIFFICULTY
      </p>
      <div style={{ display: "flex", gap: 6 }}>
        {DIFFS.map(d => {
          const active = myVote === d.id;
          const count  = tally[d.id];
          return (
            <button key={d.id} onClick={() => onVote(d.id)} style={{
              flex: 1, padding: "12px 8px", cursor: "pointer",
              background: active ? `${d.color}12` : "transparent",
              border: `1px solid ${active ? d.color : T.ghost}`,
              color: active ? d.color : T.dim,
              fontFamily: T.mono, transition: "all .15s",
            }}>
              <div style={{ fontSize: 10, letterSpacing: 3, fontWeight: 700, marginBottom: 3 }}>{d.label}</div>
              <div style={{ fontSize: 8, color: active ? d.color : T.dim, marginBottom: 6 }}>{d.desc}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: count > 0 ? d.color : T.ghost }}>
                {count > 0 ? `${count}v` : "—"}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        {presentKeys.map(k => {
          const v = votes[k];
          const color = { easy: "#6bffb8", medium: "#e8b84b", hard: "#ff6b6b" }[v] || T.ghost;
          return (
            <span key={k} style={{ fontSize: 8, letterSpacing: 2, color: v ? color : T.ghost, fontFamily: T.mono }}>
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
      if (data.attacks) {
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
    return () => off(ref(db, `rooms/${code}`));
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
    const votes = d.votes || {};
    const difficulty = resolveDifficulty(votes);
    const newWords = makeWordList(120, difficulty);
    if (d.mode === "deathmatch") {
      const presentKeys = PLAYER_KEYS.filter(k => !!d[k]);
      const allReady    = presentKeys.every(k => d[k]?.ready);
      if (allReady && presentKeys.length >= 2 && r === "host") {
        await update(ref(db, `rooms/${code}`), { status: "countdown", difficulty, words: newWords });
        setTimeout(() => update(ref(db, `rooms/${code}`), { status: "playing" }), 3200);
      }
    } else {
      if (d.host?.ready && d.guest?.ready) {
        await update(ref(db, `rooms/${code}`), { status: "countdown", difficulty, words: newWords });
        setTimeout(() => update(ref(db, `rooms/${code}`), { status: "playing" }), 3200);
      }
    }
  };

  const handleLeave = async () => {
    const r = sessionStorage.getItem("tb_role");
    if (r === "host") {
      await update(ref(db, `rooms/${code}`), { status: "closed" });
      setTimeout(() => remove(ref(db, `rooms/${code}`)), 8000);
    } else {
      await remove(ref(db, `rooms/${code}/${r}`));
    }
    sessionStorage.removeItem("tb_name");
    sessionStorage.removeItem("tb_role");
    router.push("/");
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
          <div style={{ fontSize: 9, letterSpacing: 6, color: T.dim, marginBottom: 24 }}>TYPO TERROR</div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 4, fontFamily: T.syne, color: "#ff6b6b", marginBottom: 8 }}>
            ROOM CLOSED
          </div>
          <div style={{ width: 40, height: 1, background: "#ff6b6b33", margin: "0 auto 24px" }}/>
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
        <div style={{ width: "100%", maxWidth: 340, border: `1px solid ${T.borderHi}`, background: T.bgCard, padding: 32, textAlign: "center", animation: "fade-in .2s ease" }}>
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
              border: `1px solid ${T.borderHi}`, color: T.muted,
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
      return (
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px", background: T.bg }}>
          <style>{glb}</style>
          <LeaveModal accentColor="#ff6b6b" />
          <div style={{ width: "100%", maxWidth: 640, animation: "fade-in .35s ease" }}>

            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h1 style={{
                fontSize: 32,
                fontWeight: 900,
                letterSpacing: "0.08em",
                fontFamily: T.syne,
                margin: 0,
                lineHeight: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center"
              }}>
                <span style={{ color: T.text }}>TYPO</span>
                <span style={{ color: "#ff6b6b" }}>TERROR</span>
              </h1>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
                <span style={{ width: 20, height: 1, background: "#ff6b6b33" }}/>
                <span style={{ fontSize: 9, letterSpacing: 5, color: "#ff6b6b", fontFamily: T.mono }}>💀 DEATHMATCH</span>
                <span style={{ width: 20, height: 1, background: "#ff6b6b33" }}/>
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

            <p style={{ fontSize: 8, letterSpacing: 4, color: T.ghost, textAlign: "center", marginBottom: 16, fontFamily: T.mono }}>
              FIRST TO {WORD_QUOTA} WORDS WINS · ATTACKS HIT ALL
            </p>

            {/* Player slots */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16 }}>
              {PLAYER_KEYS.map(k => {
                const p  = room?.[k];
                const ac = SLOT_ACCENTS[k];
                const isMe = k === myKey;
                return (
                  <div key={k} style={{
                    border: `1px solid ${p ? T.border : T.ghost}`,
                    background: isMe ? "#131313" : T.bgDeep,
                    padding: "10px 14px",
                    borderLeft: `2px solid ${p ? ac : T.ghost}`,
                    transition: "border-color .2s",
                  }}>
                    <div style={{ fontSize: 8, letterSpacing: 3, color: ac, marginBottom: 4, fontFamily: T.mono }}>
                      {k === "host" ? "HOST" : `SLOT ${PLAYER_KEYS.indexOf(k) + 1}`}{isMe ? " · YOU" : ""}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: p ? T.text : T.ghost, fontFamily: T.syne, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p ? p.name : "empty"}
                    </div>
                    {p?.ready && <div style={{ fontSize: 8, letterSpacing: 3, color: "#3a8a4a", marginTop: 4, fontFamily: T.mono }}>✓ READY</div>}
                  </div>
                );
              })}
            </div>

            {presentPlayers.length < 2 && (
              <p style={{ color: T.text, fontSize: 11, letterSpacing: 3, textAlign: "center", marginBottom: 12, fontFamily: T.mono }}>
                waiting for players... ({presentPlayers.length}/5)
              </p>
            )}

            {presentPlayers.length >= 2 && (
              <VotePanel votes={room?.votes || {}} myVote={myVote} onVote={handleVote} presentKeys={presentPlayers} />
            )}

            <button onClick={handleReady}
              disabled={presentPlayers.length < 2 || !myVote || me?.ready}
              style={{
                width: "100%", border: `1px solid ${me?.ready ? "#3a8a4a" : "#ff6b6b"}`,
                color: me?.ready ? "#3a8a4a" : "#ff6b6b", padding: "14px 0",
                fontSize: 12, letterSpacing: 5, fontFamily: T.mono,
                background: "transparent", cursor: "pointer",
                opacity: (presentPlayers.length < 2 || !myVote || me?.ready) ? 0.35 : 1,
                transition: "opacity .2s",
              }}>
              {me?.ready ? "✓ READY" : !myVote ? "VOTE TO UNLOCK" : "READY UP"}
            </button>

            <p style={{ color: T.muted, fontSize: 10, letterSpacing: 3, marginTop: 8, textAlign: "center", fontFamily: T.mono }}>
              game starts when all players ready
            </p>

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
            <h1 style={{
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: "0.08em",
              fontFamily: T.syne,
              margin: 0,
              lineHeight: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center"
            }}>
              <span style={{ color: T.text }}>TYPO</span>
              <span style={{ color: "#ff6b6b" }}>TERROR</span>
            </h1>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
              <span style={{ width: 20, height: 1, background: "#e8b84b33" }}/>
              <span style={{ fontSize: 9, letterSpacing: 5, color: "#fff", fontFamily: T.mono }}>⚔ 1V1 LOBBY</span>
              <span style={{ width: 20, height: 1, background: "#e8b84b33" }}/>
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
              <span style={{ fontSize: 9, letterSpacing: 3, color: T.ghost, fontFamily: T.mono }}>VS</span>
            </div>
            <PlayerSlot name={opp?.name} label={isHost1v1 ? "GUEST" : "HOST"} accent="#ff6b6b" ready={opp?.ready} />
          </div>

          {!opp && (
            <p style={{ color: T.dim, fontSize: 9, letterSpacing: 3, textAlign: "center", marginBottom: 16, fontFamily: T.mono }}>
              waiting for opponent...
            </p>
          )}

          {opp && (
            <VotePanel votes={room?.votes || {}} myVote={myVote} onVote={handleVote} presentKeys={["host", "guest"]} />
          )}

          <button onClick={handleReady} disabled={!opp || !myVote || me?.ready}
            style={{
              width: "100%", border: `1px solid ${me?.ready ? "#3a8a4a" : "#e8b84b"}`,
              color: me?.ready ? "#3a8a4a" : "#e8b84b", padding: "14px 0",
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
          <div style={{ textAlign: "center", maxWidth: 520, width: "100%", animation: "fade-in .4s ease" }}>
            <div style={{ fontSize: 9, letterSpacing: 6, color: T.dim, marginBottom: 12, fontFamily: T.mono }}>DEATHMATCH · RESULT</div>
            <div style={{
              display: "flex",
              justifyContent: "center",
              width: "100%"
            }}>
              <div style={{
                fontSize: 56,
                fontWeight: 900,
                letterSpacing: 5,
                fontFamily: T.syne,
                color: accent,
                textShadow: `0 0 40px ${accent}33`,
                marginBottom: 4,
                lineHeight: 1,
                textAlign: "center"
              }}>
                {iWon ? "VICTORY" : "DEFEATED"}
              </div>
            </div>
            <p style={{ color: T.muted, fontSize: 9, letterSpacing: 6, marginBottom: 32, fontFamily: T.mono }}>
              {winnerName.toUpperCase()} · FIRST TO {WORD_QUOTA} WORDS
            </p>

            {/* Scoreboard */}
            <div style={{ border: `1px solid ${T.border}`, background: T.bgDeep, marginBottom: 28 }}>
              {allPlayers.map((p, i) => (
                <div key={p.key} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 20px",
                  borderBottom: i < allPlayers.length - 1 ? `1px solid ${T.border}` : "none",
                  background: p.key === myKey ? T.bgCard : "transparent",
                  borderLeft: `3px solid ${i === 0 ? "#ffdd44" : T.ghost}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: i === 0 ? "#ffdd44" : T.dim, fontFamily: T.syne, minWidth: 18 }}>{i + 1}</span>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: p.accent, flexShrink: 0 }}/>
                    <span style={{ fontSize: 12, fontWeight: 700, color: p.key === myKey ? T.text : T.muted, fontFamily: T.mono }}>
                      {p.name}{p.key === myKey ? " (you)" : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 20 }}>
                    <Stat label="WPM"   v={p.wpm || 0}        color={p.accent} small />
                    <Stat label="WORDS" v={p.typedCount || 0} color={T.muted}  small />
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => router.push("/")} style={{
              border: `1px solid #e8b84b`, color: "#e8b84b", padding: "13px 48px",
              fontSize: 12, letterSpacing: 5, fontFamily: T.mono, background: "transparent", cursor: "pointer",
              transition: "background .15s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#e8b84b0d"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >← BACK TO HOME</button>
          </div>
        </main>
      );
    }

    // 1v1 results
    const me  = room[myKey]; const opp = room[oppKey];
    const myT = me?.typedCount || typedCount; const oppT = opp?.typedCount || 0;
    const myW = me?.wpm || wpm;               const oppW = opp?.wpm        || 0;
    const won = myT >= oppT; const accent = won ? "#6ee7f7" : "#ff6b6b";

    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, padding: "20px 16px" }}>
        <style>{glb}</style>
        <div style={{ textAlign: "center", maxWidth: 460, width: "100%", animation: "fade-in .4s ease" }}>
          <div style={{ fontSize: 9, letterSpacing: 6, color: T.dim, marginBottom: 12, fontFamily: T.mono }}>1V1 · RESULT</div>
          <div style={{
            display: "flex",
            justifyContent: "center",
            width: "100%"
          }}>
            <div style={{
              fontSize: 56,
              fontWeight: 900,
              letterSpacing: 5,
              fontFamily: T.syne,
              color: accent,
              textShadow: `0 0 40px ${accent}33`,
              marginBottom: 4,
              lineHeight: 1,
              textAlign: "center"
            }}>
              {won ? "VICTORY" : "DEFEATED"}
            </div>
          </div>
          <p style={{ color: T.muted, fontSize: 9, letterSpacing: 6, marginBottom: 36, fontFamily: T.mono }}>
            {won ? myName.toUpperCase() : (opp?.name?.toUpperCase() || "OPPONENT")} WINS
          </p>

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
                <div style={{ fontSize: 8, letterSpacing: 3, color: T.dim, marginBottom: 6, fontFamily: T.mono }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: s.color, fontFamily: T.syne, textShadow: `0 0 12px ${s.color}33` }}>{s.v}</div>
              </div>
            ))}
          </div>

          <button onClick={() => router.push("/")} style={{
            border: `1px solid #e8b84b`, color: "#e8b84b", padding: "13px 48px",
            fontSize: 12, letterSpacing: 5, fontFamily: T.mono, background: "transparent", cursor: "pointer",
            transition: "background .15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "#e8b84b0d"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >← BACK TO HOME</button>
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
          background: banner.dir === "incoming" ? "#ff333312" : `${myAccent}0c`,
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
          {isDeathMatch && (
            <span style={{ fontSize: 8, letterSpacing: 4, color: "#ff6b6b55", fontFamily: T.mono }}>💀 DEATHMATCH</span>
          )}
        </div>

        {/* Timer / quota */}
        {isDeathMatch ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 8, letterSpacing: 4, color: T.ghost, fontFamily: T.mono }}>FIRST TO</div>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: T.syne, color: "#e8b84b", lineHeight: 1.1 }}>{WORD_QUOTA}</div>
            <div style={{ fontSize: 8, letterSpacing: 3, color: T.ghost, fontFamily: T.mono }}>WORDS</div>
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
              border: `1px solid ${diffMeta.color}33`, padding: "2px 8px",
              fontFamily: T.mono,
            }}>{diffMeta.label}</span>
          )}
          <span style={{ fontSize: 8, letterSpacing: 2, color: T.ghost, fontFamily: T.mono }}>{code}</span>
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
            <div style={{ fontSize: 8, letterSpacing: 5, color: T.ghost, marginBottom: 4, fontFamily: T.mono }}>
              OPPONENTS · {opponents.length}
            </div>
            {opponents.length === 0 && (
              <p style={{ color: T.ghost, fontSize: 11, fontFamily: T.mono }}>no opponents</p>
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
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, fontFamily: T.syne, color: name ? T.text : T.ghost, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name || "empty"}
      </div>
      {ready && <div style={{ fontSize: 8, letterSpacing: 3, color: "#3a8a4a", marginTop: 5, fontFamily: T.mono }}>✓ READY</div>}
    </div>
  );
}

function Stat({ label, v, color, small = false }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 8, letterSpacing: 3, color: T.dim, fontFamily: T.mono, marginBottom: small ? 2 : 4 }}>{label}</div>
      <div style={{ fontSize: small ? 17 : 30, fontWeight: 900, color, fontFamily: T.syne, textShadow: `0 0 10px ${color}33` }}>{v}</div>
    </div>
  );
}