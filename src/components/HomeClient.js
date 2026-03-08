"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { ref, set, get, update } from "firebase/database";
import { generateRoomCode, makeWordList, ATTACKS, PLAYER_KEYS, MAX_PLAYERS, WORDS_EASY, WORDS_MEDIUM, HP_MAX } from "@/lib/gameData";
import TypoLogo from "../app/icon-web.png";
import Image from "next/image";

// ─── TYPING QUOTE ─────────────────────────────────────────────────────────────
function TypingQuote() {
  const QUOTES = [
    ["YOUR FINGERS.", "YOUR ARSENAL."],
    ["TYPE FAST.", "ATTACK FASTER."],
    ["WORDS ARE", "YOUR WEAPONS."],
    ["OUTTYPE OR", "BE DESTROYED."],
    ["THE ULTIMATE", "TYPING SHOWDOWN."],
    ["SPEED IS", "EVERYTHING HERE."],
  ];
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [phase, setPhase] = useState("typingL1");
  const [charIdx, setCharIdx] = useState(0);

  useEffect(() => {
    const [l1, l2] = QUOTES[quoteIdx];
    let timeout;

    if (phase === "typingL1") {
      if (charIdx < l1.length) {
        timeout = setTimeout(() => {
          setLine1(l1.slice(0, charIdx + 1));
          setCharIdx(c => c + 1);
        }, 65 + Math.random() * 45);
      } else {
        timeout = setTimeout(() => { setPhase("typingL2"); setCharIdx(0); }, 180);
      }
    } else if (phase === "typingL2") {
      if (charIdx < l2.length) {
        timeout = setTimeout(() => {
          setLine2(l2.slice(0, charIdx + 1));
          setCharIdx(c => c + 1);
        }, 65 + Math.random() * 45);
      } else {
        timeout = setTimeout(() => { setPhase("deletingL2"); setCharIdx(l2.length); }, 2800);
      }
    } else if (phase === "deletingL2") {
      if (charIdx > 0) {
        timeout = setTimeout(() => {
          setCharIdx(c => c - 1);
          setLine2(l2.slice(0, charIdx - 1));
        }, 22);
      } else {
        setPhase("deletingL1");
        setCharIdx(l1.length);
      }
    } else if (phase === "deletingL1") {
      if (charIdx > 0) {
        timeout = setTimeout(() => {
          setCharIdx(c => c - 1);
          setLine1(l1.slice(0, charIdx - 1));
        }, 22);
      } else {
        const next = (quoteIdx + 1) % QUOTES.length;
        setQuoteIdx(next);
        setPhase("typingL1");
        setCharIdx(0);
        setLine1("");
        setLine2("");
      }
    }
    return () => clearTimeout(timeout);
  }, [phase, charIdx, quoteIdx]);

  const cursorOnL1 = phase === "typingL1";
  const cursorOnL2 = phase === "typingL2" || phase === "deletingL2";

  return (
    <div style={{
      position: "fixed", bottom: 28, left: 28,
      display: "flex", flexDirection: "column", alignItems: "flex-start",
      pointerEvents: "none", zIndex: 2,
    }}>
      <style>{`@keyframes tbCursorBlink { 0%,100%{opacity:1} 50%{opacity:0} } @keyframes fade-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }`}</style>
      {[line1, line2].map((line, i) => {
        const showCursor = i === 0 ? cursorOnL1 : cursorOnL2;
        return (
          <span key={i} style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "clamp(13px, 1.5vw, 18px)",
            letterSpacing: "0.22em",
            color: "#e8e0c8",
            opacity: 0.45,
            fontWeight: 700,
            userSelect: "none",
            lineHeight: 1.55,
            minHeight: "1.55em",
            display: "block",
          }}>
            {line}
            {showCursor && (
              <span style={{
                display: "inline-block", width: "2px", height: "1em",
                background: "#e8b84b", marginLeft: 3, verticalAlign: "middle",
                animation: "tbCursorBlink 1s step-end infinite",
              }} />
            )}
          </span>
        );
      })}
    </div>
  );
}

