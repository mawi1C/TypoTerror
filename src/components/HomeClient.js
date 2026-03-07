"use client";
// src/app/page.js
import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { ref, set, get } from "firebase/database";
import { generateRoomCode, makeWordList, ATTACKS } from "@/lib/gameData";
import TypoLogo from "../app/icon-web.png"; 
import Image from "next/image";

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");

  async function createRoom() {
    if (!name.trim()) {
      setError("Enter your name first");
      return;
    }
    setLoading("create");
    const code = generateRoomCode();
    const words = makeWordList(120);
    await set(ref(db, `rooms/${code}`), {
      code,
      words,
      status: "waiting", // waiting | countdown | playing | finished
      host: {
        name: name.trim(),
        typedCount: 0,
        chars: 0,
        wpm: 0,
        charge: 0,
        ready: false,
      },
      guest: null,
      attacks: [],
      createdAt: Date.now(),
    });
    sessionStorage.setItem("tb_name", name.trim());
    sessionStorage.setItem("tb_role", "host");
    router.push(`/room/${code}`);
  }

  async function joinRoom() {
    if (!name.trim()) {
      setError("Enter your name first");
      return;
    }
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError("Room code must be 6 characters");
      return;
    }
    setLoading("join");
    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) {
      setError("Room not found");
      setLoading("");
      return;
    }
    const room = snap.val();
    if (room.status !== "waiting") {
      setError("That game has already started");
      setLoading("");
      return;
    }
    if (room.guest) {
      setError("Room is full");
      setLoading("");
      return;
    }
    await set(ref(db, `rooms/${code}/guest`), {
      name: name.trim(),
      typedCount: 0,
      chars: 0,
      wpm: 0,
      charge: 0,
      ready: false,
    });
    sessionStorage.setItem("tb_name", name.trim());
    sessionStorage.setItem("tb_role", "guest");
    router.push(`/room/${code}`);
  }

  return (
    <main className="min-h-screen bg-[#0e0e0e] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center -mb-12 -mt-16">
          <div className="flex justify-center">
            <Image
              src={TypoLogo}
              alt="Typo Terror Logo"
              width={600} // adjust as needed
              height={200} // adjust as needed
              priority
            />
          </div>
        </div>

        {/* Name input */}
        <div className="mb-6">
          <label className="block text-[10px] tracking-[4px] text-[#444] mb-2">
            YOUR NAME
          </label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="enter username..."
            className="w-full bg-transparent border border-[#222] px-4 py-3 text-[#e8e0c8] text-sm tracking-widest outline-none focus:border-[#e8b84b] transition-colors"
            style={{ fontFamily: "'JetBrains Mono',monospace" }}
            maxLength={18}
          />
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
            onChange={(e) => {
              setJoinCode(e.target.value.toUpperCase());
              setError("");
            }}
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
          <p className="text-[#ff6b6b] text-xs tracking-[3px] mt-4 text-center">
            {error}
          </p>
        )}

        {/* Attacks preview */}
        <div className="mt-12 border-t border-[#141414] pt-8">
          <p className="text-[#333] text-[9px] tracking-[5px] text-center mb-4">
            ATTACKS
          </p>
          <div className="grid grid-cols-3 gap-2">
            {ATTACKS.map((a) => (
              <div
                key={a.id}
                className="bg-[#111] border border-[#1a1a1a] p-3 text-center"
              >
                <div className="text-xs tracking-wider text-[#e8e0c8] mb-1">
                  {a.label}
                </div>
                <div className="text-[10px] text-[#e8b84b]">≥{a.wpm} wpm</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
