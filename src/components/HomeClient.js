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
          <p style={{ color: "#333", fontSize: 9, letterSpacing: 3, marginTop: 8, textAlign: "center", fontFamily: "'JetBrains Mono',monospace" }}>
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
    </main>
  );
}