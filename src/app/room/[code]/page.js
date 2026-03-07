"use client";
import { use } from "react";
import GameRoom from "@/components/GameRoom";

export default function RoomPage({ params }) {
  const { code } = use(params);
  return <GameRoom code={code} />;
}