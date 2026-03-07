// src/app/layout.js
import "./globals.css";

export const metadata = {
  title: "TypoTerror — Real-time Typing Battle",
  description: "Challenge your friends to a real-time typing battle",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
