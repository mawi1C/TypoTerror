// src/lib/gameData.js

export const WORDS = [
  "the","be","to","of","and","a","in","that","have","it","for","not","on","with",
  "he","as","you","do","at","this","but","his","by","from","they","we","say","her",
  "she","or","an","will","my","one","all","would","there","their","what","so","up",
  "out","if","about","who","get","which","go","me","when","make","can","like","time",
  "no","just","him","know","take","people","into","year","your","good","some","could",
  "them","see","other","than","then","now","look","only","come","over","think","also",
  "back","after","use","two","how","our","work","first","well","way","even","want",
  "because","these","give","most","tell","very","hand","place","great","still","need",
  "large","often","should","number","off","always","move","world","found","those",
  "never","under","might","while","house","example","again","point","play","small",
  "write","school","through","second","thought","between","country","family","keep",
  "children","fact","last","music","body","book","without","once","animal","enough",
  "almost","above","across","hard","near","page","put","study","learn","plant",
  "cover","food","sun","four","between","state","keep","eye","never","last", "kupal",
];

export const ATTACKS = [
  { id: "blur",    label: "👁 BLIND",   desc: "Blurs opponent text for 3s",      wpm: 20, dur: 3000 },
  { id: "shake",   label: "💥 QUAKE",   desc: "Shakes opponent screen for 2s",   wpm: 30, dur: 2000 },
  { id: "ghost",   label: "👻 GHOST",   desc: "Hides opponent typed chars",      wpm: 40, dur: 3000 },
  { id: "freeze",  label: "❄ FREEZE",  desc: "Freezes opponent keyboard for 2s",wpm: 50, dur: 2000 },
  { id: "reverse", label: "🔄 REWIND",  desc: "Deletes 5 opponent words",        wpm: 60, dur: 0    },
  { id: "bomb",    label: "💣 BOMB",    desc: "Adds 10 words to opponent",       wpm: 75, dur: 0    },
];

export const GAME_DURATION = 60; // seconds

export function makeWordList(n = 120) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  return out;
}

export function calcWPM(charsTyped, startTime) {
  const mins = (Date.now() - startTime) / 60000;
  return mins > 0 ? Math.round((charsTyped / 5) / mins) : 0;
}

export function getAttackForWPM(wpm) {
  const eligible = ATTACKS.filter(a => wpm >= a.wpm);
  if (!eligible.length) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

export function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
