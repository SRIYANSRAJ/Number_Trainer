// ===== Core number-system math engine =====
// Pure functions, no DOM. Tested standalone, then embedded in the site.

const DIGIT_CHARS = "0123456789ABCDEF";

function digitVal(ch) { return DIGIT_CHARS.indexOf(ch.toUpperCase()); }
function valDigit(v) { return DIGIT_CHARS[v]; }

function isValidInBase(str, base) {
  str = str.toUpperCase();
  for (const ch of str) {
    const v = digitVal(ch);
    if (v === -1 || v >= base) return false;
  }
  return str.length > 0;
}

// ---- Integer <-> base ----
function intToBase(n, base) {
  if (n === 0) return "0";
  let s = "";
  n = Math.floor(Math.abs(n));
  while (n > 0) { s = valDigit(n % base) + s; n = Math.floor(n / base); }
  return s;
}
function baseToInt(str, base) {
  str = str.toUpperCase();
  let n = 0;
  for (const ch of str) n = n * base + digitVal(ch);
  return n;
}

// division ladder steps for decimal(or any)->base integer conversion
function divisionLadder(n, base) {
  const steps = [];
  n = Math.floor(n);
  if (n === 0) return [{ before: 0, quotient: 0, remainder: 0 }];
  while (n > 0) {
    const q = Math.floor(n / base);
    const r = n % base;
    steps.push({ before: n, quotient: q, remainder: r });
    n = q;
  }
  return steps;
}
// read remainders bottom-to-top -> string
function ladderToDigits(steps) {
  return steps.map(s => valDigit(s.remainder)).reverse().join("");
}

// ---- Fraction <-> base ----
function fracToBase(frac, base, precision = 6) {
  const steps = [];
  let f = frac - Math.floor(frac);
  for (let i = 0; i < precision && f > 1e-9; i++) {
    const mult = f * base;
    const digit = Math.floor(mult + 1e-9);
    steps.push({ before: f, mult, digit });
    f = mult - digit;
  }
  return steps;
}
function fracStepsToDigits(steps) { return steps.map(s => valDigit(s.digit)).join(""); }

function fracBaseToDecimal(str, base) {
  let val = 0;
  for (let i = 0; i < str.length; i++) val += digitVal(str[i]) * Math.pow(base, -(i + 1));
  return val;
}

// full number "IIII.FFFF" (given base) -> decimal float
function toDecimal(str, base) {
  const [intPart, fracPart] = str.split(".");
  let v = baseToInt(intPart || "0", base);
  if (fracPart) v += fracBaseToDecimal(fracPart, base);
  return v;
}
// decimal float -> "IIII.FFFF" in target base
function fromDecimal(value, base, precision = 6) {
  const intPart = Math.floor(Math.abs(value));
  const fracVal = Math.abs(value) - intPart;
  const intStr = intToBase(intPart, base);
  if (fracVal < 1e-9) return intStr;
  const steps = fracToBase(fracVal, base, precision);
  return intStr + "." + fracStepsToDigits(steps);
}

// ---- Binary grouping bridges ----
function padLeft(s, len, ch = "0") { while (s.length < len) s = ch + s; return s; }
function padRight(s, len, ch = "0") { while (s.length < len) s = s + ch; return s; }

// group a binary string into chunks of `size`, integer part from the right,
// fractional part from the left (after the point)
function groupBinary(binStr, size) {
  let [intPart, fracPart] = binStr.split(".");
  intPart = padLeft(intPart, Math.ceil(intPart.length / size) * size);
  const intGroups = [];
  for (let i = 0; i < intPart.length; i += size) intGroups.push(intPart.slice(i, i + size));
  let fracGroups = [];
  if (fracPart) {
    fracPart = padRight(fracPart, Math.ceil(fracPart.length / size) * size);
    for (let i = 0; i < fracPart.length; i += size) fracGroups.push(fracPart.slice(i, i + size));
  }
  return { intGroups, fracGroups };
}

function binToOct(binStr) {
  const { intGroups, fracGroups } = groupBinary(binStr, 3);
  const intOct = intGroups.map(g => valDigit(baseToInt(g, 2))).join("").replace(/^0+(?=\d)/, "");
  const fracOct = fracGroups.map(g => valDigit(baseToInt(g, 2))).join("");
  return fracOct ? `${intOct}.${fracOct}` : intOct;
}
function binToHex(binStr) {
  const { intGroups, fracGroups } = groupBinary(binStr, 4);
  const intHex = intGroups.map(g => valDigit(baseToInt(g, 2))).join("").replace(/^0+(?=[0-9A-F])/, "");
  const fracHex = fracGroups.map(g => valDigit(baseToInt(g, 2))).join("");
  return fracHex ? `${intHex}.${fracHex}` : intHex;
}
function octToBin(octStr) {
  const [i, f] = octStr.split(".");
  const intBin = i.split("").map(ch => padLeft(intToBase(digitVal(ch), 2), 3)).join("").replace(/^0+(?=\d)/, "");
  const fracBin = f ? f.split("").map(ch => padLeft(intToBase(digitVal(ch), 2), 3)).join("") : "";
  return fracBin ? `${intBin || "0"}.${fracBin}` : (intBin || "0");
}
function hexToBin(hexStr) {
  const [i, f] = hexStr.split(".");
  const intBin = i.split("").map(ch => padLeft(intToBase(digitVal(ch), 2), 4)).join("").replace(/^0+(?=\d)/, "");
  const fracBin = f ? f.split("").map(ch => padLeft(intToBase(digitVal(ch), 2), 4)).join("") : "";
  return fracBin ? `${intBin || "0"}.${fracBin}` : (intBin || "0");
}
function octToHex(octStr) { return binToHex(octToBin(octStr)); }
function hexToOct(hexStr) { return binToOct(hexToBin(hexStr)); }

// ---- Column addition with explicit carry trail ----
// aStr, bStr: integer digit strings in `base` (no point, right-aligned by caller)
function addColumns(aStr, bStr, base) {
  // align by radix point
  let aParts = aStr.split('.');
  let bParts = bStr.split('.');
  let fracLen = Math.max(aParts[1] ? aParts[1].length : 0, bParts[1] ? bParts[1].length : 0);
  let intLen = Math.max(aParts[0].length, bParts[0].length);
  
  aStr = padLeft(aParts[0], intLen);
  if (fracLen > 0) aStr += '.' + (aParts[1] || '').padEnd(fracLen, '0');
  
  bStr = padLeft(bParts[0], intLen);
  if (fracLen > 0) bStr += '.' + (bParts[1] || '').padEnd(fracLen, '0');

  const cols = [];
  let carry = 0;
  for (let i = aStr.length - 1; i >= 0; i--) {
    if (aStr[i] === '.') {
      cols.unshift({ isPoint: true, char: '.' });
      continue;
    }
    const a = digitVal(aStr[i]), b = digitVal(bStr[i]);
    const total = a + b + carry;
    const resultDigit = total % base;
    const carryOut = total >= base ? 1 : 0;
    cols.unshift({ a, b, carryIn: carry, total, resultDigit, carryOut });
    carry = carryOut;
  }
  let resultStr = cols.map(c => c.isPoint ? '.' : valDigit(c.resultDigit)).join("");
  if (carry) resultStr = valDigit(carry) + resultStr;
  return { cols, finalCarry: carry, resultStr };
}

// ---- Column subtraction with explicit borrow trail ----
function subColumns(aStr, bStr, base) {
  let aParts = aStr.split('.');
  let bParts = bStr.split('.');
  let fracLen = Math.max(aParts[1] ? aParts[1].length : 0, bParts[1] ? bParts[1].length : 0);
  let intLen = Math.max(aParts[0].length, bParts[0].length);
  
  aStr = padLeft(aParts[0], intLen);
  if (fracLen > 0) aStr += '.' + (aParts[1] || '').padEnd(fracLen, '0');
  
  bStr = padLeft(bParts[0], intLen);
  if (fracLen > 0) bStr += '.' + (bParts[1] || '').padEnd(fracLen, '0');

  const cols = [];
  let borrow = 0;
  for (let i = aStr.length - 1; i >= 0; i--) {
    if (aStr[i] === '.') {
      cols.unshift({ isPoint: true, char: '.' });
      continue;
    }
    let a = digitVal(aStr[i]) - borrow;
    const b = digitVal(bStr[i]);
    let borrowOut = 0;
    if (a < b) { a += base; borrowOut = 1; }
    const resultDigit = a - b;
    cols.unshift({ aOrig: digitVal(aStr[i]), b, borrowIn: borrow, borrowOut, resultDigit });
    borrow = borrowOut;
  }
  let resultStr = cols.map(c => c.isPoint ? '.' : valDigit(c.resultDigit)).join("");
  resultStr = resultStr.replace(/^0+(?=[0-9A-F])/, "");
  if (resultStr.startsWith('.')) resultStr = "0" + resultStr;
  return { cols, finalBorrow: borrow, resultStr };
}

const CORE_EXPORTS = {
  DIGIT_CHARS, digitVal, valDigit, isValidInBase,
  intToBase, baseToInt, divisionLadder, ladderToDigits,
  fracToBase, fracStepsToDigits, fracBaseToDecimal,
  toDecimal, fromDecimal, padLeft, padRight,
  groupBinary, binToOct, binToHex, octToBin, hexToBin, octToHex, hexToOct,
  addColumns, subColumns
};
if (typeof module !== "undefined") module.exports = CORE_EXPORTS;

/* ============================================================
   NUMBER SYSTEMS — visual classroom
   Application layer: state, router, shared render helpers
   ============================================================ */

const BASE_INFO = {
  2:  { key: "bin", name: "Binary",      digits: "01",                 desc: "Only two symbols exist: 0 and 1. Every computer circuit is really just a switch that is off or on — so binary is the native language of machines.", color: "var(--bin)" },
  8:  { key: "oct", name: "Octal",       digits: "01234567",           desc: "Eight symbols, 0 through 7. Octal groups binary digits three at a time, which once made long binary strings easier for humans to read.", color: "var(--oct)" },
  10: { key: "dec", name: "Decimal",     digits: "0123456789",         desc: "Ten symbols, 0 through 9 — the system you already use every day, almost certainly because humans have ten fingers.", color: "var(--dec)" },
  16: { key: "hex", name: "Hexadecimal", digits: "0123456789ABCDEF",   desc: "Sixteen symbols — 0 through 9, then A through F stand in for ten through fifteen. Hex groups binary four bits at a time, matching how memory is organized.", color: "var(--hex)" }
};
const HEX_LETTER_NAMES = { A: "ten", B: "eleven", C: "twelve", D: "thirteen", E: "fourteen", F: "fifteen" };

// ---------------- STATE ----------------
const STATE = {
  page: "home",
  sidebarOpen: false,
  progress: {
    // per topic key: {attempted, correct}
    topics: {
      conversion: { attempted: 0, correct: 0 },
      addition: { attempted: 0, correct: 0 },
      subtraction: { attempted: 0, correct: 0 },
      multiplication: { attempted: 0, correct: 0 },
      radix: { attempted: 0, correct: 0 }
    },
    mistakes: {},        // mistakeType -> count
    completedModules: {},// moduleId -> true
    streak: 0,
    bestStreak: 0,
    totalTime: 0,
    totalAnswered: 0
  }
};

function recordAnswer(topic, correct, mistakeType, elapsedMs) {
  const t = STATE.progress.topics[topic];
  if (t) { t.attempted++; if (correct) t.correct++; }
  STATE.progress.totalAnswered++;
  if (correct) {
    STATE.progress.streak++;
    STATE.progress.bestStreak = Math.max(STATE.progress.bestStreak, STATE.progress.streak);
  } else {
    STATE.progress.streak = 0;
    if (mistakeType) STATE.progress.mistakes[mistakeType] = (STATE.progress.mistakes[mistakeType] || 0) + 1;
  }
  if (elapsedMs) STATE.progress.totalTime += elapsedMs;
}
function markModuleDone(id) { STATE.progress.completedModules[id] = true; }
function topicPct(key) {
  const t = STATE.progress.topics[key];
  if (!t || t.attempted === 0) return 0;
  return Math.round((t.correct / t.attempted) * 100);
}

// ---------------- NAV CONFIG ----------------
const NAV = [
  { group: "Practice", items: [
    { id: "trainer", label: "← Back to Trainer", dot: "var(--ink-faint)" }
  ]},
  { group: "Start", items: [
    { id: "home", label: "Home", dot: "#fff" }
  ]},
  { group: "Foundations", items: [
    { id: "m1", label: "1 · What is a Number System?", dot: "var(--dec)" },
    { id: "m2", label: "2 · Understanding the Base", dot: "var(--dec)" },
    { id: "chart", label: "Digit Charts", dot: "var(--dec)" }
  ]},
  { group: "Bridges Between Bases", items: [
    { id: "m3", label: "3 · Binary ↔ Octal", dot: "var(--bin)" },
    { id: "m4", label: "4 · Binary ↔ Hexadecimal", dot: "var(--bin)" },
    { id: "m5", label: "5 · Octal ↔ Hexadecimal", dot: "var(--oct)" },
    { id: "m6", label: "6 · Decimal Conversions", dot: "var(--dec)" },
    { id: "m7", label: "7 · Radix Points", dot: "var(--dec)" }
  ]},
  { group: "Arithmetic", items: [
    { id: "carry", label: "Carry Visualizer", dot: "var(--carry)" },
    { id: "m8", label: "8 · Addition", dot: "var(--carry)" },
    { id: "m9", label: "9 · Subtraction & Borrowing", dot: "var(--borrow)" },
    { id: "chainborrow", label: "Chain Borrowing", dot: "var(--borrow)" },
    { id: "complement", label: "10 · Complement Method", dot: "var(--hex)" },
    { id: "multiply", label: "11 · Multiplication", dot: "var(--oct)" }
  ]}
];

// ---------------- ROUTER ----------------
const PAGE_RENDERERS = {}; // id -> { render: ()=>html, init: (root)=>void }
function registerPage(id, render, init) { PAGE_RENDERERS[id] = { render, init }; }

