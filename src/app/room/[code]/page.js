// src/app/room/[code]/page.js
import dynamic from "next/dynamic";

const GameRoom = dynamic(() => import("@/components/GameRoom"), { ssr: false });

export default function RoomPage({ params }) {
  return <GameRoom code={params.code} />;
}