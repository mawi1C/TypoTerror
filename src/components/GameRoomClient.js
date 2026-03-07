"use client";
import dynamic from "next/dynamic";

const GameRoom = dynamic(() => import("@/components/GameRoom"), { ssr: false });

export default function GameRoomClient({ code }) {
  return <GameRoom code={code} />;
}