function navigate(id, opts) {
  if (id === "trainer") {
    window.location.href = "index1.html";
    return;
  }
  if (!PAGE_RENDERERS[id]) id = "home";
  STATE.page = id;
  STATE.sidebarOpen = false;
  renderApp();
  if (!(opts && opts.noScroll)) window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

function renderShell() {
  return `
  <div class="sidebar-scrim ${STATE.sidebarOpen ? "show" : ""}" id="scrim"></div>
  <div class="app-shell">
    <aside class="sidebar ${STATE.sidebarOpen ? "open" : ""}" id="sidebar">
      ${renderSidebarInner()}
    </aside>
    <div class="main">
      <div class="topbar">
        <button class="hamburger" id="hamburgerBtn" aria-label="Open menu"><span></span><span></span><span></span></button>
        <div class="brand-name" style="font-size:15px;">Number Systems</div>
      </div>
      <main class="page" id="app">${renderCurrentPage()}</main>
    </div>
  </div>
  <button class="cheat-fab" id="cheatFab">📋 Cheat Sheet</button>
  <div id="modalRoot"></div>
  `;
}

function renderSidebarInner() {
  let html = `
  <button class="brand" data-nav="home">
    <div class="brand-mark">01</div>
    <div>
      <div class="brand-name">Number Systems</div>
      <div class="brand-sub">a visual classroom</div>
    </div>
  </button>`;
  NAV.forEach(g => {
    html += `<div class="nav-group"><div class="nav-group-label">${g.group}</div>`;
    g.items.forEach(it => {
      const active = STATE.page === it.id;
      const done = STATE.progress.completedModules[it.id];
      html += `<button class="nav-item ${active ? "active" : ""} ${done ? "done" : ""}" style="--dot-color:${it.dot}" data-nav="${it.id}">
        <span class="nav-dot"></span><span>${it.label}</span><span class="nav-check">✓</span>
      </button>`;
    });
    html += `</div>`;
  });
  html += `<div class="sidebar-foot">Learn it, see it, prove it.<br>Binary · Octal · Decimal · Hex</div>`;
  return html;
}

function renderCurrentPage() {
  const p = PAGE_RENDERERS[STATE.page];
  if (!p) return "<p>Not found.</p>";
  
  const orderedPages = [];
  for (const group of NAV) {
    if (group.group === "Practice") continue;
    for (const item of group.items) {
      orderedPages.push({ id: item.id, label: item.label });
    }
  }

  const currentIndex = orderedPages.findIndex(item => item.id === STATE.page);
  let navHtml = '';
  
  if (STATE.page === "detailed-animation") {
    navHtml += `
      <div style="margin-top:40px; padding-top:24px; border-top:1px solid var(--border); text-align:center;">
        <button class="btn btn-primary" onclick="window.history.back()" style="padding:10px 20px;">← Back to Practice</button>
      </div>
    `;
  } else if (currentIndex !== -1 && orderedPages.length > 1) {
    const prev = currentIndex > 0 ? orderedPages[currentIndex - 1] : null;
    const next = currentIndex < orderedPages.length - 1 ? orderedPages[currentIndex + 1] : null;

    navHtml += `
      <div style="display:flex; justify-content:space-between; margin-top:40px; padding-top:24px; border-top:1px solid var(--border); gap:16px;">
        ${prev ? `<button class="btn btn-ghost" onclick="navigate('${prev.id}')" style="flex:1; justify-content:flex-start; text-align:left; max-width:50%;">
          <span style="font-size:12px; color:var(--item-subtext); display:block;">← Previous</span>
          <span style="font-size:14px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${prev.label}</span>
        </button>` : `<div style="flex:1"></div>`}
        ${next ? `<button class="btn btn-ghost" onclick="navigate('${next.id}')" style="flex:1; justify-content:flex-end; text-align:right; max-width:50%;">
          <span style="font-size:12px; color:var(--item-subtext); display:block;">Next →</span>
          <span style="font-size:14px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${next.label}</span>
        </button>` : `<div style="flex:1"></div>`}
      </div>
    `;
  }
  
  return p.render() + navHtml;
}

function renderApp() {
  const root = document.getElementById("root");
  root.innerHTML = renderShell();
  const p = PAGE_RENDERERS[STATE.page];
  if (p && p.init) p.init(document.getElementById("app"));
}

// Attached ONCE at bootstrap. #root itself is never replaced (only its
// innerHTML is), so a single delegated listener here safely covers every
// re-render — attaching fresh listeners inside renderApp would stack up.
function initGlobalDelegation() {
  const root = document.getElementById("root");
  root.addEventListener("click", (e) => {
    const navEl = e.target.closest("[data-nav]");
    if (navEl) { navigate(navEl.getAttribute("data-nav")); return; }
    if (e.target.closest("#hamburgerBtn")) { STATE.sidebarOpen = true; renderApp(); return; }
    if (e.target.id === "scrim") { STATE.sidebarOpen = false; renderApp(); return; }
    if (e.target.closest("#cheatFab")) { openCheatSheet(); return; }
  });
}

// ---------------- MODAL ----------------
function openModal(html) {
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-scrim" id="modalScrim">
      <div class="modal" role="dialog" aria-modal="true">${html}</div>
    </div>`;
  document.getElementById("modalScrim").addEventListener("click", (e) => {
    if (e.target.id === "modalScrim") closeModal();
  });
  const closeBtn = document.getElementById("modalCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
}
function closeModal() { document.getElementById("modalRoot").innerHTML = ""; }

/* ============================================================
   SHARED RENDER HELPERS
   ============================================================ */
function baseKey(base) { return BASE_INFO[base].key; }

function digitBox(ch, opts) {
  opts = opts || {};
  const cls = ["digit-box"];
  if (opts.base) cls.push(baseKey(opts.base));
  if (opts.size) cls.push(opts.size);
  if (opts.filled) cls.push("filled");
  if (opts.clickable) cls.push("clickable");
  if (opts.state) cls.push(opts.state); // active, correct, wrong, pop, ghost
  if (opts.extra) cls.push(opts.extra);
  const dataAttrs = opts.data ? Object.keys(opts.data).map(k => `data-${k}="${opts.data[k]}"`).join(" ") : "";
  const style = opts.style ? `style="${opts.style}"` : "";
  return `<div class="${cls.join(" ")}" ${dataAttrs} ${style}>${ch}</div>`;
}

function ledgerRow(digits, opts) {
  // digits: array of {ch, label, value, base, ...}
  opts = opts || {};
  let html = `<div class="ledger ${opts.center ? "center" : ""}">`;
  digits.forEach((d, i) => {
    if (d.point) { html += `<div class="digit-slot"><div class="digit-box point">.</div><div class="place-label">&nbsp;</div></div>`; return; }
    html += `<div class="digit-slot">
      ${digitBox(d.ch, { base: d.base, size: opts.size, filled: d.filled, clickable: opts.clickable, state: d.state, data: opts.clickable ? { idx: i } : null })}
      ${d.label !== undefined ? `<div class="place-label">${d.label}</div>` : ""}
    </div>`;
  });
  html += `</div>`;
  return html;
}

function panel(label, title, sub, bodyHtml) {
  return `<div class="panel">
    ${label ? `<span class="panel-label">${label}</span>` : ""}
    ${title ? `<h3>${title}</h3>` : ""}
    ${sub ? `<p class="panel-sub">${sub}</p>` : ""}
    ${bodyHtml || ""}
  </div>`;
}

function railBlock(label, title, sub, bodyHtml) {
  return `<div class="rail-block">${panel(label, title, sub, bodyHtml)}</div>`;
}

function lessonHeader(kicker, title, lede) {
  return `<span class="section-kicker">${kicker}</span>
  <h1 class="section-title" style="font-size:32px;margin-bottom:10px;">${title}</h1>
  <p class="section-lede">${lede}</p>`;
}

function whyGrid(items) {
  // items: [{label, text}]
  return `<div class="why-grid">${items.map(i => `<div class="why-item"><b>${i.label}</b>${i.text}</div>`).join("")}</div>`;
}

function callout(text, kind) {
  return `<div class="callout ${kind || ""}">${text}</div>`;
}

function badge(base) {
  const info = BASE_INFO[base];
  return `<span class="badge badge-${info.key}">${info.name} · base ${base}</span>`;
}


/* ============================================================
   QUIZ ENGINE (generic — used by every module's Quick Test
   and by the Practice Engine)
   ============================================================ */
function normAns(s) { return String(s).trim().toUpperCase().replace(/\s+/g, ""); }

function runQuiz(container, questions, opts) {
  opts = opts || {};
  const qstate = { idx: 0, correctCount: 0, answered: false, startTime: Date.now() };

  function renderQuiz() {
    const q = questions[qstate.idx];
    if (!q) { renderSummary(); return; }
    const dots = questions.map((qq, i) => {
      let cls = "quiz-dot";
      if (i === qstate.idx) cls += " current";
      else if (qq._result === true) cls += " done";
      else if (qq._result === false) cls += " wrong";
      return `<div class="${cls}"></div>`;
    }).join("");

    let bodyInner = "";
    if (q.type === "mc") {
      bodyInner = `<div class="quiz-options">${q.options.map((o, i) =>
        `<button class="quiz-opt" data-opt="${i}">${o}</button>`).join("")}</div>`;
    } else {
      bodyInner = `<input type="text" class="quiz-input mono" id="quizTextInput" placeholder="Type your answer" autocomplete="off" />
        <div style="margin-top:12px;"><button class="btn btn-primary btn-sm" id="quizSubmitBtn">Check</button></div>`;
    }

    container.innerHTML = `
      <div class="quiz-card">
        <div class="quiz-progress">${dots}</div>
        <div class="mono" style="font-size:11px;color:var(--ink-faint);margin-bottom:8px;">Question ${qstate.idx + 1} of ${questions.length}</div>
        ${q.visualHtml ? `<div style="margin-bottom:14px;">${q.visualHtml}</div>` : ""}
        <div class="quiz-q">${q.prompt}</div>
        <div id="quizBody">${bodyInner}</div>
        <div id="quizFeedback"></div>
      </div>`;

    if (q.type === "mc") {
      container.querySelectorAll(".quiz-opt").forEach(btn => {
        btn.addEventListener("click", () => submitAnswer(q, btn.getAttribute("data-opt")));
      });
    } else {
      const submitBtn = document.getElementById("quizSubmitBtn");
      const input = document.getElementById("quizTextInput");
      input.focus();
      const doSubmit = () => submitAnswer(q, input.value);
      submitBtn.addEventListener("click", doSubmit);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") doSubmit(); });
    }
  }

  function submitAnswer(q, rawAnswer) {
    if (qstate.answered) return;
    qstate.answered = true;
    let isCorrect;
    let displayAnswer = rawAnswer;
    if (q.type === "mc") {
      displayAnswer = q.options[rawAnswer];
      isCorrect = String(rawAnswer) === String(q.correctIndex);
      container.querySelectorAll(".quiz-opt").forEach((btn, i) => {
        btn.disabled = true;
        if (i === q.correctIndex) btn.classList.add("reveal-correct");
        if (String(i) === String(rawAnswer) && !isCorrect) btn.classList.add("selected-wrong");
        if (String(i) === String(rawAnswer) && isCorrect) btn.classList.add("selected-correct");
      });
    } else {
      isCorrect = normAns(rawAnswer) === normAns(q.correct);
      const input = document.getElementById("quizTextInput");
      const submitBtn = document.getElementById("quizSubmitBtn");
      input.disabled = true; submitBtn.disabled = true;
      input.style.borderColor = isCorrect ? "var(--carry)" : "var(--borrow)";
    }

    q._result = isCorrect;
    if (isCorrect) qstate.correctCount++;
    let mistakeType = null;
    let explainText = q.explain || "";
    if (!isCorrect) {
      if (q.wrongExplain) explainText = q.wrongExplain(displayAnswer);
      mistakeType = q.mistakeType || "general";
    }
    recordAnswer(q.topic || opts.topic || "conversion", isCorrect, mistakeType, 4000);

    const fb = document.getElementById("quizFeedback");
    fb.innerHTML = `<div class="quiz-feedback ${isCorrect ? "correct" : "wrong"}">
        <b>${isCorrect ? "Correct." : "Not quite."}</b>${explainText}
      </div>
      <div class="quiz-foot">
        <span></span>
        <button class="btn btn-primary btn-sm" id="quizNextBtn">${qstate.idx === questions.length - 1 ? "See results" : "Next →"}</button>
      </div>`;
    document.getElementById("quizNextBtn").addEventListener("click", () => {
      qstate.idx++; qstate.answered = false; renderQuiz();
    });
  }

  function renderSummary() {
    const pct = Math.round((qstate.correctCount / questions.length) * 100);
    if (opts.moduleId) markModuleDone(opts.moduleId);
    container.innerHTML = `<div class="panel mastered-panel">
      <span class="panel-label">Mastered?</span>
      <div class="score mono" style="color:${pct >= 70 ? "var(--carry)" : pct >= 40 ? "var(--dec)" : "var(--borrow)"}">${qstate.correctCount}/${questions.length}</div>
      <p style="margin-top:8px;">${pct >= 70 ? "Solid — that concept is sticking." : pct >= 40 ? "Getting there. One more pass will lock it in." : "This one needs another look before moving on."}</p>
      <div class="mastered-actions">
        <button class="btn btn-ghost" id="retryQuizBtn">Retry</button>
        ${opts.nextId ? `<button class="btn btn-primary" id="continueBtn">Continue →</button>` : ""}
      </div>
    </div>`;
    document.getElementById("retryQuizBtn").addEventListener("click", () => {
      questions.forEach(q => { q._result = undefined; });
      qstate.idx = 0; qstate.correctCount = 0; qstate.answered = false;
      renderQuiz();
    });
    const cb = document.getElementById("continueBtn");
    if (cb) cb.addEventListener("click", () => navigate(opts.nextId));
    if (opts.onDone) opts.onDone(pct);
  }

  renderQuiz();
}

/* ============================================================
   PAGE: HOME
   ============================================================ */
registerPage("home", function () {
  const cards = [2, 8, 10, 16].map(b => {
    const info = BASE_INFO[b];
    const digitsPreview = info.digits.split("").slice(0, 10).map(d => digitBox(d, { base: b, size: "sm" })).join("");
    return `<button class="base-card" style="--accent:${info.color}" data-nav="${b === 2 ? "m3" : b === 8 ? "m3" : b === 10 ? "m6" : "m4"}">
      <div>
        <div class="base-n">BASE ${b}</div>
        <div class="base-name">${info.name}</div>
      </div>
      <div class="base-digits">${digitsPreview}</div>
      <p class="base-desc">${info.desc}</p>
      <div class="base-cta">Learn ${info.name} →</div>
    </button>`;
  }).join("");

  return `
    <div class="hero fade-in">
      <div class="hero-eyebrow">
        <span class="seq"><b>0</b> <b>1</b> <b>10</b> <b>11</b> <b>100</b></span>
        · a visual classroom for number systems
      </div>
      <h1>Master Number Systems <span class="accent">Visually</span></h1>
      <p class="hero-sub"><b>Binary · Octal · Decimal · Hexadecimal</b> — learn, see, and practice. No wall of formulas: every carry, borrow, and conversion is something you watch happen, one digit at a time.</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <button class="btn btn-primary" data-nav="m1">Start from zero →</button>
        <button class="btn btn-ghost" data-nav="chart">Open the digit charts</button>
      </div>
    </div>

    <div class="base-grid">${cards}</div>

    <div class="relate-wrap">
      <div class="relate-title">How the four systems relate</div>
      <div class="relate-sub">Binary is the bridge. Once you can read binary, octal and hex are just shortcuts for reading it faster.</div>
      <div class="relate-diagram">
        <div class="relate-node n-oct" style="--accent:var(--oct);--accent-soft:var(--oct-soft);">OCTAL<br><span style="font-weight:400;font-size:11px;">base 8</span></div>
        <div class="relate-arrow a-ob"><span class="glyph">↕</span>3-bit groups</div>
        <div class="relate-node n-bin" style="--accent:var(--bin);--accent-soft:var(--bin-soft);">BINARY<br><span style="font-weight:400;font-size:11.5px;">base 2 · the bridge</span></div>
        <div class="relate-node n-hex" style="--accent:var(--hex);--accent-soft:var(--hex-soft);">HEX<br><span style="font-weight:400;font-size:11px;">base 16</span></div>
        <div class="relate-arrow a-hb"><span class="glyph">↔</span>4-bit groups</div>
        <div class="relate-node n-dec" style="--accent:var(--dec);--accent-soft:var(--dec-soft);">DECIMAL<br><span style="font-weight:400;font-size:11px;">base 10</span></div>
        <div class="relate-arrow a-bd"><span class="glyph">↔</span>÷ and ×</div>
      </div>
      <button class="btn btn-ghost btn-sm" style="margin-top:18px;" data-nav="m5">See octal ↔ hex through the binary bridge →</button>
    </div>

    <span class="section-kicker">Jump into a lesson</span>
    <h2 class="section-title" style="margin-bottom:18px;">Every module, in order</h2>
    <div class="home-grid-modules">
      ${NAV.flatMap(g => g.items).filter(i => i.id !== "home").map(i => `
        <button class="mod-tile" data-nav="${i.id}">
          <div class="mt-label">${STATE.progress.completedModules[i.id] ? "✓ practiced" : "not started"}</div>
          <div class="mt-title">${i.label}</div>
        </button>`).join("")}
    </div>

    <div class="footer-note">Built as an interactive visual classroom — the goal isn't memorizing tricks, it's seeing why every trick works.</div>
  `;
}, function (root) {
  // nav handled by delegated root listener
});

/* ============================================================
   MODULE 1 — What is a Number System? (place value)
   ============================================================ */
function placeValueLedgerHTML(numStr, base, idPrefix) {
  const digits = numStr.split("");
  const n = digits.length;
  let html = `<div class="ledger center" id="${idPrefix}-ledger">`;
  digits.forEach((d, i) => {
    const power = n - 1 - i;
    const placeVal = Math.pow(base, power);
    html += `<div class="digit-slot">
      ${digitBox(d, { base, size: "lg", clickable: true, data: { idx: i } })}
      <div class="place-label">${base}<sup>${power}</sup> = ${placeVal}</div>
    </div>`;
  });
  html += `</div>`;
  return html;
}
function contributionRowHTML(numStr, base, idPrefix) {
  const digits = numStr.split("");
  const n = digits.length;
  let html = `<div id="${idPrefix}-contrib" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:16px;font-family:var(--font-mono);font-size:13px;"></div>`;
  return html;
}
function initPlaceValueExplorer(root, numStr, base, idPrefix) {
  const digits = numStr.split("");
  const n = digits.length;
  const revealed = new Set();
  const ledger = root.querySelector(`#${idPrefix}-ledger`);
  const contribWrap = root.querySelector(`#${idPrefix}-contrib`);
  const sumLine = root.querySelector(`#${idPrefix}-sum`);

  function renderContrib() {
    let parts = [];
    for (let i = 0; i < n; i++) {
      const power = n - 1 - i;
      const val = digitVal(digits[i]) * Math.pow(base, power);
      if (revealed.has(i)) {
        parts.push(`<span class="badge badge-${baseKey(base)}" style="font-size:12.5px;">${digits[i]}×${Math.pow(base, power)} = ${val}</span>`);
      }
    }
    contribWrap.innerHTML = parts.length ? parts.join(`<span style="color:var(--ink-faint);">+</span>`) : `<span style="color:var(--ink-faint);">Click a box above to reveal what it contributes.</span>`;
    if (sumLine) {
      if (revealed.size === n) {
        let total = 0;
        for (let i = 0; i < n; i++) total += digitVal(digits[i]) * Math.pow(base, n - 1 - i);
        sumLine.innerHTML = `<div class="callout carry-note" style="margin-top:12px;">All positions revealed — added together, they total <b class="mono">${total}</b> in decimal.</div>`;
      } else {
        sumLine.innerHTML = "";
      }
    }
  }
  ledger.querySelectorAll(".digit-box.clickable").forEach(box => {
    box.addEventListener("click", () => {
      const idx = parseInt(box.getAttribute("data-idx"), 10);
      box.classList.toggle("active");
      if (revealed.has(idx)) revealed.delete(idx); else { revealed.add(idx); box.classList.add("pop"); }
      renderContrib();
    });
  });
  renderContrib();
}

registerPage("m1", function () {
  return `
  ${lessonHeader("Module 1 · Foundations", "What Is a Number System?", "Start from zero: every number system is just a rule for what a position is worth.")}
  <div class="rail">
    ${railBlock("Concept", "Every position has a value", "Look at an ordinary decimal number. Each box below sits in a position — and that position has a value, whether or not any digit is there to fill it.", `
      ${placeValueLedgerHTML("3527", 10, "pv-dec")}
      ${contributionRowHTML("3527", 10, "pv-dec")}
      <div id="pv-dec-sum"></div>
      ${whyGrid([
        { label: "What's happening", text: "3527 isn't one thing — it's four digits, each sitting in a position worth a different amount." },
        { label: "Why", text: "Positions let a handful of symbols (0–9) represent numbers of any size, just by where a digit sits." },
        { label: "What changes", text: "The value a digit contributes changes completely depending on which position it's in." },
        { label: "What stays the same", text: "The digit itself — a '5' is always 'five of whatever this position is worth.'" }
      ])}
    `)}

    ${railBlock("Visual", "The same idea, in binary", "Binary has only two symbols, but positions still work exactly the same way — they're just worth powers of 2 instead of powers of 10.", `
      ${placeValueLedgerHTML("10110", 2, "pv-bin")}
      ${contributionRowHTML("10110", 2, "pv-bin")}
      <div id="pv-bin-sum"></div>
      ${callout("Click every box in both diagrams above. Notice: decimal positions are worth 1, 10, 100, 1000 — binary positions are worth 1, 2, 4, 8, 16. Same idea, different multiplier.", "tip")}
    `)}

    ${railBlock("Watch it happen", "Octal and hexadecimal too", "The pattern repeats for every base you'll meet in this course. Only the multiplier changes.", `
      <div class="tool-grid">
        <div>
          <div class="badge badge-oct" style="margin-bottom:10px;">Octal · base 8</div>
          ${placeValueLedgerHTML("572", 8, "pv-oct")}
          ${contributionRowHTML("572", 8, "pv-oct")}
          <div id="pv-oct-sum"></div>
        </div>
        <div>
          <div class="badge badge-hex" style="margin-bottom:10px;">Hexadecimal · base 16</div>
          ${placeValueLedgerHTML("2F", 16, "pv-hex")}
          ${contributionRowHTML("2F", 16, "pv-hex")}
          <div id="pv-hex-sum"></div>
        </div>
      </div>
    `)}

    ${railBlock("Your turn", "Predict before you click", "Before revealing each contribution below, guess out loud what it should be. Then check yourself.", `
      ${placeValueLedgerHTML("1101", 2, "pv-quiz")}
      ${contributionRowHTML("1101", 2, "pv-quiz")}
      <div id="pv-quiz-sum"></div>
    `)}

    ${railBlock("Quick Test", "Check your understanding", "3–5 questions on what you just learned.", `<div id="m1-quiz"></div>`)}
  </div>
  `;
}, function (root) {
  initPlaceValueExplorer(root, "3527", 10, "pv-dec");
  initPlaceValueExplorer(root, "10110", 2, "pv-bin");
  initPlaceValueExplorer(root, "572", 8, "pv-oct");
  initPlaceValueExplorer(root, "2F", 16, "pv-hex");
  initPlaceValueExplorer(root, "1101", 2, "pv-quiz");

  const questions = [
    { type: "mc", topic: "conversion", mistakeType: "place-value",
      prompt: "In the decimal number 3527, what does the digit 5 contribute?",
      options: ["5", "50", "500", "5000"], correctIndex: 2,
      explain: "The 5 sits in the hundreds position (10²), so it contributes 5 × 100 = 500." },
    { type: "mc", topic: "conversion", mistakeType: "place-value",
      prompt: "In binary 10110, what is the place value of the leftmost 1?",
      options: ["2", "4", "8", "16"], correctIndex: 3,
      explain: "Counting from the right starting at 2⁰, the leftmost digit of a 5-digit binary number sits at 2⁴ = 16." },
    { type: "mc", topic: "conversion", mistakeType: "place-value",
      prompt: "What is true about every position in any number system?",
      options: ["It has a value even if no digit fills it", "It only matters if the digit is nonzero", "Its value depends on neighboring digits", "It has the same value in every base"], correctIndex: 0,
      explain: "A position's value comes purely from where it sits — it exists whether the digit there is 0 or not." },
    { type: "text", topic: "conversion", mistakeType: "place-value",
      prompt: "Octal number 572: what does the digit 7 contribute? (type a number)",
      correct: "56",
      explain: "7 sits in the 8¹ position: 7 × 8 = 56." }
  ];
  runQuiz(document.getElementById("m1-quiz"), questions, { moduleId: "m1", nextId: "m2" });
});

/* ============================================================
   MODULE 2 — Understanding the Base (interactive counter)
   ============================================================ */
const counterState = { base: 10, value: 0, history: [0] };

function renderCounterLedger(valueStr, base, rolledPositions) {
  const digits = valueStr.split("");
  const n = digits.length;
  let html = `<div class="ledger center">`;
  digits.forEach((d, i) => {
    const posFromRight = n - 1 - i;
    const rolled = rolledPositions && rolledPositions.has(posFromRight);
    html += `<div class="digit-slot">
      ${digitBox(d, { base, size: "lg", state: rolled ? "pop carry-in" : "" })}
      ${rolled ? `<div class="place-label" style="color:var(--carry);font-weight:700;">reset</div>` : `<div class="place-label">&nbsp;</div>`}
    </div>`;
  });
  html += `</div>`;
  return html;
}

function counterPageBody() {
  const info = BASE_INFO[counterState.base];
  const valueStr = intToBase(counterState.value, counterState.base);
  return `
  ${lessonHeader("Module 2 · Foundations", "Understanding the Base", "The base is simply: how many symbols exist before a position runs out of room and resets.")}
  <div class="rail">
    ${railBlock("Concept", "Counting until a position overflows", "Pick a base and press +1 repeatedly. Watch what happens the moment a digit runs out of symbols.", `
      <div class="pill-select" id="counterBasePills" style="margin-bottom:18px;">
        ${[2, 8, 10, 16].map(b => `<button class="pill ${counterState.base === b ? "active" : ""}" style="--accent:${BASE_INFO[b].color};--accent-soft:${BASE_INFO[b].key === "bin" ? "var(--bin-soft)" : BASE_INFO[b].key === "oct" ? "var(--oct-soft)" : BASE_INFO[b].key === "dec" ? "var(--dec-soft)" : "var(--hex-soft)"}" data-base="${b}">${BASE_INFO[b].name} · ${b}</button>`).join("")}
      </div>
      <div id="counterLedgerWrap">${renderCounterLedger(valueStr, counterState.base)}</div>
      <div style="display:flex;justify-content:center;gap:10px;margin-top:20px;">
        <button class="btn btn-ghost" id="counterResetBtn">Reset to 0</button>
        <button class="btn btn-primary" id="counterPlusBtn">+1</button>
      </div>
      <div id="counterExplain" style="margin-top:16px;"></div>
    `)}

    ${railBlock("Watch it happen", "The full rollover, step by step", "This is exactly what you just triggered above: the digit has no more single-digit space, so it resets to 0 and hands one unit to a brand-new position on its left.", `
      <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;justify-content:center;">
        <div class="digit-slot">${digitBox("9", { base: 10, size: "lg" })}<div class="place-label">before</div></div>
        <div class="trail-arrow">+1 →</div>
        <div class="ledger">${digitBox("1", { base: 10, size: "lg" })}${digitBox("0", { base: 10, size: "lg", state: "pop" })}</div>
        <div class="place-label">after</div>
      </div>
      ${callout("The old position couldn't hold '10' — there's no single symbol for it. So it resets to 0, and a new position appears carrying the one group that didn't fit.", "carry-note")}
    `)}

    ${railBlock("Your turn", "Same rollover, every base", "Here's the exact sequence for each base. Click a base tab to watch how far it counts before its first reset.", `
      <div id="counterSeqDemo"></div>
    `)}

    ${railBlock("Quick Test", "Check your understanding", "", `<div id="m2-quiz"></div>`)}
  </div>`;
}

registerPage("m2", counterPageBody, function (root) {
  function refreshLedgerOnly(rolled) {
    const valueStr = intToBase(counterState.value, counterState.base);
    document.getElementById("counterLedgerWrap").innerHTML = renderCounterLedger(valueStr, counterState.base, rolled);
  }
  function wire() {
    root.querySelectorAll("#counterBasePills .pill").forEach(btn => {
      btn.addEventListener("click", () => {
        counterState.base = parseInt(btn.getAttribute("data-base"), 10);
        counterState.value = 0;
        root.innerHTML = counterPageBody();
        wire();
        initQuiz();
      });
    });
    document.getElementById("counterPlusBtn").addEventListener("click", () => {
      const base = counterState.base;
      const oldStr = intToBase(counterState.value, base);
      counterState.value++;
      const newStr = intToBase(counterState.value, base);
      // find which digit-positions (counting from right, 0-indexed) rolled to 0
      const rolled = new Set();
      const oldPadded = padLeft(oldStr, newStr.length);
      for (let i = 0; i < newStr.length; i++) {
        const posFromRight = newStr.length - 1 - i;
        if (oldPadded[i] === valDigit(base - 1) && newStr[i] === "0") rolled.add(posFromRight);
      }
      refreshLedgerOnly(rolled);
      const info = BASE_INFO[base];
      const explainEl = document.getElementById("counterExplain");
      if (rolled.size > 0) {
        explainEl.innerHTML = callout(`<b>${oldStr}</b> → <b>${newStr}</b> — the digit was already at its highest symbol (${valDigit(base - 1)}), so it reset to 0 and a new position was created to the left.`, "carry-note");
      } else {
        explainEl.innerHTML = `<p style="margin:0;">${oldStr} → <b class="mono">${newStr}</b>. No reset needed — there was still room in this position.</p>`;
      }
    });
    document.getElementById("counterResetBtn").addEventListener("click", () => {
      counterState.value = 0;
      refreshLedgerOnly(new Set());
      document.getElementById("counterExplain").innerHTML = "";
    });

    const seqWrap = document.getElementById("counterSeqDemo");
    if (seqWrap) {
      const sequences = {
        2: ["0", "1", "10", "11", "100"],
        8: ["0", "1", "2", "3", "4", "5", "6", "7", "10"],
        10: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        16: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F", "10"]
      };
      seqWrap.innerHTML = [2, 8, 10, 16].map(b => `
        <div style="margin-bottom:14px;">
          ${badge(b)}
          <div class="mono" style="margin-top:8px;font-size:15px;letter-spacing:.02em;">
            ${sequences[b].map((v, i) => `<span style="${i === sequences[b].length - 1 ? "color:var(--carry);font-weight:700;" : "color:var(--ink-soft);"}">${v}</span>`).join(" → ")}
          </div>
        </div>`).join("") + callout("Every sequence takes the same number of steps to reach its first two-digit number as the base has symbols — binary resets fastest (after just 1), hexadecimal goes the longest (all the way to F) before resetting.", "tip");
    }
  }
  wire();

  function initQuiz() {
    const questions = [
      { type: "mc", topic: "conversion", mistakeType: "base-concept",
        prompt: "Why does binary count 0, 1, 10 — reaching two digits so quickly?",
        options: ["Binary only has two symbols, 0 and 1", "Binary skips the number 2", "Binary is a smaller number", "It's just a naming convention"], correctIndex: 0,
        explain: "With only two symbols available, a binary position runs out of room after just 1 — so it must reset and carry after every single increment past 1." },
      { type: "text", topic: "conversion", mistakeType: "base-concept",
        prompt: "What comes right after 7 when counting in octal?",
        correct: "10",
        explain: "Octal has symbols 0–7. After 7, the position resets to 0 and a new position appears: 10." },
      { type: "mc", topic: "conversion", mistakeType: "base-concept",
        prompt: "What comes right after F when counting in hexadecimal?",
        options: ["F1", "20", "10", "G"], correctIndex: 2,
        explain: "F is hex's highest single digit (15). The next value resets that position to 0 and carries: 10 (which equals sixteen)." },
      { type: "mc", topic: "conversion", mistakeType: "base-concept",
        prompt: "A new position is created in a counting sequence when...",
        options: ["the number gets very large", "the current position has no symbol left for the next value", "you choose to add one", "the base is greater than 10"], correctIndex: 1,
        explain: "A new position only appears when the rightmost position has exhausted every symbol available in that base and must reset." }
    ];
    runQuiz(document.getElementById("m2-quiz"), questions, { moduleId: "m2", nextId: "chart" });
  }
  initQuiz();
});

/* ============================================================
   DIGIT CHARTS / CHEAT SHEET  (shared by page + floating modal)
   ============================================================ */
function digitChartRow(base) {
  const info = BASE_INFO[base];
  const chips = info.digits.split("").map(ch => {
    if (base === 16 && HEX_LETTER_NAMES[ch]) {
      return `<span class="hexletter">${digitBox(ch, { base, size: "sm" })}<span class="tooltip">${ch} = ${HEX_LETTER_NAMES[ch]}</span></span>`;
    }
    return digitBox(ch, { base, size: "sm" });
  }).join("");
  return `<div class="chart-row">
    <div class="chart-label">${info.name} · base ${base}</div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;">${chips}</div>
  </div>`;
}

function groupingChartHTML(fromBits, toBase) {
  const rows = [];
  const max = toBase - 1;
  for (let v = 0; v <= max; v++) {
    rows.push(`<tr><td class="mono" style="color:${BASE_INFO[toBase].color};font-weight:700;">${valDigit(v)}</td><td class="mono">${padLeft(intToBase(v, 2), fromBits)}</td></tr>`);
  }
  return `<table class="gridtable"><thead><tr><th>${BASE_INFO[toBase].name}</th><th>Binary (${fromBits}-bit)</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

function cheatSheetHTML(isModal) {
  return `
    ${isModal ? `<div class="modal-head"><h3>Reference Cheat Sheet</h3><button class="modal-close" id="modalCloseBtn">✕</button></div>` : ""}
    <div style="margin-bottom:22px;">
      <div class="panel-label">Digits available in each base</div>
      ${digitChartRow(2)}${digitChartRow(8)}${digitChartRow(10)}${digitChartRow(16)}
      <p style="font-size:12.5px;margin-top:10px;">Hover any hexadecimal letter to see its value.</p>
    </div>
    <div class="tool-grid" style="margin-bottom:22px;">
      <div>
        <div class="panel-label">Binary ↔ Octal (3-bit groups)</div>
        ${groupingChartHTML(3, 8)}
      </div>
      <div>
        <div class="panel-label">Binary ↔ Hexadecimal (4-bit groups)</div>
        ${groupingChartHTML(4, 16)}
      </div>
    </div>
    <div class="why-grid">
      <div class="why-item"><b>Carry (addition)</b>A column's total reaches the base — write what remains, send one full group left.</div>
      <div class="why-item"><b>Borrow (subtraction)</b>A digit is too small — take one group of "base" from the left neighbor.</div>
      <div class="why-item"><b>Radix point</b>Separates whole part (left) from fractional part (right). Always align points before adding or subtracting.</div>
      <div class="why-item"><b>Chain borrow</b>If the left neighbor is 0, it can't lend — the borrow travels further left until it finds a nonzero digit.</div>
    </div>
  `;
}
function openCheatSheet() { openModal(cheatSheetHTML(true)); }

registerPage("chart", function () {
  return `
  ${lessonHeader("Reference", "Digit & Grouping Charts", "The permanent reference for this whole course — also always one tap away via the Cheat Sheet button.")}
  <div class="panel">${cheatSheetHTML(false)}</div>
  <div style="margin-top:24px;display:flex;gap:10px;">
    <button class="btn btn-primary" data-nav="m3">Continue to Binary ↔ Octal →</button>
  </div>
  `;
}, function () {});

/* ============================================================
   GROUPING VISUALIZER HELPERS (bin <-> oct/hex)
   ============================================================ */
function digitToBitsBox(ch, base, bits, idx) {
  return `<div class="group-box" style="animation-delay:${idx * 90}ms">
    ${digitBox(ch, { base, size: "sm", filled: true })}
    <div style="font-size:12px;color:var(--ink-faint);">↓</div>
    <div style="display:flex;gap:3px;">${bits.split("").map(b => digitBox(b, { base: 2, size: "sm" })).join("")}</div>
  </div>`;
}
function bitsToDigitBox(bits, base, idx, hidden) {
  const val = baseToInt(bits, 2);
  const ch = valDigit(val);
  return `<div class="group-box" style="animation-delay:${idx * 90}ms" data-gidx="${idx}" data-answer="${ch}">
    <div style="display:flex;gap:3px;">${bits.split("").map(b => digitBox(b, { base: 2, size: "sm" })).join("")}</div>
    <div style="font-size:12px;color:var(--ink-faint);">↓</div>
    ${hidden ? `<button class="btn btn-ghost reveal-btn" data-gidx="${idx}" data-answer="${ch}" style="width:34px;height:34px;padding:0;border-radius:8px;">?</button>`
             : digitBox(ch, { base, size: "sm", filled: true })}
  </div>`;
}

function groupingTableInteractive(fromBits, toBase, tableId) {
  const rows = [];
  for (let v = 0; v <= toBase - 1; v++) {
    rows.push(`<tr class="clickable" data-value="${v}"><td class="mono" style="color:${BASE_INFO[toBase].color};font-weight:700;">${valDigit(v)}</td><td class="mono">${padLeft(intToBase(v, 2), fromBits)}</td></tr>`);
  }
  return `<table class="gridtable" id="${tableId}"><thead><tr><th>${BASE_INFO[toBase].name}</th><th>Binary (${fromBits}-bit)</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
}
function wireGroupingTable(root, tableId, demoId, toBase, fromBits) {
  const table = root.querySelector("#" + tableId);
  const demo = root.querySelector("#" + demoId);
  table.querySelectorAll("tr.clickable").forEach(tr => {
    tr.addEventListener("click", () => {
      table.querySelectorAll("tr").forEach(t => t.classList.remove("hi"));
      tr.classList.add("hi");
      const v = parseInt(tr.getAttribute("data-value"), 10);
      const ch = valDigit(v);
      const bits = padLeft(intToBase(v, 2), fromBits);
      demo.innerHTML = `<div class="group-row" style="justify-content:center;">${digitToBitsBox(ch, toBase, bits, 0)}</div>`;
    });
  });
}
function wireRevealButtons(root, containerId, onAllRevealed) {
  const wrap = root.querySelector("#" + containerId);
  if (!wrap) return;
  wrap.querySelectorAll(".reveal-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const ans = btn.getAttribute("data-answer");
      const box = document.createElement("div");
      box.className = "digit-box sm filled pop";
      box.textContent = ans;
      box.style.color = getComputedStyle(btn).color;
      btn.replaceWith(box);
      const remaining = wrap.querySelectorAll(".reveal-btn").length;
      if (remaining === 0 && onAllRevealed) onAllRevealed();
    });
  });
}