// ─── ANIMATED BACKGROUND ─────────────────────────────────────────────────────
function AnimatedBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const ACCENT = ["#e8b84b","#6ee7f7","#ff6b6b","#6bffb8"];
    const BIG_WORDS = ["TYPE","FAST","WIN","ATTACK","SPEED","WPM","RACE","FIGHT","FIRE","⚡"];

    const bigs = Array.from({ length: 4 }, (_, i) => ({
      word: BIG_WORDS[Math.floor(Math.random() * BIG_WORDS.length)],
      x: (canvas.width / 4) * i + Math.random() * 120,
      y: 100 + Math.random() * (canvas.height - 200),
      alpha: 0.055 + Math.random() * 0.055,
      fontSize: 90 + Math.random() * 120,
      pulse: Math.random() * Math.PI * 2,
      color: ACCENT[Math.floor(Math.random() * ACCENT.length)],
      vx: (Math.random() - 0.5) * 0.09,
    }));

    let glitchTimer = 0;
    let glitchLines = [];

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      bigs.forEach(b => {
        b.pulse += 0.006;
        b.x += b.vx;
        if (b.x > canvas.width + 300) b.x = -300;
        if (b.x < -300) b.x = canvas.width + 300;
        ctx.globalAlpha = b.alpha * (0.55 + 0.45 * Math.sin(b.pulse));
        ctx.font = `900 ${b.fontSize}px 'Syne', 'JetBrains Mono', sans-serif`;
        ctx.fillStyle = b.color;
        ctx.fillText(b.word, b.x, b.y);
      });

      glitchTimer--;
      if (glitchTimer <= 0) {
        glitchTimer = 25 + Math.floor(Math.random() * 80);
        const count = Math.random() < 0.35 ? 3 : 1;
        glitchLines = Array.from({ length: count }, () => ({
          x: Math.random() * canvas.width * 0.75,
          y: Math.random() * canvas.height,
          w: 100 + Math.random() * 350,
          h: 1 + Math.random() * 2.5,
          color: ACCENT[Math.floor(Math.random() * ACCENT.length)],
          life: 5 + Math.floor(Math.random() * 7),
        }));
      }
      glitchLines = glitchLines.filter(g => g.life-- > 0);
      glitchLines.forEach(g => {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = g.color;
        ctx.fillRect(g.x, g.y, g.w, g.h);
        ctx.fillRect(g.x + 8, g.y + 2, g.w * 0.45, g.h * 0.7);
      });

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }} />
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [name, setName]         = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState("");
  const [mode, setMode]         = useState("1v1");
  const [dmSubmode, setDmSubmode] = useState("classic");
  const [showInfo, setShowInfo] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const modeDropdownRef = useRef(null);

  useEffect(() => {
    if (!showModeDropdown) return;
    const handler = (e) => {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target)) {
        setShowModeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showModeDropdown]);

  async function createRoom() {
    if (!name.trim()) { setError("Enter your name first"); return; }
    setLoading("create");
    const code  = generateRoomCode();
    const words = makeWordList(120);
    if (mode === "1v1") {
      await set(ref(db, `rooms/${code}`), {
        code, words, mode: "1v1", status: "waiting",
        host:  { name: name.trim(), typedCount: 0, chars: 0, wpm: 0, charge: 0, ready: false },
        guest: null, attacks: [], createdAt: Date.now(),
      });
    } else {
      await set(ref(db, `rooms/${code}`), {
        code, words, mode: "deathmatch", dmSubmode, status: "waiting",
        host: { name: name.trim(), typedCount: 0, chars: 0, wpm: 0, charge: 0, ready: false, hp: HP_MAX },
        attacks: [], createdAt: Date.now(),
      });
    }
    sessionStorage.setItem("tb_name", name.trim());
    sessionStorage.setItem("tb_role", "host");
    router.push(`/room/${code}`);
  }

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
        name: name.trim(), typedCount: 0, chars: 0, wpm: 0, charge: 0, ready: false, hp: HP_MAX,
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
      <AnimatedBackground />
      <TypingQuote />
      <div className="w-full max-w-md" style={{ position: "relative", zIndex: 1 }}>

        {/* Logo */}
        <div className="text-center -mb-16 -mt-16">
          <div className="flex justify-center">
            <Image src={TypoLogo} alt="Typo Terror Logo" width={600} height={200} priority />
          </div>
        </div>

        {/* Name input */}
        <div className="mb-4">
          <label className="block text-[10px] tracking-[4px] text-[#999] mb-2">YOUR NAME</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            placeholder="enter username..."
            className="w-full bg-transparent border border-[#4a4a4a] px-4 py-3 text-[#e8e0c8] text-sm tracking-widest outline-none focus:border-[#e8b84b] transition-colors placeholder:text-[#666]"
            style={{ fontFamily: "'JetBrains Mono',monospace" }}
            maxLength={18}
          />
        </div>

        {/* Mode selector — dropdown */}
        <div className="mb-5" style={{ position: "relative" }} ref={modeDropdownRef}>
          <label className="block text-[10px] tracking-[4px] text-[#999] mb-2">GAME MODE</label>

          {(() => {
            const OPTIONS = [
              { mode: "1v1",        sub: null,      icon: "⚔", label: "1V1",              desc: "2 PLAYERS · 60s RACE · MOST WORDS WINS",           color: "#6ee7f7" },
              { mode: "deathmatch", sub: "classic",  icon: "💀", label: "DEATHMATCH · CLASSIC", desc: "2–5 PLAYERS · FIRST TO 50 WORDS WINS",         color: "#ff6b6b" },
              { mode: "deathmatch", sub: "hp",       icon: "❤", label: "DEATHMATCH · HP",       desc: "2–5 PLAYERS · LAST ONE STANDING",              color: "#ff6b6b" },
            ];
            const selected = OPTIONS.find(o => o.mode === mode && (o.sub === null || o.sub === dmSubmode)) || OPTIONS[0];

            return (
              <>
                {/* Trigger button */}
                <button
                  onClick={() => setShowModeDropdown(v => !v)}
                  style={{
                    width: "100%", padding: "12px 16px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: `${selected.color}0d`,
                    border: `1px solid ${showModeDropdown ? selected.color : "#4a4a4a"}`,
                    color: selected.color, cursor: "pointer", transition: "all 0.15s",
                    fontFamily: "'JetBrains Mono',monospace",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14 }}>{selected.icon}</span>
                    <span style={{ fontSize: 11, letterSpacing: 3, fontWeight: 700 }}>{selected.label}</span>
                  </span>
                  <span style={{
                    fontSize: 9, letterSpacing: 2, color: "#888",
                    transform: showModeDropdown ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s", display: "inline-block",
                  }}>▼</span>
                </button>

                {/* Dropdown options */}
                {showModeDropdown && (
                  <div style={{
                    position: "absolute", top: "calc(100% - 4px)", left: 0, right: 0, zIndex: 20,
                    border: "1px solid #4a4a4a", borderTop: "none",
                    background: "#111",
                  }}>
                    {OPTIONS.map((o, i) => {
                      const isActive = o.mode === mode && (o.sub === null || o.sub === dmSubmode);
                      return (
                        <button key={i} onClick={() => {
                          setMode(o.mode);
                          if (o.sub) setDmSubmode(o.sub);
                          setShowModeDropdown(false);
                        }} style={{
                          width: "100%", padding: "11px 16px",
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          background: isActive ? `${o.color}12` : "transparent",
                          borderTop: i > 0 ? "1px solid #2e2e2e" : "none",
                          borderLeft: "none", borderRight: "none", borderBottom: "none",
                          color: isActive ? o.color : "#777", cursor: "pointer",
                          transition: "all 0.12s", fontFamily: "'JetBrains Mono',monospace",
                          textAlign: "left",
                        }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#ffffff08"; e.currentTarget.style.color = o.color; }}
                          onMouseLeave={e => { e.currentTarget.style.background = isActive ? `${o.color}12` : "transparent"; e.currentTarget.style.color = isActive ? o.color : "#777"; }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 13 }}>{o.icon}</span>
                            <span>
                              <div style={{ fontSize: 10, letterSpacing: 3, fontWeight: 700 }}>{o.label}</div>
                              <div style={{ fontSize: 8, letterSpacing: 2, color: "#666", marginTop: 2 }}>{o.desc}</div>
                            </span>
                          </span>
                          {isActive && <span style={{ fontSize: 10, color: o.color }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Description under trigger */}
                <p style={{ color: "#777", fontSize: 9, letterSpacing: 3, marginTop: 7, fontFamily: "'JetBrains Mono',monospace" }}>
                  {selected.desc}
                </p>
              </>
            );
          })()}
        </div>

        {/* Create */}
        <button
          onClick={createRoom}
          disabled={!!loading}
          className="w-full border border-[#e8b84b] text-[#e8b84b] py-4 text-sm tracking-[5px] mb-3 hover:bg-[#e8b84b18] transition-all disabled:opacity-40"
          style={{ fontFamily: "'JetBrains Mono',monospace" }}
        >
          {loading === "create" ? "CREATING..." : "CREATE ROOM"}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 my-4">
          <div className="flex-1 h-px bg-[#3a3a3a]" />
          <span className="text-[#888] text-xs tracking-[4px]">OR</span>
          <div className="flex-1 h-px bg-[#3a3a3a]" />
        </div>

        {/* Join */}
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(""); }}
            placeholder="ROOM CODE"
            maxLength={6}
            className="flex-1 bg-transparent border border-[#4a4a4a] px-4 py-3 text-[#e8e0c8] text-sm tracking-[6px] outline-none focus:border-[#6ee7f7] transition-colors text-center placeholder:text-[#666]"
            style={{ fontFamily: "'JetBrains Mono',monospace" }}
          />
          <button
            onClick={joinRoom}
            disabled={!!loading}
            className="border border-[#6ee7f7] text-[#6ee7f7] px-6 text-sm tracking-[3px] hover:bg-[#6ee7f718] transition-all disabled:opacity-40"
            style={{ fontFamily: "'JetBrains Mono',monospace" }}
          >
            {loading === "join" ? "..." : "JOIN"}
          </button>
        </div>

        {/* Attacks preview */}
        <div className="mt-8 border-t border-[#333] pt-5">
          <p className="text-[#888] text-[9px] tracking-[5px] text-center mb-3">ATTACKS</p>
          <div className="flex gap-1.5">
            {ATTACKS.map((a) => (
              <div
                key={a.id}
                className="flex-1 bg-[#161616] border border-[#383838] py-2 px-1 text-center relative group cursor-default"
              >
                <div style={{ fontSize: 13 }}>{a.label.split(" ")[0]}</div>
                <div className="text-[9px] text-[#e8b84b] tracking-wider mt-1">≥{a.wpm}</div>
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 pointer-events-none
                    opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-10"
                  style={{
                    background: "#222", border: "1px solid #4a4a4a",
                    color: "#e8e0c8", fontSize: 9, letterSpacing: 3,
                    fontFamily: "'JetBrains Mono',monospace",
                  }}
                >
                  {a.label.split(" ")[1]}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Info button */}
      <button
        onClick={() => setShowInfo(true)}
        style={{
          position: "fixed", bottom: 24, right: 24,
          width: 36, height: 36, borderRadius: "50%",
          border: "1px solid #4a4a4a", background: "#161616",
          color: "#999", fontSize: 15, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'JetBrains Mono',monospace", fontWeight: 700,
          transition: "border-color 0.15s, color 0.15s, box-shadow 0.15s",
          zIndex: 40,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#e8b84b"; e.currentTarget.style.color = "#e8b84b"; e.currentTarget.style.boxShadow = "0 0 12px #e8b84b22"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#4a4a4a"; e.currentTarget.style.color = "#999"; e.currentTarget.style.boxShadow = "none"; }}
        title="How to play"
      >
        ?
      </button>

      {/* Dev credit */}
      <div style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        pointerEvents: "none", zIndex: 40,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ width: 24, height: "1px", background: "#4a4a4a" }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9, letterSpacing: "0.3em",
          color: "#aaa", userSelect: "none", whiteSpace: "nowrap",
        }}>
          CRAFTED BY <span style={{ color: "#e8b84b", opacity: 1 }}>DEN</span>
        </span>
        <div style={{ width: 24, height: "1px", background: "#4a4a4a" }} />
      </div>

      {/* Error modal */}
      {error && (
        <div style={{
          position: "fixed", inset: 0, background: "#0e0e0ef0",
          zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px",
        }}>
          <div style={{
            width: "100%", maxWidth: 340,
            border: "1px solid #ff6b6b55",
            background: "#161616", padding: 32, textAlign: "center",
            animation: "fade-in .2s ease", position: "relative", overflow: "hidden",
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, #ff6b6b55, transparent)" }} />
            <div style={{ fontSize: 9, letterSpacing: 6, color: "#888", marginBottom: 12 }}>TYPO TERROR</div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 3, fontFamily: "'Syne', sans-serif", color: "#ff6b6b", marginBottom: 8 }}>
              NOTICE
            </div>
            <div style={{ width: 40, height: 1, background: "#ff6b6b44", margin: "0 auto 20px" }} />
            <p style={{ color: "#999", fontSize: 12, letterSpacing: 2, lineHeight: 2, marginBottom: 28 }}>
              {error}
            </p>
            <button onClick={() => setError("")} style={{
              width: "100%", padding: "12px 0", background: "transparent",
              border: "1px solid #ff6b6b", color: "#ff6b6b",
              fontSize: 12, letterSpacing: 4, cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace", transition: "background .15s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#ff6b6b12"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >DISMISS</button>
          </div>
        </div>
      )}

      {/* Info modal */}
      {showInfo && (
        <div style={{
          position: "fixed", inset: 0, background: "#0e0e0e",
          zIndex: 50, overflowY: "auto", fontFamily: "'JetBrains Mono',monospace",
        }}>
          <div style={{
            position: "sticky", top: 0, background: "#0e0e0e",
            borderBottom: "1px solid #2e2e2e", padding: "20px 32px",
            display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10,
          }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 4, fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>
                <span style={{ color: "#e8e0c8" }}>HOW TO</span><span style={{ color: "#e8b84b" }}>PLAY</span>
              </div>
              <div style={{ fontSize: 10, letterSpacing: 5, color: "#888", marginTop: 5 }}>TYPO TERROR — QUICK GUIDE</div>
            </div>
            <button onClick={() => setShowInfo(false)} style={{
              background: "transparent",
              border: "1px solid #4a4a4a",
              color: "#999", fontSize: 13, letterSpacing: 3,
              padding: "10px 20px", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace",
              transition: "border-color 0.15s, color 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#e8b84b"; e.currentTarget.style.color = "#e8b84b"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#4a4a4a"; e.currentTarget.style.color = "#999"; }}
            >✕ CLOSE</button>
          </div>

          <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 32px 80px" }}>
            <Section label="OBJECTIVE">
              <p style={{ fontSize: 16, color: "#888", lineHeight: 2, margin: 0 }}>
                Type the words displayed on screen as fast and accurately as you can.
                Press <Chip color="#6ee7f7">SPACE</Chip> after each word to confirm it.
                Only <span style={{ color: "#e8e0c8" }}>correctly typed</span> words count — typos are rejected and must be retyped.
              </p>
            </Section>
            <Section label="GAME MODES">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <ModeCard icon="⚔" title="1V1" color="#6ee7f7">
                  Race head-to-head against one opponent for <Chip color="#6ee7f7">60 seconds</Chip>.
                  The player who types the most correct words when time runs out wins. Attacks target your opponent only.
                </ModeCard>
                <ModeCard icon="💀" title="DEATHMATCH" color="#ff6b6b">
                  2 to 5 players compete simultaneously. The <span style={{ color: "#e8e0c8" }}>first player</span> to reach <Chip color="#ff6b6b">50 words</Chip> wins instantly.
                  There is no timer — pure speed. Attacks hit every opponent at once.
                </ModeCard>
              </div>
            </Section>
            <Section label="ATTACKS">
              <p style={{ fontSize: 15, color: "#888", lineHeight: 2, marginBottom: 24 }}>
                Every correct word charges your <Chip color="#e8b84b">⚡ attack bar</Chip>. Once it hits <Chip color="#e8b84b">100%</Chip>,
                press <Chip color="#e8b84b">TAB</Chip> to fire. Higher WPM unlocks more powerful attacks.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {ATTACKS.map(a => (
                  <div key={a.id} style={{
                    background: "#161616", border: "1px solid #2e2e2e",
                    padding: "18px 16px", borderTop: "2px solid #e8b84b55"
                  }}>
                    <div style={{ fontSize: 15, color: "#e8e0c8", letterSpacing: 2, marginBottom: 6, fontWeight: 700 }}>{a.label}</div>
                    <div style={{ fontSize: 13, color: "#777", lineHeight: 1.7, marginBottom: 10 }}>{a.desc}</div>
                    <div style={{ fontSize: 12, color: "#e8b84b", letterSpacing: 2 }}>≥ {a.wpm} WPM</div>
                  </div>
                ))}
              </div>
            </Section>
            <Section label="DIFFICULTY VOTE" last>
              <p style={{ fontSize: 15, color: "#888", lineHeight: 2, marginBottom: 20 }}>
                Before each game, all players vote on the word difficulty.
                The <span style={{ color: "#e8e0c8" }}>majority wins</span> — ties are broken randomly.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  ["EASY",   "#6bffb8", "Short, common words like the, and, run, big. Great for beginners."],
                  ["MEDIUM", "#e8b84b", "Everyday vocabulary like travel, garden, window. A balanced challenge."],
                  ["HARD",   "#ff6b6b", "Contractions like don't, they've plus tricky words like rhythm and queue."],
                ].map(([label, color, desc]) => (
                  <div key={label} style={{ border: `1px solid ${color}44`, background: `${color}0d`, padding: "20px 16px" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color, letterSpacing: 3, marginBottom: 10 }}>{label}</div>
                    <div style={{ fontSize: 13, color: "#777", lineHeight: 1.7 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </Section>
            <Section label="TIPS" last>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  ["⚡", "Charge attacks by typing accurately, not just fast — every word adds charge."],
                  ["❄", "If frozen, wait it out. You can't type through a freeze effect."],
                  ["👻", "GHOST hides your typed characters. Keep going — your input still registers."],
                  ["💣", "BOMB adds 10 words to your opponent. Fire it when they're close to winning."],
                ].map(([icon, tip]) => (
                  <div key={icon} style={{
                    display: "flex", gap: 14, alignItems: "flex-start",
                    background: "#121212", border: "1px solid #2e2e2e", padding: "16px 14px"
                  }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: 13, color: "#777", lineHeight: 1.7 }}>{tip}</span>
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
    <div style={{ marginBottom: last ? 0 : 56, paddingBottom: last ? 0 : 56, borderBottom: last ? "none" : "1px solid #252525" }}>
      <div style={{ fontSize: 10, letterSpacing: 6, color: "#666", marginBottom: 24, fontFamily: "'JetBrains Mono',monospace" }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace" }}>{children}</div>
    </div>
  );
}

function ModeCard({ icon, title, color, children }) {
  return (
    <div style={{ border: `1px solid ${color}33`, background: `${color}0a`, padding: "24px 20px", borderTop: `3px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color, letterSpacing: 4, fontFamily: "'JetBrains Mono',monospace" }}>{title}</span>
      </div>
      <div style={{ fontSize: 13, color: "#777", lineHeight: 1.9, fontFamily: "'JetBrains Mono',monospace" }}>{children}</div>
    </div>
  );
}

function Chip({ color, children }) {
  return (
    <span style={{
      color, background: `${color}1a`, border: `1px solid ${color}44`,
      padding: "2px 8px", fontSize: 11, letterSpacing: 1,
      fontFamily: "'JetBrains Mono',monospace",
      display: "inline-block", verticalAlign: "middle", margin: "0 3px",
    }}>
      {children}
    </span>
  );
}