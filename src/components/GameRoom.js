"use client";
// src/components/GameRoom.js
import { useEffect, useRef, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, update, push, off, get } from "firebase/database";
import { calcWPM, getAttackForWPM, GAME_DURATION } from "@/lib/gameData";
import { useRouter } from "next/navigation";

// ─── LANE ─────────────────────────────────────────────────────────────────────
function Lane({ label, accent, words = [], typedCount = 0, currentInput = "", wpm = 0, charge = 0, attackReady, onFireAttack, effects = {}, isPlayer }) {
  const visStart = Math.max(0, typedCount - 6);
  const visWords = words.slice(visStart, visStart + 32);

  const isBlurred = !!effects.blur;
  const isShaking = !!effects.shake;
  const isGhost   = !!effects.ghost;
  const isFrozen  = !!effects.freeze;

  return (
    <div style={{ flex: 1, minWidth: 0, maxWidth: "calc(50% - 12px)", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ color: accent, fontSize: 10, letterSpacing: 5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{label}</span>
        <span style={{ color: accent, fontSize: 24, fontWeight: 700, fontFamily: "'Syne',sans-serif", flexShrink: 0 }}>
          {wpm}<span style={{ fontSize: 11, color: "#444", marginLeft: 3 }}>wpm</span>
        </span>
      </div>

      {/* Progress */}
      <div style={{ height: 2, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 2, transition: "width 0.3s",
          width: `${Math.min(100, (typedCount / Math.max(1, words.length)) * 100)}%`,
          background: accent, boxShadow: `0 0 8px ${accent}88`,
        }}/>
      </div>

      {/* Text box */}
      <div style={{
        height: 108, overflow: "hidden",
        lineHeight: "2.15rem", fontSize: 15,
        wordBreak: "break-word", overflowWrap: "break-word", whiteSpace: "normal",
        filter: isBlurred ? "blur(6px)" : "none",
        opacity: isFrozen ? 0.3 : 1,
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
              const color = t === undefined ? "#555" : t === ch ? "#e8e0c8" : "#ff5566";
              return <span key={ci} style={{ color }}>{ch}</span>;
            });
            for (let ci = word.length; ci < currentInput.length; ci++) {
              chars.push(<span key={`x${ci}`} style={{ color: "#ff5566", textDecoration: "underline" }}>{currentInput[ci]}</span>);
            }
            content = chars;
          } else if (isDone) {
            content = <span style={{ color: "#2d6b3d" }}>{word}</span>;
          } else {
            content = <span style={{ color: "#333" }}>{word}</span>;
          }

          return (
            <span key={absIdx} style={{
              marginRight: "0.45em", display: "inline",
              borderBottom: isActive ? `2px solid ${accent}` : "2px solid transparent",
              paddingBottom: 1,
            }}>{content}</span>
          );
        })}
      </div>

      {/* Effect badges */}
      <div style={{ height: 16, display: "flex", gap: 10 }}>
        {isFrozen && <span style={{ fontSize: 9, letterSpacing: 3, color: "#88ccff" }}>❄ FROZEN</span>}
        {isBlurred && <span style={{ fontSize: 9, letterSpacing: 3, color: "#ffcc44" }}>👁 BLINDED</span>}
        {isGhost   && <span style={{ fontSize: 9, letterSpacing: 3, color: "#cc88ff" }}>👻 GHOST</span>}
        {isShaking && <span style={{ fontSize: 9, letterSpacing: 3, color: "#ff8844" }}>💥 QUAKE</span>}
      </div>

      {/* Charge */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 9, letterSpacing: 4, color: "#333" }}>⚡ CHARGE</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: charge >= 100 ? "#ffdd44" : accent }}>{Math.floor(charge)}%</span>
        </div>
        <div style={{ height: 3, background: "#1a1a1a", borderRadius: 2, marginBottom: 8, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 2, transition: "width 0.2s",
            width: `${charge}%`,
            background: charge >= 100 ? "linear-gradient(90deg,#ffaa00,#ffee44)" : accent,
            boxShadow: charge >= 100 ? "0 0 10px #ffdd44" : `0 0 6px ${accent}44`,
          }}/>
        </div>
        {isPlayer && (
          <button onClick={onFireAttack} disabled={!attackReady} style={{
            width: "100%", padding: "10px 0", background: "transparent",
            border: `1px solid ${attackReady ? "#ffdd44" : "#1e1e1e"}`,
            color: attackReady ? "#ffdd44" : "#2a2a2a",
            fontSize: 11, letterSpacing: 4,
            fontFamily: "'JetBrains Mono',monospace", fontWeight: 700,
            cursor: attackReady ? "pointer" : "default",
            animation: attackReady ? "pulse-glow 0.9s ease-in-out infinite" : "none",
            transition: "border-color 0.2s, color 0.2s",
          }}>
            {attackReady ? `▶ ${attackReady.label}` : "▶ CHARGING..."}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
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
  const [mounted, setMounted] = useState(false);  // ← add this line

  const inputRef   = useRef(null);
  const startTime  = useRef(null);
  const timerRef   = useRef(null);
  const typedRef   = useRef(0);
  const charsRef   = useRef(0);
  const chargeRef  = useRef(0);
  const gameActive = useRef(false);
  const effectsRef = useRef({});
  const phaseRef   = useRef("lobby");

  const myKey  = role === "host" ? "host" : "guest";
  const oppKey = role === "host" ? "guest" : "host";
  const words  = room?.words || [];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const r = sessionStorage.getItem("tb_role");
    const n = sessionStorage.getItem("tb_name");
    console.log("SESSION CHECK:", r, n); // ← add this
    if (!r || !n) { console.log("REDIRECTING: no session"); router.push("/"); return; }
    setRole(r); setMyName(n);
  }, [mounted]);

  useEffect(() => {
    if (!role) return;
    const roomRef = ref(db, `rooms/${code}`);
    const unsub = onValue(roomRef, snap => {
      if (!snap.exists()) { router.push("/"); return; }
      const data = snap.val();
      setRoom(data);
      if (data.status === "countdown" && phaseRef.current === "lobby") {
        phaseRef.current = "countdown"; startCountdown();
      }
      if (data.status === "playing" && phaseRef.current !== "playing" && phaseRef.current !== "finished") {
        phaseRef.current = "playing"; beginGame();
      }
      if (data.status === "finished" && phaseRef.current !== "finished") {
        phaseRef.current = "finished"; endGame();
      }
      if (data.attacks) {
        Object.entries(data.attacks).forEach(([key, a]) => {
          if (a.target === myKey && Date.now() - a.ts < 2500 && !a.processed) {
            applyAttack(a);
            update(ref(db, `rooms/${code}/attacks/${key}`), { processed: true });
          }
        });
      }
    });
    return () => off(roomRef);
  }, [role]);

  const startCountdown = () => {
    setPhase("countdown");
    let c = 3; setCountdown(c);
    const iv = setInterval(() => { c--; if (c <= 0) { clearInterval(iv); setCountdown(null); } else setCountdown(c); }, 1000);
  };

  const beginGame = useCallback(() => {
    setPhase("playing"); gameActive.current = true; startTime.current = Date.now();
    setTimeLeft(GAME_DURATION); setInput(""); setTyped(0); setWpm(0); setCharge(0); setAtkReady(null);
    typedRef.current = 0; charsRef.current = 0; chargeRef.current = 0;
    clearInterval(timerRef.current);
    let t = GAME_DURATION;
    timerRef.current = setInterval(async () => {
      t--; setTimeLeft(t);
      if (t <= 0) {
        clearInterval(timerRef.current); gameActive.current = false;
        if (sessionStorage.getItem("tb_role") === "host")
          await update(ref(db, `rooms/${code}`), { status: "finished" });
      }
    }, 1000);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [code]);

  const endGame = () => { setPhase("finished"); gameActive.current = false; clearInterval(timerRef.current); };
  useEffect(() => () => clearInterval(timerRef.current), []);

  const handleReady = async () => {
    const r = sessionStorage.getItem("tb_role");
    const k = r === "host" ? "host" : "guest";
    await update(ref(db, `rooms/${code}/${k}`), { ready: true });
    const snap = await get(ref(db, `rooms/${code}`));
    const d = snap.val();
    if (d.host?.ready && d.guest?.ready) {
      await update(ref(db, `rooms/${code}`), { status: "countdown" });
      setTimeout(() => update(ref(db, `rooms/${code}`), { status: "playing" }), 3200);
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
    await push(ref(db, `rooms/${code}/attacks`), { id: `${Date.now()}`, target: oppKey, from: myKey, ...atk, ts: Date.now(), processed: false });
  };

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
      } else { setInput(""); }
    }
  }, [words, myKey, code]);

  const showBanner = (label, dir) => { setBanner({ label, dir }); setTimeout(() => setBanner(null), 1500); };

  // ─── LOBBY ──────────────────────────────────────────────────────────────
  if (gamePhase === "lobby") {
    const opp = room?.[oppKey];
    const me  = room?.[myKey];
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
            <PlayerSlot name={me?.name} label="YOU" accent="#6ee7f7" ready={me?.ready}/>
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

  // ─── FINISHED ───────────────────────────────────────────────────────────
  if (gamePhase === "finished" && room) {
    const me  = room[myKey]; const opp = room[oppKey];
    const myT = me?.typedCount || typedCount; const oppT = opp?.typedCount || 0;
    const myW = me?.wpm || wpm; const oppW = opp?.wpm || 0;
    const won = myT >= oppT; const accent = won ? "#6ee7f7" : "#ff6b6b";
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e0e0e", padding: "0 16px" }}>
        <div style={{ textAlign: "center", maxWidth: 500, width: "100%" }}>
          <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: 4, fontFamily: "'Syne',sans-serif", color: accent, textShadow: `0 0 30px ${accent}44`, marginBottom: 4 }}>
            {won ? "VICTORY" : "DEFEATED"}
          </div>
          <p style={{ color: "#444", fontSize: 10, letterSpacing: 6, marginBottom: 40 }}>{won ? myName : (opp?.name || "OPPONENT")} WINS</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 40 }}>
            <Stat label="YOUR WPM" v={myW} color="#6ee7f7"/>
            <Stat label="WORDS" v={myT} color="#e8e0c8"/>
            <Stat label="OPP WPM" v={oppW} color="#ff6b6b"/>
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

  // ─── PLAYING ────────────────────────────────────────────────────────────
  const opp = room?.[oppKey];
  const timerPct   = (timeLeft / GAME_DURATION) * 100;
  const timerColor = timeLeft > 20 ? "#e8e0c8" : timeLeft > 10 ? "#ffaa00" : "#ff4444";

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0e0e0e", maxWidth: 960, margin: "0 auto", padding: "0 20px" }}
      onClick={() => inputRef.current?.focus()}>

      {/* Banner */}
      {banner && (
        <div className="banner-anim" style={{
          position: "fixed", top: 72, left: "50%", transform: "translateX(-50%)",
          padding: "10px 24px", fontSize: 12, fontWeight: 700, letterSpacing: 3, zIndex: 50,
          border: `1px solid ${banner.dir === "incoming" ? "#ff6b6b" : "#6ee7f7"}`,
          color: banner.dir === "incoming" ? "#ff6b6b" : "#6ee7f7",
          background: banner.dir === "incoming" ? "#ff333318" : "#00ff8818",
          fontFamily: "'JetBrains Mono',monospace", backdropFilter: "blur(8px)",
        }}>
          {banner.dir === "incoming" ? `⚡ ${opp?.name || "OPP"} ATTACKS: ${banner.label}` : `✊ YOU SENT: ${banner.label}`}
        </div>
      )}

      {/* Countdown */}
      {countdown && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, background: "#0e0e0ecc", pointerEvents: "none" }}>
          <span key={countdown} className="countdown" style={{ fontSize: 120, fontWeight: 900, fontFamily: "'Syne',sans-serif", color: "#e8b84b", textShadow: "0 0 40px #e8b84b55" }}>{countdown}</span>
        </div>
      )}

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid #141414", flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: 3, fontFamily: "'Syne',sans-serif" }}>
          <span style={{ color: "#e8e0c8" }}>TYPO</span><span style={{ color: "#e8b84b" }}>TERROR</span>
        </span>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Syne',sans-serif", lineHeight: 1, color: timerColor }}>{timeLeft}</div>
          <div style={{ width: 112, height: 2, background: "#1a1a1a", margin: "4px auto 0", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 2, width: `${timerPct}%`, background: timerColor, transition: "width 1s linear" }}/>
          </div>
        </div>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#2a2a2a" }}>{code}</div>
      </div>

      {/* Two lanes */}
      <div style={{ display: "flex", gap: 20, flex: 1, paddingTop: 20, paddingBottom: 20, overflow: "hidden", minHeight: 0 }}>
        <Lane label={myName.toUpperCase()} accent="#6ee7f7" words={words} typedCount={typedCount}
          currentInput={input} wpm={wpm} charge={charge} attackReady={attackReady}
          onFireAttack={fireAttack} effects={myEffects} isPlayer />
        <div style={{ width: 1, background: "#141414", alignSelf: "stretch", flexShrink: 0 }}/>
        <Lane label={(opp?.name || "OPPONENT").toUpperCase()} accent="#ff6b6b" words={words}
          typedCount={opp?.typedCount || 0} currentInput="" wpm={opp?.wpm || 0}
          charge={opp?.charge || 0} attackReady={null} effects={{}} isPlayer={false} />
      </div>

      <input ref={inputRef} value={input} onChange={handleInput}
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

function Stat({ label, v, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 9, letterSpacing: 3, color: "#444", fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color, fontFamily: "'Syne',sans-serif", textShadow: `0 0 12px ${color}44` }}>{v}</div>
    </div>
  );
}