/* ============================================================
   MODULE 3 — Binary ↔ Octal
   ============================================================ */
registerPage("m3", function () {
  const example = "725"; // octal
  const exampleBin = octToBin(example);
  const revBin = "111010101";
  const revOct = binToOct(revBin);
  return `
  ${lessonHeader("Module 3 · Bridges", "Binary ↔ Octal", "Three binary digits can represent exactly 0–7 — the same range as one octal digit. That's the whole trick.")}
  <div class="rail">
    ${railBlock("Concept", "Why groups of three?", "3 bits give 2×2×2 = 8 possible patterns — 000 through 111 — which is exactly the range of one octal digit (0–7). Click any row to watch that digit unfold into its 3 bits.", `
      ${groupingTableInteractive(3, 8, "m3-table")}
      <div id="m3-tableDemo" style="min-height:110px;display:flex;align-items:center;justify-content:center;margin-top:14px;">
        <p style="color:var(--ink-faint);">Click a row above.</p>
      </div>
    `)}

    ${railBlock("Watch it happen", "Start small — one digit, then two", "Before a full 3-digit number, watch the smallest possible cases: a single octal digit, then a two-digit number.", `
      <div class="mono" style="text-align:center;margin-bottom:6px;font-size:12.5px;color:var(--ink-faint);">one digit</div>
      <div class="group-row" style="justify-content:center;margin-bottom:20px;">
        ${digitToBitsBox("6", 8, "110", 0)}
      </div>
      <div class="mono" style="text-align:center;margin-bottom:6px;font-size:12.5px;color:var(--ink-faint);">two digits</div>
      <div class="group-row" style="justify-content:center;">
        ${"42".split("").map((ch, i) => digitToBitsBox(ch, 8, padLeft(intToBase(digitVal(ch), 2), 3), i)).join("")}
      </div>
      <div style="text-align:center;margin-top:14px;" class="mono">
        <span class="badge badge-oct">6₈</span> = <span class="badge badge-bin">110₂</span> &nbsp;&nbsp;
        <span class="badge badge-oct">42₈</span> = <span class="badge badge-bin">100010₂</span>
      </div>
      ${callout("Notice 42₈ is just the two single-digit expansions (4→100, 2→010) placed side by side. A bigger number is never a new rule — just more of the same rule.", "tip")}
    `)}

    ${railBlock("Watch it happen", "Octal → Binary, one digit at a time", `Now a full 3-digit number. Converting ${example}₈ to binary: each octal digit expands into its own 3-bit group, then the groups are simply written side by side.`, `
      <div class="group-row" style="justify-content:center;" id="m3-fullDemo">
        ${example.split("").map((ch, i) => digitToBitsBox(ch, 8, padLeft(intToBase(digitVal(ch), 2), 3), i)).join("")}
      </div>
      <div style="text-align:center;margin-top:16px;" class="mono">
        <span class="badge badge-oct">${example}₈</span> becomes
        <span class="badge badge-bin">${exampleBin}₂</span>
      </div>
      ${callout("Notice each group keeps its 3 digits, even if that means a leading zero — the groups must stay a fixed width so nothing gets misread when they're joined.", "tip")}
    `)}

    ${railBlock("Watch it happen", "Binary → Octal, the reverse", `Going the other way, ${revBin}₂ is grouped into 3s starting from the right, then each group becomes one octal digit.`, `
      <div class="group-row" style="justify-content:center;" id="m3-revDemo">
        ${groupBinary(revBin, 3).intGroups.map((g, i) => bitsToDigitBox(g, 8, i, false)).join("")}
      </div>
      <div style="text-align:center;margin-top:16px;" class="mono">
        <span class="badge badge-bin">${revBin}₂</span> becomes
        <span class="badge badge-oct">${revOct}₈</span>
      </div>
      ${callout("Grouping always starts from the right (the ones position). If the leftmost group is short, pad it with leading zeros first.", "tip")}
    `)}

    ${railBlock("Your turn", "Reveal each group yourself", "Here's a new binary number. Click each ? to reveal its octal digit — then read the full answer left to right.", `
      <div class="group-row" style="justify-content:center;" id="m3-yourTurn">
        ${groupBinary("110101011", 3).intGroups.map((g, i) => bitsToDigitBox(g, 8, i, true)).join("")}
      </div>
      <div id="m3-yourTurnResult" style="text-align:center;margin-top:14px;"></div>
    `)}

    ${railBlock("Quick Test", "Convert binary → octal", "", `<div id="m3-quiz"></div>`)}
  </div>`;
}, function (root) {
  wireGroupingTable(root, "m3-table", "m3-tableDemo", 8, 3);
  wireRevealButtons(root, "m3-yourTurn", () => {
    document.getElementById("m3-yourTurnResult").innerHTML = callout(`Full answer: <b class="mono">110101011₂ = ${binToOct("110101011")}₈</b>`, "carry-note");
  });

  const questions = [
    { type: "text", topic: "conversion", mistakeType: "bin-oct-grouping",
      prompt: "Convert 101₂ to octal.",
      correct: "5",
      explain: "101 is a single 3-bit group, which is octal digit 5 directly." },
    { type: "text", topic: "conversion", mistakeType: "bin-oct-grouping",
      prompt: "Convert 110101₂ to octal.",
      correct: "65",
      explain: "Grouped in 3s from the right: 110 | 101 → 6 | 5 → 65." },
    { type: "text", topic: "conversion", mistakeType: "bin-oct-grouping",
      prompt: "Convert 111001101₂ to octal.",
      correct: "715",
      explain: "Grouped in 3s from the right: 111 | 001 | 101 → 7 | 1 | 5 → 715." },
    { type: "text", topic: "conversion", mistakeType: "bin-oct-grouping",
      prompt: "Convert 46₈ to binary.",
      correct: "100110",
      explain: "Each digit becomes 3 bits: 4 → 100, 6 → 110, giving 100110." },
    { type: "mc", topic: "conversion", mistakeType: "bin-oct-grouping",
      prompt: "Why must each binary group have exactly 3 bits, even with leading zeros?",
      options: ["To match octal's largest digit, 7 = 111", "So each group unambiguously maps to one octal digit", "It's just a style convention", "Because binary numbers must have odd length"], correctIndex: 1,
      explain: "Fixed-width groups mean each 3-bit chunk always maps to exactly one octal digit — drop the leading zero and the grouping breaks." }
  ];
  runQuiz(document.getElementById("m3-quiz"), questions, { moduleId: "m3", nextId: "m4" });
});

