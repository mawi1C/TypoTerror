"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { ref, set, get, update } from "firebase/database";
import { generateRoomCode, makeWordList, ATTACKS, PLAYER_KEYS, MAX_PLAYERS, WORDS_EASY, WORDS_MEDIUM } from "@/lib/gameData";
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
      <style>{`@keyframes tbCursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
      {[line1, line2].map((line, i) => {
        const showCursor = i === 0 ? cursorOnL1 : cursorOnL2;
        return (
          <span key={i} style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "clamp(13px, 1.5vw, 18px)",
            letterSpacing: "0.22em",
            color: "#e8e0c8",
            opacity: 0.28,
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

    const WORD_POOL = [...WORDS_EASY, ...WORDS_MEDIUM,
      "blur","freeze","ghost","bomb","quake","rewind",
      "attack","speed","type","wpm","race","win","charge","fire",
    ];
    const ACCENT = ["#e8b84b","#6ee7f7","#ff6b6b","#6bffb8"];
    const BIG_WORDS = ["TYPE","FAST","WIN","ATTACK","SPEED","WPM","RACE","FIGHT","FIRE","⚡"];

    // ── SVG icon definitions (ionicons-style stroked paths) ──
    const makeSVG = (path, color, size = 24) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

    const ICON_PATHS = [
      // Eye (blind)
      `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`,
      // Lightning bolt (quake)
      `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
      // Ghost
      `<path d="M9 10h.01M15 10h.01"/><path d="M12 2a7 7 0 0 1 7 7v9l-2-2-2 2-2-2-2 2-2-2-2 2V9a7 7 0 0 1 7-7z"/>`,
      // Snowflake (freeze)
      `<line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/><circle cx="12" cy="12" r="2"/>`,
      // Refresh/rewind arrows
      `<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>`,
      // Bomb
      `<circle cx="11" cy="13" r="7"/><path d="M14.35 4.65L16 3"/><line x1="18" y1="2" x2="22" y2="6"/><line x1="16" y1="6" x2="20" y2="2"/>`,
      // Skull (terror)
      `<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v-2h8v2"/><path d="M12 2a7 7 0 0 1 7 7c0 2.5-1 4.5-2.5 6H7.5C6 15.5 5 13.5 5 9a7 7 0 0 1 7-7z"/>`,
    ];

    // Preload one Image per icon × accent color combo
    const iconImages = [];
    let loadedCount = 0;
    const totalIcons = ICON_PATHS.length * ACCENT.length;

    ICON_PATHS.forEach((path, pi) => {
      ACCENT.forEach((color, ci) => {
        const svgStr = makeSVG(path, color, 64);
        const blob = new Blob([svgStr], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const img = new window.Image();
        img.onload = () => { loadedCount++; URL.revokeObjectURL(url); };
        img.src = url;
        iconImages.push({ img, pathIdx: pi, colorIdx: ci });
      });
    });



    // Giant ghost words drifting across background
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

    // Floating SVG icons
    const icons = Array.from({ length: 10 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      imgIdx: Math.floor(Math.random() * (ICON_PATHS.length * ACCENT.length)),
      targetAlpha: 0.14 + Math.random() * 0.18,
      size: 28 + Math.random() * 38,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      pulse: Math.random() * Math.PI * 2,
    }));

    // Glitch lines
    let glitchTimer = 0;
    let glitchLines = [];

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Giant ghost words
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



      // Floating SVG icons
      if (loadedCount > 0) {
        icons.forEach(ic => {
          ic.x += ic.vx; ic.y += ic.vy;
          ic.pulse += 0.014;
          const a = ic.targetAlpha * (0.6 + 0.4 * Math.sin(ic.pulse));
          if (ic.x < -80 || ic.x > canvas.width + 80) ic.vx *= -1;
          if (ic.y < -80 || ic.y > canvas.height + 80) ic.vy *= -1;
          const entry = iconImages[ic.imgIdx];
          if (entry && entry.img.complete && entry.img.naturalWidth > 0) {
            ctx.globalAlpha = a;
            ctx.drawImage(entry.img, ic.x - ic.size / 2, ic.y - ic.size / 2, ic.size, ic.size);
          }
        });
      }

      // Glitch lines
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
  const [showInfo, setShowInfo] = useState(false);

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
        code, words, mode: "deathmatch", status: "waiting",
        host: { name: name.trim(), typedCount: 0, chars: 0, wpm: 0, charge: 0, ready: false },
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
      <AnimatedBackground />
      <TypingQuote />
      <div className="w-full max-w-md" style={{ position: "relative", zIndex: 1 }}>

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
                border: `1px solid ${mode === "1v1" ? "#6ee7f7" : "#222"}`,
                color: mode === "1v1" ? "#6ee7f7" : "#444",
              }}
            >⚔ 1v1</button>
            <button
              onClick={() => setMode("deathmatch")}
              style={{
                flex: 1, padding: "12px 0", fontSize: 12, letterSpacing: 4,
                fontFamily: "'JetBrains Mono',monospace", cursor: "pointer", transition: "all 0.15s",
                background: mode === "deathmatch" ? "#ff6b6b11" : "transparent",
                border: `1px solid ${mode === "deathmatch" ? "#ff6b6b" : "#222"}`,
                color: mode === "deathmatch" ? "#ff6b6b" : "#444",
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
        <div className="mt-8 border-t border-[#141414] pt-5">
          <p className="text-[#333] text-[9px] tracking-[5px] text-center mb-3">ATTACKS</p>
          <div className="flex gap-1.5">
            {ATTACKS.map((a) => (
              <div
                key={a.id}
                className="flex-1 bg-[#111] border border-[#1a1a1a] py-2 px-1 text-center relative group cursor-default"
              >
                <div style={{ fontSize: 13 }}>{a.label.split(" ")[0]}</div>
                <div className="text-[9px] text-[#e8b84b] tracking-wider mt-1">≥{a.wpm}</div>
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 pointer-events-none
                    opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-10"
                  style={{
                    background: "#181818", border: "1px solid #2a2a2a",
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

      {/* Dev credit */}
      <div style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        pointerEvents: "none", zIndex: 40,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ width: 24, height: "1px", background: "#2a2a2a" }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9, letterSpacing: "0.3em",
          color: "#fff", userSelect: "none", whiteSpace: "nowrap",
        }}>
          CRAFTED BY <span style={{ color: "#e8b84b", opacity: 0.9 }}>DEN</span> · BSIT · THE LEWIS COLLEGE
        </span>
        <div style={{ width: 24, height: "1px", background: "#2a2a2a" }} />
      </div>

      {/* Info modal */}
      {showInfo && (
        <div style={{
          position: "fixed", inset: 0, background: "#0e0e0e",
          zIndex: 50, overflowY: "auto", fontFamily: "'JetBrains Mono',monospace",
        }}>
          <div style={{
            position: "sticky", top: 0, background: "#0e0e0e",
            borderBottom: "1px solid #1a1a1a", padding: "20px 32px",
            display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10,
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
              padding: "10px 20px", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace",
              transition: "border-color 0.15s, color 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#e8b84b"; e.currentTarget.style.color = "#e8b84b"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#555"; }}
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
            <Section label="DIFFICULTY VOTE" last>
              <p style={{ fontSize: 15, color: "#666", lineHeight: 2, marginBottom: 20 }}>
                Before each game, all players vote on the word difficulty.
                The <span style={{ color: "#e8e0c8" }}>majority wins</span> — ties are broken randomly.
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