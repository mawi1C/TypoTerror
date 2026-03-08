"use client";
// src/components/GameRoom.js
import { useEffect, useRef, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, update, push, off, get } from "firebase/database";
import { calcWPM, getAttackForWPM, GAME_DURATION, WORD_QUOTA, PLAYER_KEYS } from "@/lib/gameData";
import { useRouter } from "next/navigation";

const SLOT_ACCENTS = {
  host:  "#6ee7f7",
  guest: "#ff6b6b",
  p2:    "#ff6b6b",
  p3:    "#e8b84b",
  p4:    "#b084f5",
  p5:    "#6bffb8",
};

function Lane({ label, accent, words = [], typedCount = 0, currentInput = "", wpm = 0,
  charge = 0, attackReady, onFireAttack, effects = {}, isPlayer, compact = false, quota = null }) {

  const visStart = Math.max(0, typedCount - 6);
  const visWords = words.slice(visStart, visStart + (compact ? 24 : 40));
  const isBlurred = !!effects.blur;
  const isShaking = !!effects.shake;
  const isGhost   = !!effects.ghost;
  const isFrozen  = !!effects.freeze;

  return (
    <div style={{
      width: "100%", display: "flex", flexDirection: "column", gap: compact ? 6 : 10,
      padding: compact ? "12px 16px" : "20px 24px",
      background: isPlayer ? "#111" : "#0a0a0a",
      border: "1px solid #1a1a1a",
      borderLeft: `3px solid ${isPlayer ? accent : "#1e1e1e"}`,
      boxShadow: isPlayer ? `0 0 24px ${accent}0a` : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, overflow: "hidden" }}>
          {isPlayer && (
            <span style={{ fontSize: 8, letterSpacing: 3, color: accent, background: `${accent}18`,
              padding: "2px 8px", border: `1px solid ${accent}44`, flexShrink: 0 }}>YOU</span>
          )}
          <span style={{ color: isPlayer ? "#e8e0c8" : "#555", fontSize: compact ? 10 : 11,
            letterSpacing: 3, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {label}
          </span>
          <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
            {isFrozen && <span style={{ fontSize: 9, color: "#88ccff" }}>❄</span>}
            {isBlurred && <span style={{ fontSize: 9, color: "#ffcc44" }}>👁</span>}
            {isGhost   && <span style={{ fontSize: 9, color: "#cc88ff" }}>👻</span>}
            {isShaking && <span style={{ fontSize: 9, color: "#ff8844" }}>💥</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 14, flexShrink: 0 }}>
          {isPlayer && !compact && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 8, color: "#333" }}>⚡</span>
              <div style={{ width: 76, height: 3, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2, transition: "width 0.2s", width: `${charge}%`,
                  background: charge >= 100 ? "linear-gradient(90deg,#ffaa00,#ffee44)" : accent,
                  boxShadow: charge >= 100 ? "0 0 8px #ffdd44" : `0 0 4px ${accent}44`,
                }}/>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: charge >= 100 ? "#ffdd44" : "#444", minWidth: 28, textAlign: "right" }}>
                {Math.floor(charge)}%
              </span>
            </div>
          )}
          <span style={{ color: accent, fontSize: compact ? 16 : 28, fontWeight: 700, fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>
            {wpm}<span style={{ fontSize: 9, color: "#444", marginLeft: 2 }}>wpm</span>
          </span>
        </div>
      </div>

      {quota ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: compact ? 2 : 3 }}>
            <span style={{ fontSize: 8, letterSpacing: 3, color: "#2a2a2a" }}>WORDS</span>
            <span style={{ fontSize: compact ? 9 : 10, fontWeight: 700, color: typedCount >= quota ? "#ffdd44" : accent }}>
              {typedCount}<span style={{ color: "#2a2a2a" }}>/{quota}</span>
            </span>
          </div>
          <div style={{ height: compact ? 3 : 4, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2, transition: "width 0.3s",
              width: `${Math.min(100, (typedCount / quota) * 100)}%`,
              background: typedCount >= quota ? "#ffdd44" : accent,
              boxShadow: `0 0 6px ${accent}66`,
            }}/>
          </div>
        </div>
      ) : (
        <div style={{ height: 2, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 2, transition: "width 0.3s",
            width: `${Math.min(100, (typedCount / Math.max(1, words.length)) * 100)}%`,
            background: accent, boxShadow: `0 0 8px ${accent}88`,
          }}/>
        </div>
      )}

      <div style={{
        height: compact ? 48 : 108, overflow: "hidden",
        lineHeight: compact ? "1.8rem" : "2.4rem", fontSize: compact ? 13 : 18,
        wordBreak: "keep-all", overflowWrap: "normal", whiteSpace: "normal",
        filter: isBlurred ? "blur(6px)" : "none", opacity: isFrozen ? 0.3 : 1,
        transition: "filter 0.15s, opacity 0.15s",
        animation: isShaking ? "shake 0.12s infinite" : "none",
        cursor: "text", userSelect: "none",
      }}>
        {visWords.map((word, i) => {
          const absIdx = visStart + i;
          const isDone   = absIdx < typedCount;
          const isActive = absIdx === typedCount;
          let content;
          if (isActive && isPlayer && !isGhost) {
            const chars = word.split("").map((ch, ci) => {
              const t = currentInput[ci];
              const color = t === undefined ? "#888" : t === ch ? "#ffffff" : "#ff4455";
              return <span key={ci} style={{ color }}>{ch}</span>;
            });
            for (let ci = word.length; ci < currentInput.length; ci++) {
              chars.push(<span key={`x${ci}`} style={{ color: "#ff5566", textDecoration: "underline" }}>{currentInput[ci]}</span>);
            }
            content = chars;
          } else if (isDone) {
            content = <span style={{ color: compact ? "#2a5c38" : "#4aaa66" }}>{word}</span>;
          } else {
            content = <span style={{ color: compact ? "#2e2e2e" : "#555" }}>{word}</span>;
          }
          return (
            <span key={absIdx} style={{
              marginRight: "0.75em", display: "inline-block",
              borderBottom: isActive ? `2px solid ${accent}` : "2px solid transparent", paddingBottom: 1,
            }}>{content}</span>
          );
        })}
      </div>

      {isPlayer && !compact && (
        <button onClick={onFireAttack} disabled={!attackReady} style={{
          width: "100%", padding: "10px 0", background: "transparent",
          border: `1px solid ${attackReady ? "#ffdd44" : "#1e1e1e"}`,
          color: attackReady ? "#ffdd44" : "#2a2a2a", fontSize: 11, letterSpacing: 4,
          fontFamily: "'JetBrains Mono',monospace", fontWeight: 700,
          cursor: attackReady ? "pointer" : "default",
          animation: attackReady ? "pulse-glow 0.9s ease-in-out infinite" : "none",
          transition: "border-color 0.2s, color 0.2s",
        }}>
          {attackReady ? `▶ ${attackReady.label}  [TAB]` : "▶ CHARGING..."}
        </button>
      )}
    </div>
  );
}

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

  const handleReady = async () => {
    const r = sessionStorage.getItem("tb_role");
    await update(ref(db, `rooms/${code}/${r}`), { ready: true });
    const snap = await get(ref(db, `rooms/${code}`));
    const d = snap.val();
    if (d.mode === "deathmatch") {
      const presentKeys = PLAYER_KEYS.filter(k => !!d[k]);
      const allReady    = presentKeys.every(k => d[k]?.ready);
      if (allReady && presentKeys.length >= 2 && r === "host") {
        await update(ref(db, `rooms/${code}`), { status: "countdown" });
        setTimeout(() => update(ref(db, `rooms/${code}`), { status: "playing" }), 3200);
      }
    } else {
      if (d.host?.ready && d.guest?.ready) {
        await update(ref(db, `rooms/${code}`), { status: "countdown" });
        setTimeout(() => update(ref(db, `rooms/${code}`), { status: "playing" }), 3200);
      }
    }
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

  // ── LOBBY ──
  if (gamePhase === "lobby") {
    const me = room?.[myKey];

    if (isDeathMatch) {
      const presentPlayers = PLAYER_KEYS.filter(k => !!room?.[k]);
      return (
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px", background: "#0e0e0e" }}>
          <div style={{ width: "100%", maxWidth: 440, textAlign: "center" }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: 4, fontFamily: "'Syne',sans-serif", marginBottom: 4 }}>
              <span style={{ color: "#e8e0c8" }}>TYPO</span><span style={{ color: "#ff6b6b" }}>TERROR</span>
            </h1>
            <p style={{ color: "#ff6b6b", fontSize: 9, letterSpacing: 5, marginBottom: 28 }}>💀 DEATHMATCH LOBBY</p>
            <div style={{ border: "1px solid #1e1e1e", padding: 20, marginBottom: 16, background: "#111" }}>
              <p style={{ fontSize: 9, letterSpacing: 5, color: "#444", marginBottom: 8 }}>ROOM CODE</p>
              <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 10, color: "#e8b84b", fontFamily: "'Syne',sans-serif" }}>{code}</div>
              <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/room/${code}`)}
                style={{ marginTop: 8, fontSize: 10, letterSpacing: 3, color: "#333", background: "none", border: "none", cursor: "pointer" }}>
                copy invite link →
              </button>
            </div>
            <p style={{ color: "#333", fontSize: 9, letterSpacing: 3, marginBottom: 16, fontFamily: "'JetBrains Mono',monospace" }}>
              FIRST TO {WORD_QUOTA} WORDS WINS · ATTACKS HIT ALL OPPONENTS
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
              {PLAYER_KEYS.map(k => {
                const p  = room?.[k];
                const ac = SLOT_ACCENTS[k];
                const isMe = k === myKey;
                return (
                  <div key={k} style={{
                    border: `1px solid ${p ? "#1e1e1e" : "#111"}`, background: isMe ? "#131313" : "#0d0d0d",
                    padding: "12px 14px", textAlign: "left", borderLeft: `2px solid ${p ? ac : "#111"}`,
                  }}>
                    <div style={{ fontSize: 8, letterSpacing: 3, color: ac, marginBottom: 4 }}>
                      {k === "host" ? "HOST" : `SLOT ${PLAYER_KEYS.indexOf(k) + 1}`}{isMe ? " · YOU" : ""}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: p ? "#e8e0c8" : "#1e1e1e", fontFamily: "'Syne',sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p ? p.name : "empty"}
                    </div>
                    {p?.ready && <div style={{ fontSize: 8, letterSpacing: 3, color: "#3a7a4a", marginTop: 4 }}>✓ READY</div>}
                  </div>
                );
              })}
            </div>
            {presentPlayers.length < 2 && (
              <p style={{ color: "#444", fontSize: 10, letterSpacing: 3, marginBottom: 12 }}>waiting for players... ({presentPlayers.length}/5)</p>
            )}
            <button onClick={handleReady} disabled={presentPlayers.length < 2 || me?.ready} style={{
              width: "100%", border: "1px solid #ff6b6b", color: "#ff6b6b", padding: "14px 0",
              fontSize: 13, letterSpacing: 5, fontFamily: "'JetBrains Mono',monospace",
              background: "transparent", cursor: "pointer",
              opacity: (presentPlayers.length < 2 || me?.ready) ? 0.3 : 1,
            }}>
              {me?.ready ? "✓ READY" : "READY UP"}
            </button>
            <p style={{ color: "#222", fontSize: 9, letterSpacing: 3, marginTop: 10, fontFamily: "'JetBrains Mono',monospace" }}>
              game starts when all players ready
            </p>
          </div>
        </main>
      );
    }

    const opp = room?.[oppKey];
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px", background: "#0e0e0e" }}>
        <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
          <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: 4, fontFamily: "'Syne',sans-serif", marginBottom: 4 }}>
            <span style={{ color: "#e8e0c8" }}>TYPO</span><span style={{ color: "#e8b84b" }}>TERROR</span>
          </h1>
          <p style={{ color: "#444", fontSize: 9, letterSpacing: 5, marginBottom: 36 }}>ROOM LOBBY</p>
          <div style={{ border: "1px solid #1e1e1e", padding: 24, marginBottom: 24, background: "#111" }}>
            <p style={{ fontSize: 9, letterSpacing: 5, color: "#444", marginBottom: 12 }}>ROOM CODE — SHARE WITH FRIEND</p>
            <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 10, color: "#e8b84b", fontFamily: "'Syne',sans-serif" }}>{code}</div>
            <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/room/${code}`)}
              style={{ marginTop: 10, fontSize: 10, letterSpacing: 3, color: "#333", background: "none", border: "none", cursor: "pointer" }}>
              copy invite link →
            </button>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            <PlayerSlot name={me?.name}  label="YOU"  accent="#6ee7f7" ready={me?.ready}/>
            <div style={{ display: "flex", alignItems: "center", color: "#333", fontSize: 11, letterSpacing: 3 }}>VS</div>
            <PlayerSlot name={opp?.name} label={role === "host" ? "GUEST" : "HOST"} accent="#ff6b6b" ready={opp?.ready}/>
          </div>
          {!opp && <p style={{ color: "#444", fontSize: 10, letterSpacing: 3, marginBottom: 16 }}>waiting for opponent...</p>}
          <button onClick={handleReady} disabled={!opp || me?.ready} style={{
            width: "100%", border: "1px solid #e8b84b", color: "#e8b84b", padding: "14px 0",
            fontSize: 13, letterSpacing: 5, fontFamily: "'JetBrains Mono',monospace",
            background: "transparent", cursor: "pointer", opacity: (!opp || me?.ready) ? 0.3 : 1,
          }}>
            {me?.ready ? "✓ READY" : "READY UP"}
          </button>
        </div>
      </main>
    );
  }

  // ── FINISHED ──
  if (gamePhase === "finished" && room) {
    if (isDeathMatch) {
      const winnerKey  = room.winner;
      const winnerName = room[winnerKey]?.name || "???";
      const iWon       = winnerKey === myKey;
      const accent     = iWon ? "#ffdd44" : "#ff6b6b";
      const allPlayers = PLAYER_KEYS.filter(k => !!room[k])
        .map(k => ({ key: k, ...room[k], accent: SLOT_ACCENTS[k] }))
        .sort((a, b) => b.typedCount - a.typedCount);
      return (
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e0e0e", padding: "0 16px" }}>
          <div style={{ textAlign: "center", maxWidth: 520, width: "100%" }}>
            <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: 4, fontFamily: "'Syne',sans-serif", color: accent, textShadow: `0 0 30px ${accent}44`, marginBottom: 4 }}>
              {iWon ? "VICTORY" : "DEFEATED"}
            </div>
            <p style={{ color: "#444", fontSize: 10, letterSpacing: 6, marginBottom: 32 }}>
              {winnerName.toUpperCase()} · FIRST TO {WORD_QUOTA} WORDS
            </p>
            <div style={{ border: "1px solid #1a1a1a", background: "#0d0d0d", marginBottom: 32 }}>
              {allPlayers.map((p, i) => (
                <div key={p.key} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 20px", borderBottom: i < allPlayers.length - 1 ? "1px solid #141414" : "none",
                  background: p.key === myKey ? "#111" : "transparent",
                  borderLeft: `3px solid ${i === 0 ? "#ffdd44" : "#1a1a1a"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: i === 0 ? "#ffdd44" : "#333", fontFamily: "'Syne',sans-serif", minWidth: 24 }}>{i + 1}</span>
                    <span style={{ color: p.accent, fontSize: 8 }}>●</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: p.key === myKey ? "#e8e0c8" : "#555" }}>
                      {p.name}{p.key === myKey ? " (you)" : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 20 }}>
                    <Stat label="WPM"   v={p.wpm || 0}        color={p.accent} small />
                    <Stat label="WORDS" v={p.typedCount || 0} color="#555"     small />
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => router.push("/")} style={{
              border: "1px solid #e8b84b", color: "#e8b84b", padding: "13px 48px",
              fontSize: 13, letterSpacing: 5, fontFamily: "'JetBrains Mono',monospace", background: "transparent", cursor: "pointer",
            }}>BACK TO LOBBY</button>
          </div>
        </main>
      );
    }

    const me  = room[myKey]; const opp = room[oppKey];
    const myT = me?.typedCount || typedCount; const oppT = opp?.typedCount || 0;
    const myW = me?.wpm || wpm;               const oppW = opp?.wpm        || 0;
    const won = myT >= oppT; const accent = won ? "#6ee7f7" : "#ff6b6b";
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e0e0e", padding: "0 16px" }}>
        <div style={{ textAlign: "center", maxWidth: 500, width: "100%" }}>
          <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: 4, fontFamily: "'Syne',sans-serif", color: accent, textShadow: `0 0 30px ${accent}44`, marginBottom: 4 }}>
            {won ? "VICTORY" : "DEFEATED"}
          </div>
          <p style={{ color: "#444", fontSize: 10, letterSpacing: 6, marginBottom: 40 }}>{won ? myName : (opp?.name || "OPPONENT")} WINS</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 40 }}>
            <Stat label="YOUR WPM"  v={myW}  color="#6ee7f7"/>
            <Stat label="WORDS"     v={myT}  color="#e8e0c8"/>
            <Stat label="OPP WPM"   v={oppW} color="#ff6b6b"/>
            <Stat label="OPP WORDS" v={oppT} color="#e8e0c8"/>
          </div>
          <button onClick={() => router.push("/")} style={{
            border: "1px solid #e8b84b", color: "#e8b84b", padding: "13px 48px",
            fontSize: 13, letterSpacing: 5, fontFamily: "'JetBrains Mono',monospace", background: "transparent", cursor: "pointer",
          }}>BACK TO LOBBY</button>
        </div>
      </main>
    );
  }

  // ── PLAYING ──
  const timerPct   = (timeLeft / GAME_DURATION) * 100;
  const timerColor = timeLeft > 20 ? "#e8e0c8" : timeLeft > 10 ? "#ffaa00" : "#ff4444";

  const opponents = isDeathMatch
    ? PLAYER_KEYS.filter(k => k !== myKey && !!room?.[k]).map(k => ({ key: k, ...room[k], accent: SLOT_ACCENTS[k] }))
    : (room?.[oppKey] ? [{ key: oppKey, ...room[oppKey], accent: SLOT_ACCENTS[oppKey] }] : []);

  return (
    <main
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0e0e0e", maxWidth: isDeathMatch ? 1280 : 960, margin: "0 auto", padding: "0 20px" }}
      onClick={() => inputRef.current?.focus()}
    >
      {banner && (
        <div className="banner-anim" style={{
          position: "fixed", top: 72, left: "50%", transform: "translateX(-50%)",
          padding: "10px 24px", fontSize: 12, fontWeight: 700, letterSpacing: 3, zIndex: 50,
          border: `1px solid ${banner.dir === "incoming" ? "#ff6b6b" : myAccent}`,
          color: banner.dir === "incoming" ? "#ff6b6b" : myAccent,
          background: banner.dir === "incoming" ? "#ff333318" : "#00ffaa10",
          fontFamily: "'JetBrains Mono',monospace", backdropFilter: "blur(8px)",
        }}>
          {banner.dir === "incoming" ? `⚡ INCOMING: ${banner.label}` : `✊ YOU SENT: ${banner.label}`}
        </div>
      )}

      {countdown && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, background: "#0e0e0ecc", pointerEvents: "none" }}>
          <span key={countdown} className="countdown" style={{ fontSize: 120, fontWeight: 900, fontFamily: "'Syne',sans-serif", color: "#e8b84b", textShadow: "0 0 40px #e8b84b55" }}>{countdown}</span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid #141414", flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: 3, fontFamily: "'Syne',sans-serif" }}>
          <span style={{ color: "#e8e0c8" }}>TYPO</span>
          <span style={{ color: isDeathMatch ? "#ff6b6b" : "#e8b84b" }}>TERROR</span>
          {isDeathMatch && <span style={{ fontSize: 9, letterSpacing: 4, color: "#ff6b6b55", marginLeft: 10 }}>💀 DEATHMATCH</span>}
        </span>
        {isDeathMatch ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, letterSpacing: 4, color: "#2a2a2a", marginBottom: 2 }}>FIRST TO</div>
            <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Syne',sans-serif", color: "#e8b84b", lineHeight: 1 }}>{WORD_QUOTA}</div>
            <div style={{ fontSize: 8, letterSpacing: 3, color: "#2a2a2a" }}>WORDS</div>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Syne',sans-serif", lineHeight: 1, color: timerColor }}>{timeLeft}</div>
            <div style={{ width: 112, height: 2, background: "#1a1a1a", margin: "4px auto 0", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 2, width: `${timerPct}%`, background: timerColor, transition: "width 1s linear" }}/>
            </div>
          </div>
        )}
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#2a2a2a" }}>{code}</div>
      </div>

      {isDeathMatch ? (
        <div style={{ display: "flex", gap: 16, flex: 1, paddingTop: 16, paddingBottom: 16, overflow: "hidden", minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Lane label={myName.toUpperCase()} accent={myAccent} words={words}
              typedCount={typedCount} currentInput={input} wpm={wpm} charge={charge}
              attackReady={attackReady} onFireAttack={fireAttack}
              effects={myEffects} isPlayer quota={WORD_QUOTA} />
          </div>
          <div style={{ width: 1, background: "#1a1a1a", alignSelf: "stretch", flexShrink: 0 }}/>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
            <p style={{ fontSize: 8, letterSpacing: 5, color: "#222", marginBottom: 2, fontFamily: "'JetBrains Mono',monospace" }}>
              OPPONENTS — {opponents.length} PLAYER{opponents.length !== 1 ? "S" : ""}
            </p>
            {opponents.length === 0 && <p style={{ color: "#1e1e1e", fontSize: 11 }}>no opponents connected</p>}
            {opponents.map(opp => (
              <Lane key={opp.key} label={(opp.name || "???").toUpperCase()} accent={opp.accent}
                words={words} typedCount={opp.typedCount || 0} wpm={opp.wpm || 0}
                charge={opp.charge || 0} effects={{}} isPlayer={false} compact quota={WORD_QUOTA} />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, paddingTop: 20, paddingBottom: 20 }}>
          <Lane label={myName.toUpperCase()} accent={myAccent} words={words}
            typedCount={typedCount} currentInput={input} wpm={wpm} charge={charge}
            attackReady={attackReady} onFireAttack={fireAttack} effects={myEffects} isPlayer />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: "#141414" }}/>
            <span style={{ fontSize: 9, letterSpacing: 5, color: "#222" }}>VS</span>
            <div style={{ flex: 1, height: 1, background: "#141414" }}/>
          </div>
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

function PlayerSlot({ name, label, accent, ready }) {
  return (
    <div style={{ flex: 1, border: "1px solid #1a1a1a", background: "#111", padding: 16, textAlign: "center" }}>
      <div style={{ fontSize: 9, letterSpacing: 4, color: accent, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, fontFamily: "'Syne',sans-serif", color: name ? "#e8e0c8" : "#222", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name || "empty"}
      </div>
      {ready && <div style={{ fontSize: 9, letterSpacing: 3, color: "#3a7a4a", marginTop: 4 }}>✓ READY</div>}
    </div>
  );
}

function Stat({ label, v, color, small = false }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 9, letterSpacing: 3, color: "#444", fontFamily: "'JetBrains Mono',monospace", marginBottom: small ? 2 : 4 }}>{label}</div>
      <div style={{ fontSize: small ? 18 : 30, fontWeight: 700, color, fontFamily: "'Syne',sans-serif", textShadow: `0 0 12px ${color}44` }}>{v}</div>
    </div>
  );
}