/* ============================================================
   MODULE 4 — Binary ↔ Hexadecimal
   ============================================================ */
registerPage("m4", function () {
  const example = "3A7"; // hex
  const exampleBin = hexToBin(example);
  const revBin = "001110100111";
  const revHex = binToHex(revBin);
  return `
  ${lessonHeader("Module 4 · Bridges", "Binary ↔ Hexadecimal", "Four binary digits can represent 0–15 — exactly the range of one hexadecimal digit, symbols A–F included.")}
  <div class="rail">
    ${railBlock("Concept", "Why groups of four?", "4 bits give 2⁴ = 16 possible patterns — 0000 through 1111 — matching hexadecimal's 16 symbols (0–9, then A–F for ten through fifteen). Click a row to unfold it.", `
      ${groupingTableInteractive(4, 16, "m4-table")}
      <div id="m4-tableDemo" style="min-height:110px;display:flex;align-items:center;justify-content:center;margin-top:14px;">
        <p style="color:var(--ink-faint);">Click a row above.</p>
      </div>
    `)}

    ${railBlock("Watch it happen", "Start small — one digit, then two", "Before a full 3-digit hex number, watch the smallest cases first: a single hex digit (including a letter), then two digits.", `
      <div class="mono" style="text-align:center;margin-bottom:6px;font-size:12.5px;color:var(--ink-faint);">one digit (a letter this time)</div>
      <div class="group-row" style="justify-content:center;margin-bottom:20px;">
        ${digitToBitsBox("B", 16, "1011", 0)}
      </div>
      <div class="mono" style="text-align:center;margin-bottom:6px;font-size:12.5px;color:var(--ink-faint);">two digits</div>
      <div class="group-row" style="justify-content:center;">
        ${"4B".split("").map((ch, i) => digitToBitsBox(ch, 16, padLeft(intToBase(digitVal(ch), 2), 4), i)).join("")}
      </div>
      <div style="text-align:center;margin-top:14px;" class="mono">
        <span class="badge badge-hex">B₁₆</span> = <span class="badge badge-bin">1011₂</span> &nbsp;&nbsp;
        <span class="badge badge-hex">4B₁₆</span> = <span class="badge badge-bin">01001011₂</span>
      </div>
      ${callout("Letters aren't special — B is just ten-plus-one (eleven), and it expands to 4 bits exactly like any digit.", "tip")}
    `)}

    ${railBlock("Watch it happen", "Hexadecimal → Binary", `Now a full 3-digit number. Converting ${example}₁₆ to binary: each hex digit becomes its own 4-bit group.`, `
      <div class="group-row" style="justify-content:center;">
        ${example.split("").map((ch, i) => digitToBitsBox(ch, 16, padLeft(intToBase(digitVal(ch), 2), 4), i)).join("")}
      </div>
      <div style="text-align:center;margin-top:16px;" class="mono">
        <span class="badge badge-hex">${example}₁₆</span> becomes
        <span class="badge badge-bin">${exampleBin}₂</span>
      </div>
      ${callout("A is 1010 (ten), 7 is just 0111 — every hex digit, letter or number, always expands to exactly 4 bits.", "tip")}
    `)}

    ${railBlock("Watch it happen", "Binary → Hexadecimal, the reverse", `${revBin}₂ is grouped into 4s from the right, and each group becomes one hex digit.`, `
      <div class="group-row" style="justify-content:center;">
        ${groupBinary(revBin, 4).intGroups.map((g, i) => bitsToDigitBox(g, 16, i, false)).join("")}
      </div>
      <div style="text-align:center;margin-top:16px;" class="mono">
        <span class="badge badge-bin">${revBin}₂</span> becomes
        <span class="badge badge-hex">${revHex}₁₆</span>
      </div>
    `)}

    ${railBlock("Your turn", "Reveal each group yourself", "Click each ? to reveal its hex digit.", `
      <div class="group-row" style="justify-content:center;" id="m4-yourTurn">
        ${groupBinary("101100101111", 4).intGroups.map((g, i) => bitsToDigitBox(g, 16, i, true)).join("")}
      </div>
      <div id="m4-yourTurnResult" style="text-align:center;margin-top:14px;"></div>
    `)}

    ${railBlock("Quick Test", "Convert binary → hex", "", `<div id="m4-quiz"></div>`)}
  </div>`;
}, function (root) {
  wireGroupingTable(root, "m4-table", "m4-tableDemo", 16, 4);
  wireRevealButtons(root, "m4-yourTurn", () => {
    document.getElementById("m4-yourTurnResult").innerHTML = callout(`Full answer: <b class="mono">101100101111₂ = ${binToHex("101100101111")}₁₆</b>`, "carry-note");
  });

  const questions = [
    { type: "text", topic: "conversion", mistakeType: "bin-hex-grouping",
      prompt: "Convert 1010₂ to hexadecimal.",
      correct: "A",
      explain: "1010 is a single 4-bit group equal to ten, written as A in hex." },
    { type: "text", topic: "conversion", mistakeType: "bin-hex-grouping",
      prompt: "Convert 00111010₂ to hexadecimal.",
      correct: "3A",
      explain: "Grouped in 4s: 0011 | 1010 → 3 | A → 3A." },
    { type: "text", topic: "conversion", mistakeType: "bin-hex-grouping",
      prompt: "Convert 1111000011₂ to hexadecimal.",
      correct: "3C3",
      explain: "Pad to 12 bits: 0011 1100 0011 → 3 | C | 3 → 3C3." },
    { type: "text", topic: "conversion", mistakeType: "bin-hex-grouping",
      prompt: "Convert D4₁₆ to binary.",
      correct: "11010100",
      explain: "D → 1101, 4 → 0100, joined: 11010100." },
    { type: "mc", topic: "conversion", mistakeType: "bin-hex-grouping",
      prompt: "What does hexadecimal digit F represent in binary?",
      options: ["1110", "1111", "1101", "0111"], correctIndex: 1,
      explain: "F is fifteen, the largest single hex digit — all four bits on: 1111." }
  ];
  runQuiz(document.getElementById("m4-quiz"), questions, { moduleId: "m4", nextId: "m5" });
});

/* ============================================================
   MODULE 5 — Octal ↔ Hexadecimal (binary as the bridge)
   ============================================================ */
registerPage("m5", function () {
  const hexIn = "3A7";
  const bin = hexToBin(hexIn);
  const regrouped = groupBinary(bin, 3);
  const octOut = binToOct(bin);
  return `
  ${lessonHeader("Module 5 · Bridges", "Octal ↔ Hexadecimal", "Octal and hex don't talk to each other directly — binary is the common language both of them already share.")}
  <div class="rail">
    ${railBlock("Concept", "Never go straight — take the bridge", "It's tempting to convert octal → decimal → hex. Don't. It's slower and easier to get wrong. Instead, always pass through binary — the format both systems are secretly built from.", `
      <div class="pipeline-flow" style="justify-content:center;margin:16px 0;">
        <div class="pipeline-node" style="--accent:var(--oct);--accent-soft:var(--oct-soft);">OCTAL</div>
        <div class="pipeline-arrow">↓</div>
        <div class="pipeline-node" style="--accent:var(--bin);--accent-soft:var(--bin-soft);">BINARY</div>
        <div class="pipeline-arrow">↓</div>
        <div class="pipeline-node" style="--accent:var(--hex);--accent-soft:var(--hex-soft);">HEXADECIMAL</div>
      </div>
      ${whyGrid([
        { label: "What's happening", text: "Octal expands to binary in 3-bit groups; that same binary is then regrouped into 4-bit groups to read as hex." },
        { label: "Why", text: "Binary is the only format that both grouping rules (3-bit and 4-bit) agree on." },
        { label: "What changes", text: "The group size — 3 bits become 4 bits once the binary is re-sliced." },
        { label: "What stays the same", text: "The underlying binary digits themselves never change, only how they're bracketed." }
      ])}
    `)}

    ${railBlock("Watch it happen", "Start small — a single hex digit, via the bridge", "Before the full number, watch the bridge work on just one digit: hex C → binary → octal.", `
      <div class="pipeline-flow" style="justify-content:center;">
        <div class="pipeline-node" style="--accent:var(--hex);--accent-soft:var(--hex-soft);">C₁₆</div>
        <div class="pipeline-arrow">→</div>
        <div class="pipeline-node" style="--accent:var(--bin);--accent-soft:var(--bin-soft);">1100₂</div>
        <div class="pipeline-arrow">→</div>
        <div class="pipeline-node" style="--accent:var(--oct);--accent-soft:var(--oct-soft);">14₈</div>
      </div>
      ${callout("C (twelve) expands to 4 bits (1100), which then re-slices into 3-bit groups as 001|100 → 1, 4 → 14₈. Same bridge, just one digit.", "tip")}
    `)}

    ${railBlock("Watch it happen", `${hexIn}₁₆ → Octal, via binary`, "Now the full 3-digit number. Expand each hex digit to 4 bits, join them, then re-slice that same string into 3-bit groups for octal.", `
      <div class="mono" style="font-size:12px;color:var(--ink-faint);margin-bottom:6px;">Step 1 — hex digits expand to 4-bit groups</div>
      <div class="group-row" style="justify-content:center;margin-bottom:18px;">
        ${hexIn.split("").map((ch, i) => digitToBitsBox(ch, 16, padLeft(intToBase(digitVal(ch), 2), 4), i)).join("")}
      </div>
      <div style="text-align:center;margin-bottom:18px;" class="mono"><span class="badge badge-bin">${bin}₂</span></div>
      <div class="mono" style="font-size:12px;color:var(--ink-faint);margin-bottom:6px;">Step 2 — the same bits, re-sliced into 3-bit groups</div>
      <div class="group-row" style="justify-content:center;">
        ${regrouped.intGroups.map((g, i) => bitsToDigitBox(g, 8, i, false)).join("")}
      </div>
      <div style="text-align:center;margin-top:16px;" class="mono">
        <span class="badge badge-hex">${hexIn}₁₆</span> =
        <span class="badge badge-bin">${bin}₂</span> =
        <span class="badge badge-oct">${octOut}₈</span>
      </div>
      ${callout("The bits themselves never changed — only where the group boundaries fall. That's the entire trick.", "tip")}
    `)}

    ${railBlock("Your turn", "Same idea, the other direction", "Octal 1647 → hexadecimal. Predict the binary bridge, then check.", `
      <button class="btn btn-ghost btn-sm" id="m5-reveal">Show the bridge</button>
      <div id="m5-revealArea" style="margin-top:14px;"></div>
    `)}

    ${railBlock("Quick Test", "Bridge conversions", "", `<div id="m5-quiz"></div>`)}
  </div>`;
}, function (root) {
  document.getElementById("m5-reveal").addEventListener("click", () => {
    const oct = "1647";
    const b = octToBin(oct);
    const hex = binToHex(b);
    document.getElementById("m5-revealArea").innerHTML = `
      <div class="pipeline-flow" style="justify-content:center;">
        <div class="pipeline-node" style="--accent:var(--oct);--accent-soft:var(--oct-soft);">${oct}₈</div>
        <div class="pipeline-arrow">→</div>
        <div class="pipeline-node" style="--accent:var(--bin);--accent-soft:var(--bin-soft);">${b}₂</div>
        <div class="pipeline-arrow">→</div>
        <div class="pipeline-node" style="--accent:var(--hex);--accent-soft:var(--hex-soft);">${hex}₁₆</div>
      </div>`;
  });

  const questions = [
    { type: "text", topic: "conversion", mistakeType: "oct-hex-bridge",
      prompt: "Convert octal 7 to hexadecimal (bridge through binary — just one digit).",
      correct: "7",
      explain: "7₈ → binary 111 → pad to 4 bits: 0111 → 7₁₆. Small numbers can look unchanged — check the binary step to be sure." },
    { type: "text", topic: "conversion", mistakeType: "oct-hex-bridge",
      prompt: "Convert octal 24 to hexadecimal (bridge through binary).",
      correct: "14",
      explain: "24₈ → binary 010100 → re-group in 4s: 0001 0100 → 14₁₆." },
    { type: "text", topic: "conversion", mistakeType: "oct-hex-bridge",
      prompt: "Convert hexadecimal 2F to octal (bridge through binary).",
      correct: "57",
      explain: "2F₁₆ → binary 00101111 → re-group in 3s: 101 111 → 57₈." },
    { type: "mc", topic: "conversion", mistakeType: "oct-hex-bridge",
      prompt: "What is the recommended path from octal to hexadecimal?",
      options: ["Octal → Decimal → Hexadecimal", "Octal → Binary → Hexadecimal", "Convert digit-by-digit directly", "Hexadecimal → Decimal → Octal"], correctIndex: 1,
      explain: "Binary is the shared format — both octal and hex expand to and from it directly, with no decimal detour needed." }
  ];
  runQuiz(document.getElementById("m5-quiz"), questions, { moduleId: "m5", nextId: "m6" });
});

