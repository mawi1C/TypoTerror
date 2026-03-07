import GameRoomClient from "@/components/GameRoomClient";

export default function RoomPage({ params }) {
  return <GameRoomClient code={params.code} />;
}