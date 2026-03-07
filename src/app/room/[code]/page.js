import GameRoomClient from "@/components/GameRoomClient";

export default async function RoomPage({ params }) {
  const { code } = await params;
  return <GameRoomClient code={code} />;
}