/* ============================================================
   MODULE 6 — Decimal Conversions (division & multiplication ladders)
   ============================================================ */
function divisionLadderHTML(n, base) {
  const steps = divisionLadder(n, base);
  let html = `<div class="ladder">`;
  steps.forEach((s, i) => {
    html += `<div class="ladder-step fade-in" style="animation-delay:${i * 130}ms">
      <div class="ladder-num mono">${s.before}</div>
      <div class="ladder-arrow">÷${base} →</div>
      <div class="mono" style="width:44px;">${s.quotient}</div>
      <div class="ladder-rem">remainder <b>${valDigit(s.remainder)}</b></div>
    </div>`;
  });
  html += `</div>`;
  const digits = ladderToDigits(steps);
  html += `<div class="ladder-read">↑ read the remainders bottom → top: <span class="mono" style="font-weight:700;color:var(--ink);font-size:15px;">${digits}</span></div>`;
  return html;
}
function fracLadderHTML(frac, base, precision) {
  const steps = fracToBase(frac, base, precision || 6);
  let html = `<div class="ladder">`;
  steps.forEach((s, i) => {
    html += `<div class="ladder-step fade-in" style="animation-delay:${i * 130}ms">
      <div class="ladder-num mono" style="width:70px;">${(Math.round(s.before * 10000) / 10000)}</div>
      <div class="ladder-arrow">×${base} →</div>
      <div class="mono" style="width:70px;">${(Math.round(s.mult * 10000) / 10000)}</div>
      <div class="ladder-rem">digit <b>${valDigit(s.digit)}</b></div>
    </div>`;
  });
  html += `</div>`;
  const digits = fracStepsToDigits(steps);
  html += `<div class="ladder-read">↓ read the digits top → bottom: <span class="mono" style="font-weight:700;color:var(--ink);font-size:15px;">${digits}</span></div>`;
  return html;
}

function roundClean(x) { return Math.round(x * 1e8) / 1e8; }

// Static "sum the place values" breakdown for reading a number FROM a base
// INTO decimal — the reverse direction of the division/multiplication ladders.
function sumBreakdownHTML(numStr, base) {
  const digits = numStr.split("");
  const n = digits.length;
  let total = 0;
  const chips = digits.map((d, i) => {
    const power = n - 1 - i;
    const placeVal = Math.pow(base, power);
    const val = digitVal(d) * placeVal;
    total += val;
    return `<span class="badge badge-${baseKey(base)}">${d}×${placeVal}</span>`;
  });
  return `
    <div class="ledger center">${digits.map(d => digitBox(d, { base, size: "md", filled: true })).join("")}</div>
    <div style="text-align:center;margin-top:12px;font-family:var(--font-mono);font-size:13.5px;">
      ${chips.join(` <span style="color:var(--ink-faint);">+</span> `)} <span style="color:var(--ink-faint);">=</span> <b style="font-size:15px;">${total}</b>
    </div>`;
}
// Same idea for the fractional part — digit × (1/base^position), summed.
function sumBreakdownFracHTML(fracStr, base) {
  const digits = fracStr.split("");
  let total = 0;
  const chips = digits.map((d, i) => {
    const power = -(i + 1);
    const placeVal = roundClean(Math.pow(base, power));
    const val = digitVal(d) * placeVal;
    total += val;
    return `<span class="badge badge-${baseKey(base)}">${d}×${placeVal}</span>`;
  });
  total = roundClean(total);
  return `
    <div class="ledger center">${digitBox(".", { extra: "point" })}${digits.map(d => digitBox(d, { base, size: "md", filled: true })).join("")}</div>
    <div style="text-align:center;margin-top:12px;font-family:var(--font-mono);font-size:13.5px;">
      ${chips.join(` <span style="color:var(--ink-faint);">+</span> `)} <span style="color:var(--ink-faint);">=</span> <b style="font-size:15px;">${total}</b>
    </div>`;
}

