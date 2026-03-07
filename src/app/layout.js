// src/app/layout.js
import "./globals.css";

export const metadata = {
  title: "TypoTerror",
  description: "Challenge your friends to a real-time typing battle",
  icons: {
    icon: "/icon.png", // Points to public/favicon.ico
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}