"use client";
// src/lib/useTheme.js
import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const stored = localStorage.getItem("tb_theme") || "dark";
    setTheme(stored);
    document.documentElement.setAttribute("data-theme", stored);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("tb_theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return { theme, toggle };
}

// ─── COLOUR TOKENS ───────────────────────────────────────────────────────────
export const DARK = {
  bg:          "#0e0e0e",
  bgCard:      "#111111",
  bgCardAlt:   "#0d0d0d",
  bgCardDark:  "#0a0a0a",
  bgRaised:    "#131313",
  border:      "#1a1a1a",
  borderMid:   "#222222",
  borderSub:   "#141414",
  borderHi:    "#2a2a2a",
  text:        "#e8e0c8",
  textMuted:   "#555555",
  textDim:     "#444444",
  textFaint:   "#333333",
  textGhost:   "#222222",
  playerBg:    "#111111",
  oppBg:       "#0a0a0a",
  wordDone:    "#4aaa66",
  wordDoneC:   "#2a5c38",
  wordPending: "#555555",
  wordPendingC:"#2e2e2e",
};

export const LIGHT = {
  bg:          "#f0ede4",
  bgCard:      "#e6e3da",
  bgCardAlt:   "#dedad1",
  bgCardDark:  "#d6d3ca",
  bgRaised:    "#ece9e0",
  border:      "#ccc9c0",
  borderMid:   "#bab7ae",
  borderSub:   "#d4d1c8",
  borderHi:    "#a8a59c",
  text:        "#1c1914",
  textMuted:   "#6a6560",
  textDim:     "#7a7570",
  textFaint:   "#8a8580",
  textGhost:   "#aaa8a4",
  playerBg:    "#e8e5dc",
  oppBg:       "#dedad1",
  wordDone:    "#2a7a3a",
  wordDoneC:   "#2a7a3a",
  wordPending: "#9a9790",
  wordPendingC:"#9a9790",
};

export function getTokens(theme) {
  return theme === "light" ? LIGHT : DARK;
}