registerPage("m6", function () {
  return `
  ${lessonHeader("Module 6 · Bridges", "Decimal Conversions", "Decimal doesn't group neatly like binary/octal/hex do — so we go slow here, in both directions, for every base.")}
  <div class="rail">

    ${railBlock("Concept", "Reading a base number back into decimal — start small", "You already did this in Module 1: multiply each digit by its place value, then add everything up. Here it is again for binary, octal, and hex side by side, starting with tiny numbers.", `
      <div class="tool-grid tool-grid-3">
        <div>${badge(2)}<div style="margin-top:10px;">${sumBreakdownHTML("101", 2)}</div></div>
        <div>${badge(8)}<div style="margin-top:10px;">${sumBreakdownHTML("17", 8)}</div></div>
        <div>${badge(16)}<div style="margin-top:10px;">${sumBreakdownHTML("1F", 16)}</div></div>
      </div>
      ${callout("Same process every time: <b>digit × place value</b>, then add. Only the place-value multiplier (2, 8, or 16) changes.", "tip")}
    `)}

    ${railBlock("Watch it happen", "Now with more digits", "Same idea, just longer — the process never changes, only the number of terms being added.", `
      <div class="tool-grid tool-grid-3">
        <div>${badge(2)}<div style="margin-top:10px;">${sumBreakdownHTML("11010110", 2)}</div></div>
        <div>${badge(8)}<div style="margin-top:10px;">${sumBreakdownHTML("452", 8)}</div></div>
        <div>${badge(16)}<div style="margin-top:10px;">${sumBreakdownHTML("3F2A", 16)}</div></div>
      </div>
      ${callout("Octal → Decimal and Hex → Decimal both work exactly like Binary → Decimal — there's no separate rule to learn, just a different multiplier per position.", "carry-note")}
    `)}

    ${railBlock("Concept", "Decimal → any base — start small", "Going the other way: divide repeatedly by the target base and collect remainders. These are the exact same three numbers as above, converted back — notice they match.", `
      <div class="tool-grid tool-grid-3">
        <div>${badge(2)}<div class="mono" style="font-size:12px;margin:8px 0;">decimal 5 →</div>${divisionLadderHTML(5, 2)}</div>
        <div>${badge(8)}<div class="mono" style="font-size:12px;margin:8px 0;">decimal 15 →</div>${divisionLadderHTML(15, 8)}</div>
        <div>${badge(16)}<div class="mono" style="font-size:12px;margin:8px 0;">decimal 31 →</div>${divisionLadderHTML(31, 16)}</div>
      </div>
      ${callout("5 → 101₂, 15 → 17₈, 31 → 1F₁₆ — exactly the numbers from the first panel, confirming the two directions undo each other.", "tip")}
    `)}

    ${railBlock("Watch it happen", "Decimal → any base — bigger numbers", "Same ladder, more steps. Take it one division at a time.", `
      <div class="tool-grid tool-grid-3">
        <div>${badge(2)}<div class="mono" style="font-size:12px;margin:8px 0;">decimal 25 →</div>${divisionLadderHTML(25, 2)}</div>
        <div>${badge(8)}<div class="mono" style="font-size:12px;margin:8px 0;">decimal 100 →</div>${divisionLadderHTML(100, 8)}</div>
        <div>${badge(16)}<div class="mono" style="font-size:12px;margin:8px 0;">decimal 500 →</div>${divisionLadderHTML(500, 16)}</div>
      </div>
      ${callout("Read <b>bottom to top</b> — the very first remainder you compute is the ones digit, the last position, not the first.", "carry-note")}
    `)}

    ${railBlock("Concept", "Fractions, reverse direction — reading the sum out slowly", "A fractional digit's place value is a fraction of 1: base⁻¹ = 1/base, base⁻² = 1/base², and so on. Multiply each digit by its place value and add, exactly like whole numbers.", `
      <div class="mono" style="text-align:center;margin-bottom:6px;font-size:13px;color:var(--ink-faint);">start small — one digit</div>
      <div class="tool-grid tool-grid-3">
        <div>${badge(2)}<div style="margin-top:6px;">${sumBreakdownFracHTML("1", 2)}</div></div>
        <div>${badge(8)}<div style="margin-top:6px;">${sumBreakdownFracHTML("4", 8)}</div></div>
        <div>${badge(16)}<div style="margin-top:6px;">${sumBreakdownFracHTML("8", 16)}</div></div>
      </div>
      <div class="mono" style="text-align:center;margin:20px 0 6px;font-size:13px;color:var(--ink-faint);">now a few more digits</div>
      <div class="tool-grid tool-grid-3">
        <div>${badge(2)}<div style="margin-top:6px;">${sumBreakdownFracHTML("101", 2)}</div></div>
        <div>${badge(8)}<div style="margin-top:6px;">${sumBreakdownFracHTML("14", 8)}</div></div>
        <div>${badge(16)}<div style="margin-top:6px;">${sumBreakdownFracHTML("2", 16)}</div></div>
      </div>
      ${callout("0.101₂ = (1×0.5) + (0×0.25) + (1×0.125) = <b>0.625</b>. Each term just gets smaller — that's what a negative power of the base means.", "tip")}
    `)}

    ${railBlock("Watch it happen", "Decimal fraction → any base, slowly", "Multiply the fractional part by the base. The whole-number part that pops out is the next digit — carry only the remaining fraction forward. Start with one clean step, then a longer chain.", `
      <div class="mono" style="text-align:center;margin-bottom:6px;font-size:13px;color:var(--ink-faint);">start small — one step</div>
      <div class="tool-grid">
        <div>${badge(2)}<div class="mono" style="font-size:12px;margin:8px 0;">0.5 →</div>${fracLadderHTML(0.5, 2, 4)}</div>
        <div>${badge(8)}<div class="mono" style="font-size:12px;margin:8px 0;">0.5 →</div>${fracLadderHTML(0.5, 8, 4)}</div>
      </div>
      <div class="mono" style="text-align:center;margin:20px 0 6px;font-size:13px;color:var(--ink-faint);">now a few steps</div>
      <div class="tool-grid">
        <div>${badge(2)}<div class="mono" style="font-size:12px;margin:8px 0;">0.625 →</div>${fracLadderHTML(0.625, 2, 6)}</div>
        <div>${badge(16)}<div class="mono" style="font-size:12px;margin:8px 0;">0.75 →</div>${fracLadderHTML(0.75, 16, 4)}</div>
      </div>
      ${callout("Read <b>top to bottom</b> this time — the opposite of whole numbers — because the first digit you produce is the first digit right after the point.", "tip")}
    `)}

    ${railBlock("Your turn", "Convert any decimal number yourself", "Type a decimal number (a fraction like 25.625 is fine) and pick a target base — integer and fractional parts are both shown, ladder and all.", `
      <div class="decimal-input-row">
        <input type="text" id="m6-input" value="19.75" />
        <div class="pill-select" id="m6-basePills">
          ${[2, 8, 16].map(b => `<button class="pill ${b === 2 ? "active" : ""}" style="--accent:${BASE_INFO[b].color}" data-base="${b}">base ${b}</button>`).join("")}
        </div>
        <button class="btn btn-primary btn-sm" id="m6-convertBtn">Convert</button>
      </div>
      <div id="m6-result"></div>
    `)}

    ${railBlock("Quick Test", "Decimal conversions — every base, both directions", "", `<div id="m6-quiz"></div>`)}
  </div>`;
}, function (root) {
  let m6Base = 2;
  root.querySelectorAll("#m6-basePills .pill").forEach(btn => {
    btn.addEventListener("click", () => {
      m6Base = parseInt(btn.getAttribute("data-base"), 10);
      root.querySelectorAll("#m6-basePills .pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
  document.getElementById("m6-convertBtn").addEventListener("click", () => {
    const raw = document.getElementById("m6-input").value.trim();
    const num = parseFloat(raw);
    const resultDiv = document.getElementById("m6-result");
    if (isNaN(num) || num < 0) {
      resultDiv.innerHTML = callout("Enter a positive decimal number, like 19.75", "borrow-note");
      return;
    }
    const intPart = Math.floor(num);
    const fracPart = Math.round((num - intPart) * 1e6) / 1e6;
    const finalStr = fromDecimal(num, m6Base, 8);
    let html = `<div class="panel-label" style="margin-top:8px;">Integer part — ${intPart}</div>${divisionLadderHTML(intPart, m6Base)}`;
    if (fracPart > 0) {
      html += `<div class="panel-label" style="margin-top:18px;">Fractional part — ${fracPart}</div>${fracLadderHTML(fracPart, m6Base, 8)}`;
    }
    html += `<div style="text-align:center;margin-top:16px;" class="mono">
      <span class="badge badge-dec">${num}₁₀</span> = <span class="badge badge-${baseKey(m6Base)}">${finalStr}${BASE_INFO[m6Base].key === "bin" ? "₂" : m6Base === 8 ? "₈" : "₁₆"}</span>
    </div>`;
    resultDiv.innerHTML = html;
  });

  const questions = [
    { type: "text", topic: "conversion", mistakeType: "bin-dec",
      prompt: "Convert binary 1101 to decimal (sum the place values).",
      correct: "13",
      explain: "1×8 + 1×4 + 0×2 + 1×1 = 13." },
    { type: "text", topic: "conversion", mistakeType: "decimal-division",
      prompt: "Convert decimal 13 to binary using repeated division.",
      correct: "1101",
      explain: "13÷2=6 r1, 6÷2=3 r0, 3÷2=1 r1, 1÷2=0 r1 — read bottom-up: 1101." },
    { type: "text", topic: "conversion", mistakeType: "bin-dec",
      prompt: "Convert octal 52 to decimal (sum the place values).",
      correct: "42",
      explain: "5×8 + 2×1 = 42." },
    { type: "text", topic: "conversion", mistakeType: "decimal-division",
      prompt: "Convert decimal 100 to octal using repeated division.",
      correct: "144",
      explain: "100÷8=12 r4, 12÷8=1 r4, 1÷8=0 r1 — read bottom-up: 144." },
    { type: "text", topic: "conversion", mistakeType: "bin-dec",
      prompt: "Convert hexadecimal 2C to decimal (sum the place values).",
      correct: "44",
      explain: "2×16 + 12×1 (C is twelve) = 44." },
    { type: "text", topic: "conversion", mistakeType: "decimal-division",
      prompt: "Convert decimal 200 to hexadecimal using repeated division.",
      correct: "C8",
      explain: "200÷16=12 r8, 12÷16=0 r12 — read bottom-up: C8 (12 is C)." },
    { type: "text", topic: "conversion", mistakeType: "decimal-multiplication",
      prompt: "Convert the fraction 0.5 to binary using repeated multiplication.",
      correct: "1",
      explain: "0.5×2=1.0 → digit 1, and the fractional part is now 0 so we stop." },
    { type: "mc", topic: "conversion", mistakeType: "decimal-direction",
      prompt: "When converting a decimal fraction, in what order do you read the digits you produce?",
      options: ["Bottom to top", "Top to bottom", "It doesn't matter", "Alternating"], correctIndex: 1,
      explain: "For fractions you read top to bottom — the first digit produced is the first digit after the radix point. (Whole numbers are the opposite: bottom to top.)" }
  ];
  runQuiz(document.getElementById("m6-quiz"), questions, { moduleId: "m6", nextId: "m7" });
});

/* ============================================================
   MODULE 7 — Radix Points
   ============================================================ */
function fractionalLedgerHTML(numStr, base) {
  const [intPart, fracPart] = numStr.split(".");
  const iN = intPart.length;
  let html = `<div class="ledger center">`;
  intPart.split("").forEach((d, i) => {
    const power = iN - 1 - i;
    html += `<div class="digit-slot">${digitBox(d, { base, size: "md" })}<div class="place-label">${base}<sup>${power}</sup></div></div>`;
  });
  if (fracPart) {
    html += `<div class="digit-slot"><div class="digit-box point">.</div><div class="place-label">&nbsp;</div></div>`;
    fracPart.split("").forEach((d, i) => {
      html += `<div class="digit-slot">${digitBox(d, { base, size: "md" })}<div class="place-label">${base}<sup>-${i + 1}</sup></div></div>`;
    });
  }
  html += `</div>`;
  return html;
}

function alignAndAdd(aStr, bStr, base) {
  let [aInt, aFrac] = aStr.split("."); aFrac = aFrac || "";
  let [bInt, bFrac] = bStr.split("."); bFrac = bFrac || "";
  const intLen = Math.max(aInt.length, bInt.length);
  const fracLen = Math.max(aFrac.length, bFrac.length);
  aInt = padLeft(aInt, intLen); bInt = padLeft(bInt, intLen);
  aFrac = padRight(aFrac, fracLen); bFrac = padRight(bFrac, fracLen);
  const aFull = aInt + aFrac, bFull = bInt + bFrac;
  const r = addColumns(aFull, bFull, base);
  const resultIntLen = intLen + (r.finalCarry ? 1 : 0);
  const resultInt = r.resultStr.slice(0, resultIntLen);
  const resultFrac = r.resultStr.slice(resultIntLen);
  return { aInt, aFrac, bInt, bFrac, intLen, fracLen, cols: r.cols, finalCarry: r.finalCarry, resultInt, resultFrac, full: resultFrac ? resultInt + "." + resultFrac : resultInt };
}

function alignedPairHTML(aStr, bStr, base, result) {
  const a = padLeft(result.aInt, result.intLen) + "." + padRight(result.aFrac, result.fracLen);
  const b = padLeft(result.bInt, result.intLen) + "." + padRight(result.bFrac, result.fracLen);
  const rowChars = (s) => s.split("").map(ch => ch === "." ? `<span class="digit-box point sm">.</span>` : digitBox(ch, { base, size: "sm" })).join("");
  const resFull = result.full;
  return `<div style="display:inline-flex;flex-direction:column;gap:6px;">
    <div class="ledger">${rowChars(a)}</div>
    <div class="ledger">${rowChars(b)}</div>
    <div style="height:2px;background:var(--ink);margin:4px 0;width:100%;"></div>
    <div class="ledger">${rowChars(padLeft(resFull, a.length))}</div>
  </div>`;
}

registerPage("m7", function () {
  return `
  ${lessonHeader("Module 7 · Bridges", "Radix Points", "The radix point splits every number into a whole part and a fractional part — and it must line up before any arithmetic can happen.")}
  <div class="rail">
    ${railBlock("Concept", "Whole part . fractional part", "Positions to the left of the point are whole-number place values (base⁰, base¹, base²...). Positions to the right are fractions (base⁻¹, base⁻², ...).", `
      ${fractionalLedgerHTML("101.101", 2)}
      ${whyGrid([
        { label: "What's happening", text: "The point itself has no value — it's just a marker separating two kinds of positions." },
        { label: "Why", text: "Negative powers (base⁻¹ = 1/base) let us represent parts smaller than one, the same way positive powers represent whole groups." },
        { label: "What changes", text: "Powers count down from the point in both directions: ...², ¹, ⁰ | ⁻¹, ⁻²..." },
        { label: "How to recognize it", text: "Any time you see a '.', treat everything left of it and everything right of it as two separate ledgers." }
      ])}
    `)}

    ${railBlock("Watch it happen", "Align the points before adding", "101.101 + 010.011 in binary. Pad each number with zeros — left side of the point on the left, right side on the right — until both numbers are the same width. Only then add column by column.", `
      ${(function () {
        const r = alignAndAdd("101.101", "010.011", 2);
        return alignedPairHTML("101.101", "010.011", 2, r) +
          `<div style="margin-top:14px;" class="mono">Result: <b>${r.full}₂</b> (that's 5.625 + 2.375 = 8.000 in decimal)</div>`;
      })()}
      ${callout("Padding with zeros never changes a number's value — 101.1 and 101.100 are the same amount. It only makes the columns line up.", "tip")}
    `)}

    ${railBlock("Your turn", "Same alignment, other bases", "The rule is identical no matter the base — only the digit symbols change.", `
      <div class="tool-grid">
        <div>${badge(8)}<div style="margin-top:10px;">${(function () { const r = alignAndAdd("12.4", "3.75", 8); return alignedPairHTML("12.4", "3.75", 8, r) + `<div class="mono" style="margin-top:10px;">= ${r.full}₈</div>`; })()}</div></div>
        <div>${badge(16)}<div style="margin-top:10px;">${(function () { const r = alignAndAdd("A.C", "5.F", 16); return alignedPairHTML("A.C", "5.F", 16, r) + `<div class="mono" style="margin-top:10px;">= ${r.full}₁₆</div>`; })()}</div></div>
      </div>
    `)}

    ${railBlock("Quick Test", "Radix point checks", "", `<div id="m7-quiz"></div>`)}
  </div>`;
}, function (root) {
  const questions = [
    { type: "mc", topic: "radix", mistakeType: "radix-alignment",
      prompt: "Before adding 11.1₂ and 1.01₂, what must you do first?",
      options: ["Convert both to decimal", "Align their radix points by padding with zeros", "Round to the shorter length", "Ignore the fractional parts"], correctIndex: 1,
      explain: "Pad 11.1 to 11.10 so both numbers have two fractional digits and the columns line up correctly." },
    { type: "mc", topic: "radix", mistakeType: "radix-alignment",
      prompt: "What is the value of the position immediately to the right of the radix point?",
      options: ["base⁰", "base¹", "base⁻¹", "base⁻²"], correctIndex: 2,
      explain: "The first position right of the point is always base⁻¹ — one divided by the base." },
    { type: "text", topic: "radix", mistakeType: "radix-alignment",
      prompt: "Add 1.1₂ + 0.11₂ (align the points first). Give the binary answer.",
      correct: "10.01",
      explain: "Padded: 1.10 + 0.11 = 10.01 in binary (that's 1.5 + 0.75 = 2.25)." }
  ];
  runQuiz(document.getElementById("m7-quiz"), questions, { moduleId: "m7", nextId: "carry" });
});

/* ============================================================
   CARRY VISUALIZER (standalone reusable page)
   ============================================================ */
const carryVizState = { base: 10, a: 7, b: 6 };

function unitsGroupedHTML(count, groupSize) {
  let html = "";
  let remaining = count;
  while (remaining > 0) {
    const take = Math.min(groupSize, remaining);
    const isFull = take === groupSize;
    html += `<div class="unit-group ${isFull ? "full" : ""}">${"●".repeat(take)}</div>`;
    remaining -= take;
  }
  return html || `<div class="unit-group">·</div>`;
}

function carryVizBody() {
  const base = carryVizState.base;
  const info = BASE_INFO[base];
  const a = carryVizState.a, b = carryVizState.b;
  const total = a + b;
  const carryOut = Math.floor(total / base);
  const remainder = total % base;
  return `
  ${lessonHeader("Reusable Tool", "Carry Visualizer", "Pick a base, pick two digits, and watch exactly what a carry is: one full group of \"base\" moving into the next position.")}
  <div class="panel">
    <div class="pill-select" id="cv-basePills">
      ${[2, 8, 10, 16].map(bb => `<button class="pill ${base === bb ? "active" : ""}" style="--accent:${BASE_INFO[bb].color}" data-base="${bb}">${BASE_INFO[bb].name} · ${bb}</button>`).join("")}
    </div>
    <div class="digit-select-row">
      <div>
        <div class="place-label" style="margin-bottom:6px;">First digit</div>
        <div class="digit-select" id="cv-aSelect">
          ${info.digits.split("").map(d => `<button class="pill ${d === valDigit(a) ? "active" : ""}" style="--accent:${info.color}" data-val="${digitVal(d)}">${d}</button>`).join("")}
        </div>
      </div>
      <div style="font-size:22px;color:var(--ink-faint);">+</div>
      <div>
        <div class="place-label" style="margin-bottom:6px;">Second digit</div>
        <div class="digit-select" id="cv-bSelect">
          ${info.digits.split("").map(d => `<button class="pill ${d === valDigit(b) ? "active" : ""}" style="--accent:${info.color}" data-val="${digitVal(d)}">${d}</button>`).join("")}
        </div>
      </div>
    </div>

    <div class="divider"></div>
    <div id="cv-result">
      <div style="text-align:center;margin-bottom:14px;" class="mono">
        <span class="digit-box lg ${baseKey(base)} filled">${valDigit(a)}</span>
        <span style="margin:0 8px;">+</span>
        <span class="digit-box lg ${baseKey(base)} filled">${valDigit(b)}</span>
        <span style="margin:0 8px;">=</span>
        <span style="font-size:22px;font-weight:700;">${total} units</span>
      </div>
      <p style="text-align:center;">In ${info.name.toLowerCase()}, a full group is <b>${base}</b> units. Grouping ${total} units into sets of ${base}:</p>
      <div style="text-align:center;margin:14px 0;">${unitsGroupedHTML(total, base)}</div>
      ${carryOut > 0
        ? callout(`${carryOut} complete group${carryOut > 1 ? "s" : ""} of ${base} formed — that's the carry. It moves one position left. <b>${remainder}</b> unit${remainder === 1 ? "" : "s"} stay${remainder === 1 ? "s" : ""} behind in this column.`, "carry-note")
        : callout(`No full group of ${base} was formed — every unit stays right here. No carry needed.`, "tip")}
      <div style="text-align:center;margin-top:10px;" class="mono">
        Column shows <b>${valDigit(remainder)}</b>${carryOut > 0 ? `, carry <b>${carryOut}</b> to the next column →` : ""}
      </div>
    </div>
  </div>
  <div class="callout" style="margin-top:20px;">This is the entire idea behind every addition you'll do in any base: a carry is never a magic rule — it's just "one full group moved left."</div>
  `;
}

registerPage("carry", carryVizBody, function (root) {
  function wire() {
    root.querySelectorAll("#cv-basePills .pill").forEach(btn => {
      btn.addEventListener("click", () => {
        carryVizState.base = parseInt(btn.getAttribute("data-base"), 10);
        carryVizState.a = 0; carryVizState.b = 0;
        root.innerHTML = carryVizBody();
        wire();
      });
    });
    root.querySelectorAll("#cv-aSelect .pill").forEach(btn => {
      btn.addEventListener("click", () => { carryVizState.a = parseInt(btn.getAttribute("data-val"), 10); root.innerHTML = carryVizBody(); wire(); });
    });
    root.querySelectorAll("#cv-bSelect .pill").forEach(btn => {
      btn.addEventListener("click", () => { carryVizState.b = parseInt(btn.getAttribute("data-val"), 10); root.innerHTML = carryVizBody(); wire(); });
    });
  }
  wire();
});

/* ============================================================
   COLUMN ADDITION RENDER HELPERS (static + interactive stepper)
   ============================================================ */
function renderAdditionColumnsStatic(aStr, bStr, base, stagger) {
  stagger = stagger || 220;
  const { cols, finalCarry } = addColumns(aStr, bStr, base);
  const len = cols.length;
  const delayFor = (i) => (len - 1 - i) * stagger;

  const carryRow = `<div class="add-row"><div class="op-sign">&nbsp;</div>${cols.map((c, i) =>
    `<div class="col-slot">${c.carryIn ? `<div class="carry-chip fade-in" style="animation-delay:${delayFor(i)}ms">+1</div>` : "&nbsp;"}</div>`).join("")}</div>`;
  const aRow = `<div class="add-row"><div class="op-sign">&nbsp;</div>${cols.map(c => `<div class="col-slot">${digitBox(valDigit(c.a), { base })}</div>`).join("")}</div>`;
  const bRow = `<div class="add-row"><div class="op-sign">+</div>${cols.map(c => `<div class="col-slot">${digitBox(valDigit(c.b), { base })}</div>`).join("")}</div>`;
  const resultColsHTML = cols.map((c, i) =>
    `<div class="col-slot">${digitBox(valDigit(c.resultDigit), { base, filled: true, extra: "fade-in", style: `animation-delay:${delayFor(i)}ms` })}</div>`).join("");
  const resultRow = `<div class="add-row"><div class="op-sign">&nbsp;</div>
    ${finalCarry ? `<div class="col-slot slot-sm">${digitBox(valDigit(finalCarry), { base, filled: true, extra: "fade-in", style: `animation-delay:${len * stagger}ms` })}</div>` : ""}
    ${resultColsHTML}</div>`;
  return `<div class="add-table">${carryRow}${aRow}${bRow}<div class="add-rule"></div>${resultRow}</div>`;
}

function additionStepperMarkup(aStr, bStr, base, revealed) {
  const { cols, finalCarry } = addColumns(aStr, bStr, base);
  const len = cols.length;
  const carryRow = `<div class="add-row"><div class="op-sign">&nbsp;</div>${cols.map((c, i) => {
    if (c.isPoint) return `<div class="col-slot" style="width:16px;">&nbsp;</div>`;
    const posFromRight = len - 1 - i;
    const isRevealed = posFromRight < revealed;
    return `<div class="col-slot">${(isRevealed && c.carryIn) ? `<div class="carry-chip">+1</div>` : "&nbsp;"}</div>`;
  }).join("")}</div>`;
  const aRow = `<div class="add-row"><div class="op-sign">&nbsp;</div>${cols.map(c => {
    if (c.isPoint) return `<div class="col-slot" style="width:16px; font-weight:bold; font-size:24px; padding-bottom:4px; color:var(--text);">.</div>`;
    return `<div class="col-slot">${digitBox(valDigit(c.a), { base })}</div>`;
  }).join("")}</div>`;
  const bRow = `<div class="add-row"><div class="op-sign">+</div>${cols.map(c => {
    if (c.isPoint) return `<div class="col-slot" style="width:16px; font-weight:bold; font-size:24px; padding-bottom:4px; color:var(--text);">.</div>`;
    return `<div class="col-slot">${digitBox(valDigit(c.b), { base })}</div>`;
  }).join("")}</div>`;
  const resultColsHTML = cols.map((c, i) => {
    if (c.isPoint) return `<div class="col-slot" style="width:16px; font-weight:bold; font-size:24px; padding-bottom:4px; color:var(--primary);">.</div>`;
    const posFromRight = len - 1 - i;
    const isRevealed = posFromRight < revealed;
    return `<div class="col-slot">${isRevealed ? digitBox(valDigit(c.resultDigit), { base, filled: true, state: "pop" }) : digitBox("?", { extra: "ghost" })}</div>`;
  }).join("");
  const extraRevealed = revealed > len;
  const resultRow = `<div class="add-row"><div class="op-sign">&nbsp;</div>
    ${finalCarry ? `<div class="col-slot slot-sm">${extraRevealed ? digitBox(valDigit(finalCarry), { base, filled: true, state: "pop" }) : digitBox("?", { extra: "ghost", size: "sm" })}</div>` : ""}
    ${resultColsHTML}</div>`;
  return `<div class="add-table">${carryRow}${aRow}${bRow}<div class="add-rule"></div>${resultRow}</div>`;
}
function wireAdditionStepper(container, aStr, bStr, base) {
  let revealed = 0;
  let playing = false;
  let playInterval = null;
  let lastExplain = "Click Play to watch, or use Previous/Next to step through manually.";
  const { cols, finalCarry } = addColumns(aStr, bStr, base);
  const len = cols.length;
  const totalSteps = len + (finalCarry ? 1 : 0);

  function computeExplain(stepIdx) {
    if (stepIdx < len) {
      const colArrIdx = len - 1 - stepIdx;
      const c = cols[colArrIdx];
      if (c.isPoint) return "Radix point column. Just bring it straight down.";
      const total = c.a + c.b + c.carryIn;
      let txt = `${valDigit(c.a)} + ${valDigit(c.b)}${c.carryIn ? " + 1 carried in" : ""} = ${total} (decimal). `;
      if (c.carryOut) txt += `${total} is exactly one full group of ${base} plus ${c.resultDigit} left over. So we write ${valDigit(c.resultDigit)} and carry 1 to the next position.`;
      else txt += `Since ${total} is less than ${base}, we just write ${valDigit(c.resultDigit)}. No carry needed.`;
      return txt;
    }
    return `Every column is done, but there's one carry left over with nowhere left to go — it becomes a brand-new leading digit: ${valDigit(finalCarry)}.`;
  }
  
  function pause() {
    playing = false;
    clearInterval(playInterval);
    render();
  }
  function play() {
    if (revealed >= totalSteps) {
      revealed = 0;
    }
    playing = true;
    render();
    playInterval = setInterval(() => {
      if (revealed < totalSteps) {
        lastExplain = computeExplain(revealed);
        revealed++;
        render();
      } else {
        pause();
      }
    }, 1500);
  }
  function render() {
    container.innerHTML = additionStepperMarkup(aStr, bStr, base, revealed) +
      `<div class="step-controls">
        <button class="btn btn-ghost btn-sm" id="stepPrevBtn" ${revealed <= 0 ? "disabled" : ""}>← Previous</button>
        <button class="btn btn-primary btn-sm" id="stepPlayPauseBtn">${playing ? "Pause" : (revealed >= totalSteps ? "Restart" : "Play")}</button>
        <button class="btn btn-ghost btn-sm" id="stepNextBtn" ${revealed >= totalSteps ? "disabled" : ""}>Next →</button>
      </div>
      <div class="step-explain">${callout(lastExplain, revealed > 0 ? "carry-note" : "")}</div>`;
    
    const prevBtn = document.getElementById("stepPrevBtn");
    if (prevBtn) prevBtn.addEventListener("click", () => { 
      pause(); 
      if (revealed > 0) { 
        revealed--; 
        lastExplain = revealed === 0 ? "Click Play to watch, or use Previous/Next to step through manually." : computeExplain(revealed - 1); 
        render(); 
      } 
    });

    const nextBtn = document.getElementById("stepNextBtn");
    if (nextBtn) nextBtn.addEventListener("click", () => { 
      pause(); 
      if (revealed < totalSteps) { 
        lastExplain = computeExplain(revealed); 
        revealed++; 
        render(); 
      } 
    });

    const playPauseBtn = document.getElementById("stepPlayPauseBtn");
    if (playPauseBtn) playPauseBtn.addEventListener("click", () => {
      if (playing) pause(); else play();
    });
  }
  render();
}

/* ============================================================
   MODULE 8 — Addition
   ============================================================ */
const addState = { base: 2 };
const ADD_EXAMPLES = {
  2: { a: "1011", b: "0110" },
  8: { a: "725", b: "156" },
  10: { a: "487", b: "265" },
  16: { a: "3F", b: "A7" }
};
const ADD_YOUR_TURN = {
  2: { a: "1101", b: "1011" },
  8: { a: "643", b: "275" },
  10: { a: "958", b: "347" },
  16: { a: "B4", b: "7E" }
};

function m8Body() {
  const base = addState.base;
  const info = BASE_INFO[base];
  const ex = ADD_EXAMPLES[base];
  const yt = ADD_YOUR_TURN[base];
  return `
  ${lessonHeader("Module 8 · Arithmetic", "Addition", "Same process, every base: add each column, and if the total reaches the base, carry one full group left.")}
  <div class="rail">
    ${railBlock("Concept", "The fundamental cases, in binary", "Binary addition has only four possible column combinations. Three are obvious. The fourth is where carrying is born.", `
      <div class="tool-grid">
        <div class="panel" style="padding:14px;"><div class="mono" style="font-size:15px;">0 + 0 → <b>0</b></div></div>
        <div class="panel" style="padding:14px;"><div class="mono" style="font-size:15px;">0 + 1 → <b>1</b></div></div>
        <div class="panel" style="padding:14px;"><div class="mono" style="font-size:15px;">1 + 0 → <b>1</b></div></div>
        <div class="panel" style="padding:14px;background:var(--carry-soft);"><div class="mono" style="font-size:15px;">1 + 1 → <b>0</b> + carry 1</div></div>
      </div>
      <div style="text-align:center;margin:18px 0;">
        <div class="mono" style="font-size:15px;margin-bottom:8px;">● + ● = two units</div>
        <div>${unitsGroupedHTML(2, 2)}</div>
        <p style="margin-top:10px;">Binary's "full group" is just 2 units. Two units make exactly one complete group — so this position resets to 0, and that one group carries into the next position.</p>
      </div>
    `)}

    ${railBlock("Watch it happen", "A full multi-digit addition", `Pick a base below and watch <b>${ex.a} + ${ex.b}</b> resolve column by column, right to left.`, `
      <div class="pill-select" id="add-basePills" style="margin-bottom:16px;">
        ${[2, 8, 10, 16].map(b => `<button class="pill ${base === b ? "active" : ""}" style="--accent:${BASE_INFO[b].color}" data-base="${b}">${BASE_INFO[b].name}</button>`).join("")}
      </div>
      <div id="add-staticDemo">${renderAdditionColumnsStatic(ex.a, ex.b, base)}</div>
      ${callout(`Every time a column's total reaches ${base}, one full group carries left — exactly like the Carry Visualizer showed.`, "tip")}
    `)}

    ${railBlock("Your turn", "Reveal it column by column", `Now try <b>${yt.a} + ${yt.b}</b> yourself — reveal one column at a time and read the explanation for each.`, `
      <div id="add-stepper"></div>
    `)}

    ${railBlock("Quick Test", "Addition practice", "", `<div id="m8-quiz"></div>`)}
  </div>`;
}

registerPage("m8", m8Body, function (root) {
  function wire() {
    root.querySelectorAll("#add-basePills .pill").forEach(btn => {
      btn.addEventListener("click", () => {
        addState.base = parseInt(btn.getAttribute("data-base"), 10);
        root.innerHTML = m8Body();
        wire();
        initQuiz();
        wireAdditionStepper(document.getElementById("add-stepper"), ADD_YOUR_TURN[addState.base].a, ADD_YOUR_TURN[addState.base].b, addState.base);
      });
    });
  }
  wire();
  wireAdditionStepper(document.getElementById("add-stepper"), ADD_YOUR_TURN[addState.base].a, ADD_YOUR_TURN[addState.base].b, addState.base);

  function initQuiz() {
    const base = addState.base;
    const questions = [
      { type: "text", topic: "addition", mistakeType: "carry-missed",
        prompt: `Add ${ADD_EXAMPLES[base].a} + ${ADD_EXAMPLES[base].b} in ${BASE_INFO[base].name.toLowerCase()}.`,
        correct: addColumns(ADD_EXAMPLES[base].a, ADD_EXAMPLES[base].b, base).resultStr,
        explain: `Column by column with carries: ${addColumns(ADD_EXAMPLES[base].a, ADD_EXAMPLES[base].b, base).resultStr}.` },
      { type: "mc", topic: "addition", mistakeType: "carry-concept",
        prompt: "A carry happens when...",
        options: ["a column's total is less than the base", "a column's total reaches or exceeds the base", "you're adding more than two numbers", "the digits are both zero"], correctIndex: 1,
        explain: "Once a column's total reaches the base, that position can't hold it as one digit — one full group carries left." },
      { type: "text", topic: "addition", mistakeType: "carry-missed",
        prompt: `Add ${ADD_YOUR_TURN[base].a} + ${ADD_YOUR_TURN[base].b} in ${BASE_INFO[base].name.toLowerCase()}.`,
        correct: addColumns(ADD_YOUR_TURN[base].a, ADD_YOUR_TURN[base].b, base).resultStr,
        explain: `Result: ${addColumns(ADD_YOUR_TURN[base].a, ADD_YOUR_TURN[base].b, base).resultStr}.` }
    ];
    runQuiz(document.getElementById("m8-quiz"), questions, { moduleId: "m8", nextId: "m9" });
  }
  initQuiz();
});

/* ============================================================
   COLUMN SUBTRACTION RENDER HELPERS (static + interactive stepper)
   ============================================================ */
function renderSubtractionColumnsStatic(aStr, bStr, base, stagger) {
  stagger = stagger || 260;
  const { cols } = subColumns(aStr, bStr, base);
  const len = cols.length;
  const delayFor = (i) => (len - 1 - i) * stagger;

  const borrowRow = `<div class="add-row"><div class="op-sign">&nbsp;</div>${cols.map((c, i) =>
    `<div class="col-slot">${c.borrowIn ? `<div class="borrow-chip fade-in" style="animation-delay:${delayFor(i)}ms">−1</div>` : "&nbsp;"}</div>`).join("")}</div>`;
  const aRow = `<div class="add-row"><div class="op-sign">&nbsp;</div>${cols.map(c => `<div class="col-slot">${digitBox(valDigit(c.aOrig), { base })}</div>`).join("")}</div>`;
  const bRow = `<div class="add-row"><div class="op-sign">−</div>${cols.map(c => `<div class="col-slot">${digitBox(valDigit(c.b), { base })}</div>`).join("")}</div>`;
  const resultRow = `<div class="add-row"><div class="op-sign">&nbsp;</div>${cols.map((c, i) =>
    `<div class="col-slot">${digitBox(valDigit(c.resultDigit), { base, filled: true, extra: "fade-in", style: `animation-delay:${delayFor(i)}ms` })}</div>`).join("")}</div>`;
  return `<div class="add-table">${borrowRow}${aRow}${bRow}<div class="add-rule"></div>${resultRow}</div>`;
}

function subtractionStepperMarkup(aStr, bStr, base, revealed) {
  const { cols } = subColumns(aStr, bStr, base);
  const len = cols.length;
  const borrowRow = `<div class="add-row"><div class="op-sign">&nbsp;</div>${cols.map((c, i) => {
    if (c.isPoint) return `<div class="col-slot" style="width:16px;">&nbsp;</div>`;
    const posFromRight = len - 1 - i;
    const isRevealed = posFromRight < revealed;
    return `<div class="col-slot">${(isRevealed && c.borrowIn) ? `<div class="carry-chip" style="background:var(--borrow-soft);color:var(--borrow);border-color:var(--borrow-soft);">−1</div>` : "&nbsp;"}</div>`;
  }).join("")}</div>`;
  const aRow = `<div class="add-row"><div class="op-sign">&nbsp;</div>${cols.map(c => {
    if (c.isPoint) return `<div class="col-slot" style="width:16px; font-weight:bold; font-size:24px; padding-bottom:4px; color:var(--text);">.</div>`;
    return `<div class="col-slot">${digitBox(valDigit(c.aOrig), { base })}</div>`;
  }).join("")}</div>`;
  const bRow = `<div class="add-row"><div class="op-sign">−</div>${cols.map(c => {
    if (c.isPoint) return `<div class="col-slot" style="width:16px; font-weight:bold; font-size:24px; padding-bottom:4px; color:var(--text);">.</div>`;
    return `<div class="col-slot">${digitBox(valDigit(c.b), { base })}</div>`;
  }).join("")}</div>`;
  const resultColsHTML = cols.map((c, i) => {
    if (c.isPoint) return `<div class="col-slot" style="width:16px; font-weight:bold; font-size:24px; padding-bottom:4px; color:var(--primary);">.</div>`;
    const posFromRight = len - 1 - i;
    const isRevealed = posFromRight < revealed;
    return `<div class="col-slot">${isRevealed ? digitBox(valDigit(c.resultDigit), { base, filled: true, state: "pop", color: "var(--borrow)" }) : digitBox("?", { extra: "ghost" })}</div>`;
  }).join("");
  const resultRow = `<div class="add-row"><div class="op-sign">&nbsp;</div>${resultColsHTML}</div>`;
  return `<div class="add-table">${borrowRow}${aRow}${bRow}<div class="add-rule"></div>${resultRow}</div>`;
}
function wireSubtractionStepper(container, aStr, bStr, base) {
  let revealed = 0;
  let playing = false;
  let playInterval = null;
  let lastExplain = "Click Play to watch, or use Previous/Next to step through manually.";
  const { cols } = subColumns(aStr, bStr, base);
  const len = cols.length;

  function computeExplain(stepIdx) {
    const colArrIdx = len - 1 - stepIdx;
    const c = cols[colArrIdx];
    if (c.isPoint) return "Radix point column. Just bring it straight down.";
    if (!c.borrowIn) {
      if (c.borrowOut) return `${valDigit(c.aOrig)} is smaller than ${valDigit(c.b)}, so this column can't subtract directly — it borrows one full group of ${base} from the column to its left, becoming ${c.aOrig + base}. ${c.aOrig + base} − ${valDigit(c.b)} = ${valDigit(c.resultDigit)}.`;
      return `${valDigit(c.aOrig)} − ${valDigit(c.b)} = ${valDigit(c.resultDigit)}. No borrowing needed — the top digit was already big enough.`;
    }
    const effective = c.aOrig - 1;
    if (effective < 0) {
      return `This column's digit was already 0. After lending 1 to the column on its right, it can't pay either — so it must borrow from further left too, and the chain keeps travelling.`;
    }
    let txt = `This column lent 1 to the column on its right, so its digit drops from ${valDigit(c.aOrig)} to ${effective} before its own subtraction. `;
    txt += c.borrowOut
      ? `${effective} is still smaller than ${valDigit(c.b)}, so it also needs to borrow ${base} from further left: ${effective + base} − ${valDigit(c.b)} = ${valDigit(c.resultDigit)}.`
      : `${effective} − ${valDigit(c.b)} = ${valDigit(c.resultDigit)}. No further borrowing needed.`;
    return txt;
  }

  function pause() {
    playing = false;
    clearInterval(playInterval);
    render();
  }

  function play() {
    if (revealed >= len) {
      revealed = 0;
    }
    playing = true;
    render();
    playInterval = setInterval(() => {
      if (revealed < len) {
        lastExplain = computeExplain(revealed);
        revealed++;
        render();
      } else {
        pause();
      }
    }, 1500);
  }

  function render() {
    container.innerHTML = subtractionStepperMarkup(aStr, bStr, base, revealed) +
      `<div class="step-controls">
        <button class="btn btn-ghost btn-sm" id="subStepPrevBtn" ${revealed <= 0 ? "disabled" : ""}>← Previous</button>
        <button class="btn btn-primary btn-sm" id="subStepPlayPauseBtn">${playing ? "Pause" : (revealed >= len ? "Restart" : "Play")}</button>
        <button class="btn btn-ghost btn-sm" id="subStepNextBtn" ${revealed >= len ? "disabled" : ""}>Next →</button>
      </div>
      <div class="step-explain">${callout(lastExplain, revealed > 0 ? "borrow-note" : "")}</div>`;
      
    const prevBtn = document.getElementById("subStepPrevBtn");
    if (prevBtn) prevBtn.addEventListener("click", () => { 
      pause(); 
      if (revealed > 0) { 
        revealed--; 
        lastExplain = revealed === 0 ? "Click Play to watch, or use Previous/Next to step through manually." : computeExplain(revealed - 1); 
        render(); 
      } 
    });

    const nextBtn = document.getElementById("subStepNextBtn");
    if (nextBtn) nextBtn.addEventListener("click", () => { 
      pause(); 
      if (revealed < len) { 
        lastExplain = computeExplain(revealed); 
        revealed++; 
        render(); 
      } 
    });

    const playPauseBtn = document.getElementById("subStepPlayPauseBtn");
    if (playPauseBtn) playPauseBtn.addEventListener("click", () => {
      if (playing) pause(); else play();
    });
  }
  render();
}

/* ============================================================
   MODULE 9 — Subtraction & Borrowing
   ============================================================ */
const subState = { base: 10 };
const SUB_EXAMPLES = { 2: { a: "1011", b: "0110" }, 8: { a: "725", b: "156" }, 10: { a: "52", b: "17" }, 16: { a: "A0", b: "1F" } };
const SUB_YOUR_TURN = { 2: { a: "1100", b: "0101" }, 8: { a: "604", b: "236" }, 10: { a: "802", b: "365" }, 16: { a: "B0", b: "4C" } };

function m9Body() {
  const base = subState.base;
  const ex = SUB_EXAMPLES[base];
  const yt = SUB_YOUR_TURN[base];
  return `
  ${lessonHeader("Module 9 · Arithmetic", "Subtraction & Borrowing", "When the top digit is too small, it borrows one full group of \"base\" from its left neighbor.")}
  <div class="rail">
    ${railBlock("Concept", "Without borrowing first", "When every top digit is already big enough, subtraction is just column by column, no tricks.", `
      <div style="text-align:center;">${renderSubtractionColumnsStatic("86", "43", 10, 0)}</div>
      ${callout("8≥4 and 6≥3 in every column, so nothing needs to move. This is the easy case.", "tip")}
    `)}

    ${railBlock("Visual", "Now introduce borrowing", `In <b>${ex.a} − ${ex.b}</b>, watch for the column where the top digit is too small.`, `
      <div class="pill-select" id="sub-basePills" style="margin-bottom:16px;">
        ${[2, 8, 10, 16].map(b => `<button class="pill ${base === b ? "active" : ""}" style="--accent:${BASE_INFO[b].color}" data-base="${b}">${BASE_INFO[b].name}</button>`).join("")}
      </div>
      <div style="text-align:center;" id="sub-staticDemo">${renderSubtractionColumnsStatic(ex.a, ex.b, base)}</div>
      ${callout(`One unit from the position to the left becomes a complete group of ${base} in the column that needed it — that's a borrow.`, "borrow-note")}
    `)}

    ${railBlock("Your turn", "Reveal it column by column", `Try <b>${yt.a} − ${yt.b}</b> yourself.`, `<div id="sub-stepper"></div>`)}

    ${railBlock("Quick Test", "Subtraction practice", "", `<div id="m9-quiz"></div>`)}
  </div>`;
}

registerPage("m9", m9Body, function (root) {
  function wire() {
    root.querySelectorAll("#sub-basePills .pill").forEach(btn => {
      btn.addEventListener("click", () => {
        subState.base = parseInt(btn.getAttribute("data-base"), 10);
        root.innerHTML = m9Body();
        wire();
        initQuiz();
        wireSubtractionStepper(document.getElementById("sub-stepper"), SUB_YOUR_TURN[subState.base].a, SUB_YOUR_TURN[subState.base].b, subState.base);
      });
    });
  }
  wire();
  wireSubtractionStepper(document.getElementById("sub-stepper"), SUB_YOUR_TURN[subState.base].a, SUB_YOUR_TURN[subState.base].b, subState.base);

  function initQuiz() {
    const base = subState.base;
    const questions = [
      { type: "text", topic: "subtraction", mistakeType: "borrow-missed",
        prompt: `Subtract ${SUB_EXAMPLES[base].a} − ${SUB_EXAMPLES[base].b} in ${BASE_INFO[base].name.toLowerCase()}.`,
        correct: subColumns(SUB_EXAMPLES[base].a, SUB_EXAMPLES[base].b, base).resultStr,
        explain: `Working column by column with borrows: ${subColumns(SUB_EXAMPLES[base].a, SUB_EXAMPLES[base].b, base).resultStr}.` },
      { type: "mc", topic: "subtraction", mistakeType: "borrow-concept",
        prompt: "Borrowing happens when...",
        options: ["the bottom digit is zero", "the top digit is smaller than the bottom digit", "both digits are equal", "you're subtracting in binary specifically"], correctIndex: 1,
        explain: "Whenever the top digit can't cover the bottom digit, the column borrows one full group from its left neighbor to become big enough." },
      { type: "text", topic: "subtraction", mistakeType: "borrow-missed",
        prompt: `Subtract ${SUB_YOUR_TURN[base].a} − ${SUB_YOUR_TURN[base].b} in ${BASE_INFO[base].name.toLowerCase()}.`,
        correct: subColumns(SUB_YOUR_TURN[base].a, SUB_YOUR_TURN[base].b, base).resultStr,
        explain: `Result: ${subColumns(SUB_YOUR_TURN[base].a, SUB_YOUR_TURN[base].b, base).resultStr}.` }
    ];
    runQuiz(document.getElementById("m9-quiz"), questions, { moduleId: "m9", nextId: "chainborrow" });
  }
  initQuiz();
});

/* ============================================================
   CHAIN BORROWING (standalone deep-dive)
   ============================================================ */
registerPage("chainborrow", function () {
  return `
  ${lessonHeader("Deep Dive", "Chain Borrowing", "What happens when the neighbor you need to borrow from is also 0? The borrow keeps travelling left until it finds a digit that can actually lend.")}
  <div class="rail">
    ${railBlock("Concept", "The chain reaction", "In 10000₂ − 00001₂, the rightmost column needs to borrow — but every neighbor to its left is 0, all the way up to the leading 1. Watch the borrow travel through every zero.", `
      <div style="text-align:center;">${renderSubtractionColumnsStatic("10000", "00001", 2, 320)}</div>
      ${callout("A 0 has nothing to lend. So it borrows from further left first (making itself a full group), lends 1 away, and is left with one less than a full group.", "borrow-note")}
    `)}

    ${railBlock("Watch it happen", "Step through it yourself", "Reveal one column at a time — notice the −1 chip appears on every zero along the way, not just the first column.", `<div id="cb-stepper"></div>`)}

    ${railBlock("Visual", "The same chain in octal and hexadecimal", "The travelling-through-zeros pattern is identical in every base — only the digit symbols change.", `
      <div class="tool-grid">
        <div>${badge(8)}<div style="text-align:center;margin-top:10px;">${renderSubtractionColumnsStatic("400", "001", 8, 0)}</div></div>
        <div>${badge(16)}<div style="text-align:center;margin-top:10px;">${renderSubtractionColumnsStatic("100", "001", 16, 0)}</div></div>
      </div>
    `)}

    ${railBlock("Quick Test", "Chain borrowing checks", "", `<div id="cb-quiz"></div>`)}
  </div>`;
}, function (root) {
  wireSubtractionStepper(document.getElementById("cb-stepper"), "10000", "00001", 2);

  const questions = [
    { type: "mc", topic: "subtraction", mistakeType: "chain-borrow",
      prompt: "When a column needs to borrow but its left neighbor is 0, what happens?",
      options: ["The subtraction is impossible", "The 0 borrows from further left first, then lends", "You skip that column", "The result is automatically 0"], correctIndex: 1,
      explain: "A 0 has nothing to give — so it first borrows a full group from further left, then passes one unit along. The borrow keeps travelling until it finds a nonzero digit." },
    { type: "text", topic: "subtraction", mistakeType: "chain-borrow",
      prompt: "Subtract 1000₂ − 0001₂.",
      correct: "111",
      explain: "The borrow travels through all three zeros before reaching the leading 1: result is 0111 → 111." },
    { type: "text", topic: "subtraction", mistakeType: "chain-borrow",
      prompt: "Subtract 500₈ − 001₈.",
      correct: "477",
      explain: "The borrow travels through both zeros: 5 becomes 4 after lending, and each 0 becomes 7 (one less than a full group of 8)." }
  ];
  runQuiz(document.getElementById("cb-quiz"), questions, { moduleId: "chainborrow", nextId: "complement" });
});

/* ============================================================
   MODULE 10 — Complement Method
   ============================================================ */
function invertBinary(s) { return s.split("").map(b => b === "0" ? "1" : "0").join(""); }
function twosComplement(binStr) {
  const inverted = invertBinary(binStr);
  const r = addColumns(inverted, padLeft("1", binStr.length), 2);
  let res = r.resultStr;
  if (res.length > binStr.length) res = res.slice(res.length - binStr.length);
  return res;
}

registerPage("complement", function () {
  const orig = "1010";
  const comp = twosComplement(orig);
  const a = "1010", b = "0011";
  const bComp = twosComplement(b);
  const sum = addColumns(a, bComp, 2);
  const dropped = sum.resultStr.length > a.length ? sum.resultStr.slice(1) : sum.resultStr;
  return `
  ${lessonHeader("Module 10 · Arithmetic", "The Complement Method", "A clever shortcut: turn subtraction into addition by flipping the number you're subtracting.")}
  <div class="rail">
    ${railBlock("Concept", "Building the two's complement", `Start with <b>${orig}</b>. Flip every bit (0→1, 1→0), then add 1.`, `
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:center;">
        <div class="digit-slot-group"><div class="ledger">${orig.split("").map(d => digitBox(d, { base: 2 })).join("")}</div><div class="place-label">original</div></div>
        <div class="trail-arrow">invert every bit →</div>
        <div class="digit-slot-group"><div class="ledger">${invertBinary(orig).split("").map(d => digitBox(d, { base: 2, filled: true })).join("")}</div><div class="place-label">inverted</div></div>
      </div>
      <div style="text-align:center;margin-top:20px;">${renderAdditionColumnsStatic(invertBinary(orig), padLeft("1", orig.length), 2, 0)}</div>
      ${callout(`<b>${comp}</b> is the two's complement of ${orig} — it behaves like "negative ${orig}" in binary addition.`, "tip")}
    `)}

    ${railBlock("Watch it happen", "Subtraction through addition", `Instead of computing ${a} − ${b} directly, add ${a} to the two's complement of ${b}.`, `
      <div class="mono" style="text-align:center;margin-bottom:14px;">two's complement of ${b} is <b>${bComp}</b></div>
      <div style="text-align:center;">${renderAdditionColumnsStatic(a, bComp, 2, 0)}</div>
      ${callout(`The addition produced an extra leading bit beyond our 4-bit width — drop it. What's left, <b>${dropped}</b>, is exactly ${a} − ${b} (that's ${baseToInt(a, 2)} − ${baseToInt(b, 2)} = ${baseToInt(a, 2) - baseToInt(b, 2)}).`, "carry-note")}
    `)}

    ${railBlock("Visual", "The same idea beyond binary", "Octal and hexadecimal have a matching trick — a radix complement: subtract every digit from (base − 1), then add 1 to the whole number. It plays the same role two's complement does in binary.", `
      <div class="mono" style="font-size:13.5px;">Octal example: complement of 052₈ → each digit from 7: 725 → +1 → <b>726₈</b></div>
    `)}

    ${railBlock("Quick Test", "Complement checks", "", `<div id="complement-quiz"></div>`)}
  </div>`;
}, function (root) {
  const questions = [
    { type: "text", topic: "subtraction", mistakeType: "complement",
      prompt: "Find the two's complement of 0110.",
      correct: "1010",
      explain: "Invert: 1001. Add 1: 1010." },
    { type: "mc", topic: "subtraction", mistakeType: "complement",
      prompt: "Why does the complement method work for subtraction?",
      options: ["It rounds the numbers", "The complement behaves like a negative version of the number in addition", "It only works for even numbers", "It avoids using binary"], correctIndex: 1,
      explain: "Adding a number's complement has the same effect as subtracting that number — so A − B becomes A + complement(B)." },
    { type: "mc", topic: "subtraction", mistakeType: "complement",
      prompt: "After adding A and the complement of B, what do you do with an extra leading bit beyond the original width?",
      options: ["Keep it as part of the answer", "Drop it — the remaining bits are the answer", "It means the answer is negative", "Add it again"], correctIndex: 1,
      explain: "That overflow bit falls outside your working width and is simply discarded; what remains is the correct result." }
  ];
  runQuiz(document.getElementById("complement-quiz"), questions, { moduleId: "complement", nextId: "multiply" });
});

/* ============================================================
   MODULE 11 — Multiplication
   ============================================================ */


function multiplyLong(mStr, nStr, base) {
  const hasPoint = mStr.includes('.') || nStr.includes('.');
  let mFracLen = mStr.includes('.') ? mStr.length - 1 - mStr.indexOf('.') : 0;
  let nFracLen = nStr.includes('.') ? nStr.length - 1 - nStr.indexOf('.') : 0;
  const totalFracLen = mFracLen + nFracLen;
  
  const mClean = mStr.replace('.', '');
  const nClean = nStr.replace('.', '');
  
  const mVal = baseToInt(mClean, base);
  const nDigits = nClean.split("");
  const partials = [];
  for (let i = nDigits.length - 1; i >= 0; i--) {
    const digit = digitVal(nDigits[i]);
    const shift = nDigits.length - 1 - i;
    const product = mVal * digit;
    const productStr = intToBase(product, base);
    partials.push({ digit, shift, productStr });
  }
  const finalSum = partials.reduce((acc, p) => acc + baseToInt(p.productStr, base) * Math.pow(base, p.shift), 0);
  let resultStr = intToBase(finalSum, base);
  
  if (totalFracLen > 0) {
    resultStr = resultStr.padStart(totalFracLen + 1, '0');
    const splitIdx = resultStr.length - totalFracLen;
    resultStr = resultStr.slice(0, splitIdx) + '.' + resultStr.slice(splitIdx);
  }
  return { mVal, partials, resultStr, finalSum, totalFracLen };
}

function multRowHTML(digitsStr, shift, signChar, base, addPoints) {
  let html = `<div class="add-row"><div class="op-sign">${signChar || "&nbsp;"}</div>`;
  html += digitsStr.split("").map(d => {
    if (d === '.') return `<div class="col-slot" style="width:16px; font-weight:bold; font-size:24px; padding-bottom:4px; color:var(--text);">.</div>`;
    return `<div class="col-slot">${digitBox(d, { base, filled: true, extra: "fade-in" })}</div>`;
  }).join("");
  for (let i = 0; i < shift; i++) {
    html += `<div class="col-slot">${digitBox('0', { base, extra: "ghost" })}</div>`;
  }
  html += `</div>`;
  return html;
}

function renderMultiplicationLong(mStr, nStr, base) {
  const { partials, resultStr, totalFracLen } = multiplyLong(mStr, nStr, base);
  let html = `<div class="add-table" style="display:inline-flex; flex-direction:column; align-items:flex-end;">`;
  html += multRowHTML(mStr, 0, "", base);
  html += multRowHTML(nStr, 0, "×", base);
  html += `<div class="add-rule" style="width:100%;"></div>`;
  partials.forEach((p, idx) => {
    let pStr = p.productStr;
    html += multRowHTML(pStr, p.shift, idx === 0 ? "" : "+", base);
  });
  if (partials.length > 1) {
    html += `<div class="add-rule" style="width:100%;"></div>`;
    html += multRowHTML(resultStr.replace('.', ''), 0, "", base);
  }
  if (totalFracLen > 0) {
    html += `<div class="add-rule" style="width:100%;"></div>`;
    html += multRowHTML(resultStr, 0, "Final", base);
  }
  html += `</div>`;
  return html;
}

const multState = { base: 2 };
const MULT_EXAMPLES = { 2: { m: "101", n: "11" }, 8: { m: "47", n: "6" }, 10: { m: "36", n: "24" }, 16: { m: "2A", n: "B" } };

function m11Body() {
  const base = multState.base;
  const ex = MULT_EXAMPLES[base];
  return `
  ${lessonHeader("Module 11 · Arithmetic", "Multiplication", "Long multiplication works the same everywhere: multiply by one digit at a time, shift each partial product left, then add them all up.")}
  <div class="rail">
    ${railBlock("Concept", "One digit at a time, then shift", "Binary keeps this simple — each partial product is either all zeros (×0) or a copy of the top number (×1), shifted one place further left each time.", `
      <div style="text-align:center;">${renderMultiplicationLong("101", "11", 2)}</div>
      ${callout("Multiplying by the rightmost bit (1) gives 101 unshifted. Multiplying by the next bit (1) gives another 101, shifted one place left. Add those two rows together for the final answer.", "tip")}
    `)}

    ${railBlock("Watch it happen", "Pick a base", `Now see the same process play out with <b>${ex.m} × ${ex.n}</b>.`, `
      <div class="pill-select" id="mult-basePills" style="margin-bottom:16px;">
        ${[2, 8, 10, 16].map(b => `<button class="pill ${base === b ? "active" : ""}" style="--accent:${BASE_INFO[b].color}" data-base="${b}">${BASE_INFO[b].name}</button>`).join("")}
      </div>
      <div style="text-align:center;" id="mult-demo">${renderMultiplicationLong(ex.m, ex.n, base)}</div>
      ${callout(`Whenever a partial product's digit would exceed ${base - 1}, that column carries — exactly like in addition. Long multiplication is really just repeated addition wearing a shift.`, "carry-note")}
    `)}

    ${railBlock("Quick Test", "Multiplication practice", "", `<div id="m11-quiz"></div>`)}
  </div>`;
}

registerPage("multiply", m11Body, function (root) {
  function wire() {
    root.querySelectorAll("#mult-basePills .pill").forEach(btn => {
      btn.addEventListener("click", () => {
        multState.base = parseInt(btn.getAttribute("data-base"), 10);
        root.innerHTML = m11Body();
        wire();
        initQuiz();
      });
    });
  }
  wire();
  function initQuiz() {
    const base = multState.base;
    const ex = MULT_EXAMPLES[base];
    const questions = [
      { type: "text", topic: "multiplication", mistakeType: "mult-shift",
        prompt: `Multiply ${ex.m} × ${ex.n} in ${BASE_INFO[base].name.toLowerCase()}.`,
        correct: multiplyLong(ex.m, ex.n, base).resultStr,
        explain: `Each partial product shifts one place further left before summing: ${multiplyLong(ex.m, ex.n, base).resultStr}.` },
      { type: "mc", topic: "multiplication", mistakeType: "mult-shift",
        prompt: "Why does each partial product shift one place to the left?",
        options: ["To make the diagram look neater", "Because each successive multiplier digit is worth a higher place value", "It's only needed in binary", "To avoid carrying"], correctIndex: 1,
        explain: "The second digit from the right in the multiplier is worth base¹, not base⁰ — so its partial product must be shifted to reflect that higher place value." }
    ];
    runQuiz(document.getElementById("m11-quiz"), questions, { moduleId: "multiply" });
  }
  initQuiz();
});

/* ============================================================
   BOOTSTRAP
   ============================================================ */

/* ============================================================
   DETAILED ANIMATION PAGE (Dynamically generated from practice)
   ============================================================ */
function renderDetailedAnimationPage() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  
  if (mode === "arithmetic") {
    const op = params.get("op");
    const base = parseInt(params.get("base"), 10);
    const a = params.get("a");
    const b = params.get("b");
    const opName = op === "add" ? "Addition" : op === "sub" ? "Subtraction" : "Multiplication";
    
    return `
      ${lessonHeader("Detailed Visual Solution", `Base ${base} ${opName}`, `Step-by-step breakdown of ${a} ${op === "add" ? "+" : op === "sub" ? "−" : "×"} ${b}`)}
      <div class="rail">
        ${railBlock("Interactive Stepper", "Watch the columns resolve", "Press play to watch the exact operation column by column, or step through manually to read the detailed explanation for each position.", `
          <div id="detailed-stepper"></div>
        `)}
      </div>
    `;
  } else if (mode === "conversion") {
    const fromBase = parseInt(params.get("from"), 10);
    const toBase = parseInt(params.get("to"), 10);
    const qStr = params.get("q");
    
    return `
      ${lessonHeader("Detailed Visual Solution", `Base ${fromBase} to Base ${toBase}`, `Step-by-step conversion of ${qStr}`)}
      <div class="rail" id="detailed-conv-container">
      </div>
    `;
  }
  return "<p>Invalid parameters.</p>";
}

function initDetailedAnimationPage(root) {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  
  if (mode === "arithmetic") {
    const op = params.get("op");
    const base = parseInt(params.get("base"), 10);
    const a = params.get("a");
    const b = params.get("b");
    const container = root.querySelector("#detailed-stepper");
    if (!container) return;
    
    if (op === "add") {
      wireAdditionStepper(container, a, b, base);
    } else if (op === "sub") {
      wireSubtractionStepper(container, a, b, base);
    } else if (op === "mul") {
      container.style.textAlign = "center";
      container.innerHTML = renderMultiplicationLong(a, b, base);
    }
  } else if (mode === "conversion") {
    const fromBase = parseInt(params.get("from"), 10);
    const toBase = parseInt(params.get("to"), 10);
    const qStr = params.get("q");
    const container = root.querySelector("#detailed-conv-container");
    if (!container) return;
    
    
    // Determine conversion steps
    let html = "";
    const parts = qStr.split(".");
    
    if (fromBase !== 10 && toBase === 10) {
      // Base to Decimal
      html += railBlock("Integer Part Expansion", "Multiply by place values", `Read each digit and multiply it by its positional weight in Base ${fromBase}.`, `
        <div style="text-align:center;">${sumBreakdownHTML(parts[0], fromBase)}</div>
      `);
      if (parts[1]) {
        html += railBlock("Fractional Part Expansion", "Multiply by negative place values", `Read each fractional digit and multiply it by its negative positional weight.`, `
          <div style="text-align:center;">${sumBreakdownFracHTML(parts[1], fromBase)}</div>
        `);
      }
    } else if (fromBase === 10 && toBase !== 10) {
      // Decimal to Base
      const intPart = parseInt(parts[0], 10) || 0;
      html += railBlock("Integer Part", "Division Ladder", `Divide by ${toBase} repeatedly. Read the remainders from bottom to top.`, `
        <div style="text-align:center;">${divisionLadderHTML(intPart, toBase)}</div>
      `);
      
      if (parts[1]) {
        const fracStr = "0." + parts[1];
        const fracPart = parseFloat(fracStr);
        html += railBlock("Fractional Part", "Multiplication Ladder", `Multiply the fraction by ${toBase} repeatedly. Keep the integer digits from top to bottom.`, `
          <div style="text-align:center;">${fracLadderHTML(fracPart, toBase, 4)}</div>
        `);
      }
    } else {
      // Base to Base (via Decimal)
      html += railBlock("Step 1a: Convert Integer to Decimal", `Expand Base ${fromBase} to Decimal`, `First, bring ${qStr} integer part into Base 10.`, `
        <div style="text-align:center;">${sumBreakdownHTML(parts[0], fromBase)}</div>
      `);
      if (parts[1]) {
        html += railBlock("Step 1b: Convert Fraction to Decimal", `Expand Base ${fromBase} fraction to Decimal`, `Bring ${qStr} fractional part into Base 10.`, `
          <div style="text-align:center;">${sumBreakdownFracHTML(parts[1], fromBase)}</div>
        `);
      }
      
      // Calculate decimal value
      let decInt = 0;
      let intStr = parts[0];
      for (let i = 0; i < intStr.length; i++) {
        const val = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(intStr[i].toUpperCase());
        decInt += val * Math.pow(fromBase, intStr.length - 1 - i);
      }
      
      let decFrac = 0;
      if (parts[1]) {
        let fracStr = parts[1];
        for (let i = 0; i < fracStr.length; i++) {
          const val = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(fracStr[i].toUpperCase());
          decFrac += val * Math.pow(fromBase, -(i + 1));
        }
      }
      
      html += railBlock("Step 2: Decimal to Target Base", `Convert ${decInt + decFrac} to Base ${toBase}`, `Now, use the ladder methods to reach the final base.`, `
        <div style="text-align:center; margin-bottom: 24px;">${divisionLadderHTML(decInt, toBase)}</div>
        ${parts[1] ? `<div style="text-align:center;">${fracLadderHTML(decFrac, toBase, 4)}</div>` : ''}
      `);
    }

    container.innerHTML = html;
  }
}


function boot() {
  initGlobalDelegation();
  const params = new URLSearchParams(window.location.search);
  if (params.get("detailed") === "true") {
    registerPage("detailed-animation", renderDetailedAnimationPage, initDetailedAnimationPage);
    navigate("detailed-animation", { noScroll: true });
    return;
  }
  const mod = params.get("module") || window.location.hash.replace("#", "");
  navigate(PAGE_RENDERERS[mod] ? mod : "home", { noScroll: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

