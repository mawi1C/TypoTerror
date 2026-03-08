// src/lib/gameData.js

// ─── WORD POOLS ───────────────────────────────────────────────────────────────

export const WORDS_EASY = [
  "the","be","to","of","and","a","in","that","have","it","for","not","on","with",
  "he","as","you","do","at","this","but","his","by","from","they","we","say","her",
  "she","or","an","will","my","one","all","would","there","what","so","up","out",
  "if","who","get","go","me","when","can","like","time","no","just","him","know",
  "take","into","your","good","some","them","see","than","then","now","look","come",
  "over","back","use","two","how","our","work","well","way","even","want","give",
  "most","tell","very","hand","place","still","need","off","move","found","those",
  "might","while","house","again","point","play","small","fact","last","body","book",
  "once","hard","near","page","put","food","sun","four","eye","run","day","old",
  "new","big","man","top","lot","end","set","try","ask","add","led","red","cut",
];

export const WORDS_MEDIUM = [
  "travel","bridge","justice","frozen","garden","simple","castle","figure","impact",
  "battle","rocket","silver","broken","forest","gentle","happen","island","launch",
  "mirror","nature","object","planet","rabbit","season","signal","silver","temple",
  "unique","valley","window","yellow","arrive","behind","carbon","danger","extend",
  "follow","gather","hidden","inform","jungle","listen","market","narrow","obtain",
  "phrase","prefer","remain","search","stable","target","unless","update","vacant",
  "wander","accept","animal","become","camera","decide","enough","finish","global",
  "happen","injury","kingdom","lesson","method","notice","option","period","player",
  "reason","result","sample","sketch","talent","thread","unlock","vector","wealth",
  "border","course","danger","effect","family","growth","handle","income","jacket",
];

export const WORDS_HARD = [
  // Contractions
  "she's","he's","it's","I'll","you'll","we'll","they'll","I've","you've","we've",
  "they've","I'd","you'd","he'd","she'd","we'd","they'd","I'm","you're","we're",
  "they're","isn't","aren't","wasn't","weren't","don't","doesn't","didn't","won't",
  "wouldn't","couldn't","shouldn't","can't","haven't","hasn't","hadn't","there's",
  "here's","that's","what's","who's","let's","how's","where's","when's","why's",
  // Tricky common words
  "queue","rhythm","syrup","tryst","crypt","glyph","lymph","nymph","pygmy","wryly",
  "steel","wheel","sheet","sweet","greet","fleet","sleet","tweet","bleed","breed",
  "creed","freed","greed","speed","steed","treed","tweed","weeds","needs","seeds",
  "gauge","forge","gorge","surge","purge","merge","verge","hedge","ledge","wedge",
  "judge","nudge","budge","fudge","grudge","smudge","pledge","bridge","fridge",
];

export const DIFFICULTY_LABELS = {
  easy:   { label: "EASY",   color: "#6bffb8", desc: "Common short words" },
  medium: { label: "MEDIUM", color: "#e8b84b", desc: "Everyday vocabulary" },
  hard:   { label: "HARD",   color: "#ff6b6b", desc: "Contractions & tricky words" },
};

export const DIFFICULTIES = ["easy", "medium", "hard"];

// ─── RESOLVE VOTES → DIFFICULTY ──────────────────────────────────────────────
// Majority wins. On a tie, pick randomly from the tied options.
export function resolveDifficulty(votes) {
  const tally = { easy: 0, medium: 0, hard: 0 };
  Object.values(votes).forEach(v => { if (tally[v] !== undefined) tally[v]++; });
  const max = Math.max(...Object.values(tally));
  const tied = DIFFICULTIES.filter(d => tally[d] === max);
  return tied[Math.floor(Math.random() * tied.length)];
}

// ─── ATTACKS ─────────────────────────────────────────────────────────────────
export const ATTACKS = [
  { id: "blur",    label: "👁 BLIND",   desc: "Blurs opponent text for 3s",       wpm: 20, dur: 3000 },
  { id: "shake",   label: "💥 QUAKE",   desc: "Shakes opponent screen for 2s",    wpm: 30, dur: 2000 },
  { id: "ghost",   label: "👻 GHOST",   desc: "Hides opponent typed chars",       wpm: 40, dur: 3000 },
  { id: "freeze",  label: "❄ FREEZE",  desc: "Freezes opponent keyboard for 2s", wpm: 50, dur: 2000 },
  { id: "reverse", label: "🔄 REWIND",  desc: "Deletes 5 opponent words",         wpm: 60, dur: 0    },
  { id: "bomb",    label: "💣 BOMB",    desc: "Adds 10 words to opponent",        wpm: 75, dur: 0    },
];

export const GAME_DURATION = 60;
export const WORD_QUOTA    = 50;
export const MAX_PLAYERS   = 5;
export const PLAYER_KEYS   = ["host", "p2", "p3", "p4", "p5"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
export function makeWordList(n = 120, difficulty = "easy") {
  const pool = difficulty === "hard" ? WORDS_HARD
             : difficulty === "medium" ? WORDS_MEDIUM
             : WORDS_EASY;
  const out = [];
  for (let i = 0; i < n; i++) out.push(pool[Math.floor(Math.random() * pool.length)]);
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