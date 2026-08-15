/* =====================================================================
   NUMBER BASE ARITHMETIC TRAINER — APPLICATION SCRIPT
   Supports Binary, Octal and Hexadecimal — Addition, Subtraction
   and Multiplication. Light theme only.
   ===================================================================== */

/* ---------------------------------------------------------------------
   0. SHORTHANDS, CONSTANTS & GLOBAL STATE
   --------------------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const DIGIT_CHARS = '0123456789ABCDEF';

const BASE_NAMES = { 2: 'Binary', 8: 'Octal', 16: 'Hexadecimal' };
const OP_NAMES   = { add: 'Addition', sub: 'Subtraction', mul: 'Multiplication' };
const OP_SYMBOLS = { add: '+', sub: '\u2212', mul: '\u00d7' };

// Digit-count per difficulty level, tuned per base so problems stay
// a sensible size (bits for binary, digits for octal/hex).
const DIFFICULTY = {
  2:  { easy: 8, medium: 16, hard: 32, extreme: 64 },
  8:  { easy: 4, medium: 8,  hard: 12, extreme: 16 },
  16: { easy: 2, medium: 4,  hard: 8,  extreme: 12 },
};

const state = {
  base: 2,                  // 2 | 8 | 16
  op: 'add',                // 'add' | 'sub' | 'mul'
  level: 'easy',            // 'easy' | 'medium' | 'hard' | 'extreme'
  allowNegative: false,
  enablePoints: localStorage.getItem('enablePoints') === 'true',
  soundOn: true,
  hideBoxes: localStorage.getItem('hideBoxes') === 'true',

  history: [],               // list of generated question objects
  historyIndex: -1,
  // light theme only — no dark/light toggle

  timerHandle: null,
  timerStart: 0,
  elapsed: 0,
  timerRunning: false,

  session: { solved: 0, correct: 0, streak: 0, bestStreak: 0, totalTime: 0 },
  focusedBoxIndex: 0,
};

/* ---------------------------------------------------------------------
   1. SOUND EFFECTS (Web Audio API — no external files)
   --------------------------------------------------------------------- */
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}
function playTone(freq, duration, type = 'sine', gainPeak = 0.18) {
  if (!state.soundOn) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(gainPeak, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  } catch (e) { /* audio unavailable — fail silently */ }
}
const playClickSound   = () => playTone(520, 0.06, 'square', 0.1);
const playSuccessSound = () => { playTone(660, 0.12, 'sine'); setTimeout(() => playTone(880, 0.18, 'sine'), 90); };
const playErrorSound   = () => { playTone(180, 0.22, 'sawtooth', 0.14); };

// Global listener for button click audio feedback across all UI controls
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button, .btn, .chip, .mode-btn, .nav-switch-link, .lb-btn, .theme-toggle-btn, .lb-close, .switch, input[type="button"], input[type="submit"], input[type="checkbox"], .tab, .opt-chip, .back-btn');
  if (btn) {
    playClickSound();
  }
}, true);

/* ---------------------------------------------------------------------
   2. GENERIC BASE-N MATH HELPERS
   (bit-by-bit / digit-by-digit — works for base 2, 8 or 16 and
   produces the carry / borrow chains used for visualization)
   --------------------------------------------------------------------- */
const digitValue = ch => DIGIT_CHARS.indexOf(ch.toUpperCase());
const digitChar  = val => DIGIT_CHARS[val];

function randomDigits(base, length) {
  let out = '';
  for (let i = 0; i < length; i++) out += digitChar(Math.floor(Math.random() * base));
  return out;
}

// Adds two equal-length digit strings in the given base.
// Returns the sum (length+1) and carryIn[i] = carry entering column i.
function addBaseNumbers(aStr, bStr, base) {
  const n = aStr.length;
  const sumDigits = new Array(n + 1).fill('0');
  const carryIn = new Array(n).fill(0);
  let carry = 0;
  for (let i = n - 1; i >= 0; i--) {
    carryIn[i] = carry;
    const total = digitValue(aStr[i]) + digitValue(bStr[i]) + carry;
    sumDigits[i + 1] = digitChar(total % base);
    carry = total >= base ? 1 : 0;
  }
  sumDigits[0] = digitChar(carry);
  return { sum: sumDigits.join(''), carryIn };
}

// Subtracts subtrahend from minuend (minuend >= subtrahend), in the
// given base. Returns the difference and borrowOut[i] = 1 if column i
// borrowed from the column to its left.
function subBaseNumbers(minuend, subtrahend, base) {
  const n = minuend.length;
  const diffDigits = new Array(n).fill('0');
  const borrowOut = new Array(n).fill(0);
  let borrow = 0;
  for (let i = n - 1; i >= 0; i--) {
    let a = digitValue(minuend[i]) - borrow;
    const b = digitValue(subtrahend[i]);
    if (a < b) { a += base; borrow = 1; } else { borrow = 0; }
    diffDigits[i] = digitChar(a - b);
    borrowOut[i] = borrow;
  }
  return { diff: diffDigits.join(''), borrowOut };
}

/* ---------------------------------------------------------------------
   3. QUESTION GENERATION
   --------------------------------------------------------------------- */
function generateAdditionQuestion(size, base) {
  const aInt = randomDigits(base, size);
  const bInt = randomDigits(base, size);
  const defaultChar = base === 2 ? '0' : '?';

  if (!state.enablePoints) {
    const { sum, carryIn } = addBaseNumbers(aInt, bInt, base);
    return {
      op: 'add', base, size, a: aInt, b: bInt,
      answer: sum, carryIn,
      isNegative: false, hasSignBox: false,
      hasPoints: false,
      userAnswer: Array(size + 1).fill(defaultChar),
      scored: false, timeTaken: null,
    };
  }

  // Points enabled: random 1 to 4 digits for fractional part
  const lenA = Math.floor(Math.random() * 4) + 1;
  const lenB = Math.floor(Math.random() * 4) + 1;
  const aFracRaw = randomDigits(base, lenA);
  const bFracRaw = randomDigits(base, lenB);
  const maxFracLen = Math.max(lenA, lenB);

  const aFracPad = aFracRaw.padEnd(maxFracLen, '0');
  const bFracPad = bFracRaw.padEnd(maxFracLen, '0');

  const fullA = aInt + aFracPad;
  const fullB = bInt + bFracPad;

  const { sum, carryIn } = addBaseNumbers(fullA, fullB, base);

  const ansInt = sum.slice(0, sum.length - maxFracLen);
  const ansFrac = sum.slice(sum.length - maxFracLen);

  const aStr = aInt + '.' + aFracPad;
  const bStr = bInt + '.' + bFracPad;
  const answerStr = ansInt + '.' + ansFrac;

  const totalUserLen = ansInt.length + 1 + ansFrac.length;
  const initialUserAns = Array(totalUserLen).fill(defaultChar);
  initialUserAns[ansInt.length] = '.';

  return {
    op: 'add', base, size,
    a: aStr, b: bStr,
    aInt, aFrac: aFracPad, bInt, bFrac: bFracPad,
    answerInt: ansInt, answerFrac: ansFrac,
    answer: answerStr, carryIn,
    isNegative: false, hasSignBox: false,
    hasPoints: true, maxFracLen,
    userAnswer: initialUserAns,
    scored: false, timeTaken: null,
  };
}

function generateSubtractionQuestion(size, base, allowNegative) {
  let aInt = randomDigits(base, size);
  let bInt = randomDigits(base, size);
  const defaultChar = base === 2 ? '0' : '?';

  if (!state.enablePoints) {
    let isNegative = false;
    if (!allowNegative) {
      if (aInt < bInt) { const t = aInt; aInt = bInt; bInt = t; }
    } else if (aInt < bInt) {
      isNegative = true;
    }

    const minuend = isNegative ? bInt : aInt;
    const subtrahend = isNegative ? aInt : bInt;
    const { diff, borrowOut } = subBaseNumbers(minuend, subtrahend, base);
    const hasSignBox = allowNegative;

    const initialUserAns = Array(size + (hasSignBox ? 1 : 0)).fill(defaultChar);
    if (hasSignBox) initialUserAns[0] = '+';

    return {
      op: 'sub', base, size, a: aInt, b: bInt,
      answer: diff, borrowOut,
      isNegative, hasSignBox,
      hasPoints: false,
      userAnswer: initialUserAns,
      scored: false, timeTaken: null,
    };
  }

  // Points enabled
  const lenA = Math.floor(Math.random() * 4) + 1;
  const lenB = Math.floor(Math.random() * 4) + 1;
  let aFracRaw = randomDigits(base, lenA);
  let bFracRaw = randomDigits(base, lenB);
  let maxFracLen = Math.max(lenA, lenB);

  let aFracPad = aFracRaw.padEnd(maxFracLen, '0');
  let bFracPad = bFracRaw.padEnd(maxFracLen, '0');

  let fullA = aInt + aFracPad;
  let fullB = bInt + bFracPad;
  let isNegative = false;

  const valA = bigIntFromBaseStr(fullA, base);
  const valB = bigIntFromBaseStr(fullB, base);

  if (!allowNegative) {
    if (valA < valB) {
      let tInt = aInt; aInt = bInt; bInt = tInt;
      let tFracPad = aFracPad; aFracPad = bFracPad; bFracPad = tFracPad;
      let tFull = fullA; fullA = fullB; fullB = tFull;
    }
  } else if (valA < valB) {
    isNegative = true;
  }

  const minuend = isNegative ? fullB : fullA;
  const subtrahend = isNegative ? fullA : fullB;
  const { diff, borrowOut } = subBaseNumbers(minuend, subtrahend, base);
  const hasSignBox = allowNegative;

  const ansInt = diff.slice(0, diff.length - maxFracLen);
  const ansFrac = diff.slice(diff.length - maxFracLen);

  const aStr = aInt + '.' + aFracPad;
  const bStr = bInt + '.' + bFracPad;
  const answerStr = ansInt + '.' + ansFrac;

  const totalUserLen = (hasSignBox ? 1 : 0) + ansInt.length + 1 + ansFrac.length;
  const initialUserAns = Array(totalUserLen).fill(defaultChar);
  if (hasSignBox) initialUserAns[0] = '+';
  const dotIdx = (hasSignBox ? 1 : 0) + ansInt.length;
  initialUserAns[dotIdx] = '.';

  return {
    op: 'sub', base, size,
    a: aStr, b: bStr,
    aInt, aFrac: aFracPad, bInt, bFrac: bFracPad,
    answerInt: ansInt, answerFrac: ansFrac,
    answer: answerStr, borrowOut,
    isNegative, hasSignBox,
    hasPoints: true, maxFracLen,
    userAnswer: initialUserAns,
    scored: false, timeTaken: null,
  };
}

// Parses a base-N digit string into a BigInt, using the radix literal
// prefixes BigInt understands natively (0b / 0o / 0x).
function bigIntFromBaseStr(str, base) {
  const prefix = base === 2 ? '0b' : base === 8 ? '0o' : base === 16 ? '0x' : '';
  return BigInt(prefix + str);
}

// Works for Binary, Octal or Hexadecimal: full, untruncated product.
function generateMultiplicationQuestion(size, base) {
  const aInt = randomDigits(base, size);
  const bInt = randomDigits(base, size);
  const defaultChar = base === 2 ? '0' : '?';

  if (!state.enablePoints) {
    const product = bigIntFromBaseStr(aInt, base) * bigIntFromBaseStr(bInt, base);
    const answerLen = size * 2;
    const answer = product.toString(base).toUpperCase().padStart(answerLen, '0');
    return {
      op: 'mul', base, size, a: aInt, b: bInt,
      answer, isNegative: false, hasSignBox: false,
      hasPoints: false,
      userAnswer: Array(answerLen).fill(defaultChar),
      scored: false, timeTaken: null,
    };
  }

  // Points enabled
  const lenA = Math.floor(Math.random() * 4) + 1;
  const lenB = Math.floor(Math.random() * 4) + 1;
  const aFracRaw = randomDigits(base, lenA);
  const bFracRaw = randomDigits(base, lenB);
  const maxFracLen = Math.max(lenA, lenB);

  const aFracPad = aFracRaw.padEnd(maxFracLen, '0');
  const bFracPad = bFracRaw.padEnd(maxFracLen, '0');

  const fullA = aInt + aFracPad;
  const fullB = bInt + bFracPad;
  const totalFracLen = maxFracLen + maxFracLen;

  const product = bigIntFromBaseStr(fullA, base) * bigIntFromBaseStr(fullB, base);
  const totalLen = size * 2 + totalFracLen;
  const prodStr = product.toString(base).toUpperCase().padStart(totalLen, '0');

  const ansInt = prodStr.slice(0, prodStr.length - totalFracLen);
  const ansFrac = prodStr.slice(prodStr.length - totalFracLen);

  const aStr = aInt + '.' + aFracPad;
  const bStr = bInt + '.' + bFracPad;
  const answerStr = ansInt + '.' + ansFrac;

  const totalUserLen = ansInt.length + 1 + ansFrac.length;
  const initialUserAns = Array(totalUserLen).fill(defaultChar);
  initialUserAns[ansInt.length] = '.';

  return {
    op: 'mul', base, size,
    a: aStr, b: bStr,
    aInt, aFrac: aFracPad, bInt, bFrac: bFracPad,
    answerInt: ansInt, answerFrac: ansFrac,
    answer: answerStr,
    isNegative: false, hasSignBox: false,
    hasPoints: true, totalFracLen,
    userAnswer: initialUserAns,
    scored: false, timeTaken: null,
  };
}

function createQuestion() {
  const size = DIFFICULTY[state.base][state.level];
  switch (state.op) {
    case 'add': return generateAdditionQuestion(size, state.base);
    case 'sub': return generateSubtractionQuestion(size, state.base, state.allowNegative);
    case 'mul': return generateMultiplicationQuestion(size, state.base);
  }
}

/* ---------------------------------------------------------------------
   4. RENDERING
   --------------------------------------------------------------------- */
function computeBoxSize(columnCount) {
  const available = Math.min(window.innerWidth, 980) - 40;
  const gap = 4;
  const labelWidth = 34;
  let size = Math.floor((available - labelWidth - gap * columnCount) / columnCount);
  size = Math.max(20, Math.min(44, size));
  document.documentElement.style.setProperty('--box-size', size + 'px');
  document.documentElement.style.setProperty('--box-gap', Math.max(2, Math.min(6, size / 8)) + 'px');
}

function makeBox(content, extraClasses = '') {
  const div = document.createElement('div');
  div.className = 'bit-box ' + extraClasses;
  div.textContent = content;
  return div;
}

function renderOperandRow(container, digits, labelChar) {
  container.innerHTML = '';
  const label = document.createElement('div');
  label.className = 'row-label operator';
  label.textContent = labelChar || '';
  container.appendChild(label);
  for (const d of digits) {
    if (d === '.') {
      const dotBox = document.createElement('div');
      dotBox.className = 'bit-box dot-box';
      dotBox.textContent = '.';
      container.appendChild(dotBox);
    } else {
      container.appendChild(makeBox(d));
    }
  }
}

function normalizeAnswerString(str) {
  if (!str) return '';
  let s = str.trim().toUpperCase();
  let sign = '';
  if (s.startsWith('-')) {
    sign = '-';
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  s = s.replace(/\?/g, '');

  if (s.includes('.')) {
    const parts = s.split('.');
    let intPart = parts[0] ? parts[0].replace(/^0+(?=\d|[A-F])/g, '') : '';
    if (intPart === '' && (parts[0] === '0' || parts[0] === '' || str.includes('0'))) intPart = '0';

    let fracPart = parts[1] || '';
    fracPart = fracPart.replace(/0+$/g, '');
    if (fracPart.length > 0) {
      return sign + intPart + '.' + fracPart;
    }
    return sign + intPart;
  }

  s = s.replace(/^0+(?=\d|[A-F])/g, '');
  if (s === '' && str.includes('0')) s = '0';
  return sign + s;
}

function syncSingleInputToUserAnswer(q, rawVal) {
  let raw = rawVal.trim().toUpperCase();

  if (!q.hasPoints) {
    const N = q.userAnswer.length;
    const D = q.hasSignBox ? N - 1 : N;

    let sign = '?';
    let digitsStr = raw;

    if (q.hasSignBox) {
      if (raw.startsWith('+')) {
        sign = '+';
        digitsStr = raw.slice(1);
      } else if (raw.startsWith('-')) {
        sign = '-';
        digitsStr = raw.slice(1);
      } else if (raw.startsWith('=')) {
        sign = '+';
        digitsStr = raw.slice(1);
      } else {
        sign = '+';
      }
    }

    const validChars = DIGIT_CHARS.slice(0, q.base);
    let cleanDigits = digitsStr.split('').filter(ch => validChars.includes(ch)).join('');

    while (cleanDigits.length > 1 && cleanDigits.startsWith('0') && cleanDigits.length > D) {
      cleanDigits = cleanDigits.slice(1);
    }
    if (cleanDigits.length > D) {
      cleanDigits = cleanDigits.slice(-D);
    }

    let padChar = cleanDigits.length > 0 ? '0' : '?';
    const padCount = D - cleanDigits.length;
    const digitArr = Array(padCount).fill(padChar).concat(cleanDigits.split(''));

    if (q.hasSignBox) {
      q.userAnswer = [sign, ...digitArr];
    } else {
      q.userAnswer = digitArr;
    }
    return;
  }

  // Points enabled
  const validChars = DIGIT_CHARS.slice(0, q.base);
  let sign = '?';
  let body = raw;

  if (q.hasSignBox) {
    if (raw.startsWith('-')) {
      sign = '-';
      body = raw.slice(1);
    } else if (raw.startsWith('+') || raw.startsWith('=')) {
      sign = '+';
      body = raw.slice(1);
    } else {
      sign = '+';
    }
  }

  const parts = body.split('.');
  let rawInt = parts[0] || '';
  let rawFrac = parts.length > 1 ? parts[1] : '';

  let cleanInt = rawInt.split('').filter(ch => validChars.includes(ch)).join('');
  let cleanFrac = rawFrac.split('').filter(ch => validChars.includes(ch)).join('');

  const expectedIntLen = q.answerInt ? q.answerInt.length : q.size;
  const expectedFracLen = q.answerFrac ? q.answerFrac.length : 1;

  let padIntCount = expectedIntLen - cleanInt.length;
  let intArr = [];
  if (padIntCount > 0) {
    intArr = Array(padIntCount).fill(cleanInt.length > 0 ? '0' : '?').concat(cleanInt.split(''));
  } else {
    intArr = cleanInt.slice(-expectedIntLen).split('');
  }

  let padFracCount = expectedFracLen - cleanFrac.length;
  let fracArr = [];
  if (padFracCount > 0) {
    fracArr = cleanFrac.split('').concat(Array(padFracCount).fill(cleanFrac.length > 0 ? '0' : '?'));
  } else {
    fracArr = cleanFrac.slice(0, expectedFracLen).split('');
  }

  let finalUserAns = [];
  if (q.hasSignBox) finalUserAns.push(sign);
  finalUserAns.push(...intArr);
  finalUserAns.push('.');
  finalUserAns.push(...fracArr);

  q.userAnswer = finalUserAns;
}

function renderAnswerRow(question) {
  const row = $('#answerRow');
  row.innerHTML = '';
  const label = document.createElement('div');
  label.className = 'row-label';
  label.textContent = '=';
  row.appendChild(label);

  if (state.hideBoxes) {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'singleAnswerInput';
    input.className = 'single-answer-input';
    input.autocomplete = 'off';
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('autocorrect', 'off');

    const BASE_NAMES = { 2: 'binary', 8: 'octal', 10: 'decimal', 16: 'hex' };
    input.placeholder = question.hasPoints
      ? `Type ${BASE_NAMES[question.base] || ''} result (e.g. 101.01)...`
      : `Type ${BASE_NAMES[question.base] || ''} result...`;

    if (question.base === 16 || question.hasSignBox || question.hasPoints) {
      input.setAttribute('inputmode', 'text');
      input.setAttribute('autocapitalize', 'characters');
    } else {
      input.setAttribute('inputmode', 'numeric');
    }

    let userStr = '';
    if (question.hasSignBox) {
      const s = question.userAnswer[0] !== '?' ? question.userAnswer[0] : '';
      const d = question.userAnswer.slice(1).filter(v => v !== '?').join('');
      userStr = s + d;
    } else {
      userStr = question.userAnswer.filter(v => v !== '?').join('');
    }

    input.value = userStr;

    if (question.scored) {
      input.disabled = true;
      const correctArr = correctAnswerArray(question);
      const userNorm = normalizeAnswerString(question.userAnswer.join(''));
      const correctNorm = normalizeAnswerString(correctArr.join(''));
      const allCorr = (userNorm !== '' && userNorm === correctNorm);
      input.classList.add(allCorr ? 'correct' : 'wrong');
    } else {
      input.addEventListener('input', () => {
        const q = currentQuestion();
        if (!q || q.scored) return;
        syncSingleInputToUserAnswer(q, input.value);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitAnswer();
        }
      });
    }

    row.appendChild(input);
    return;
  }

  const correctArr = correctAnswerArray(question);

  question.userAnswer.forEach((val, idx) => {
    if (correctArr[idx] === '.') {
      const dotBox = document.createElement('div');
      dotBox.className = 'bit-box dot-box';
      dotBox.textContent = '.';
      row.appendChild(dotBox);
      return;
    }

    const box = document.createElement('input');
    box.type = 'text';
    box.className = 'bit-box answer-box ' + (val === '?' ? 'placeholder' : 'filled');
    box.value = val === '?' ? '' : val;
    box.placeholder = '?';
    box.dataset.index = idx;
    box.maxLength = 1;
    box.autocomplete = 'off';
    box.setAttribute('spellcheck', 'false');
    box.setAttribute('autocorrect', 'off');

    const isSignBox = question.hasSignBox && idx === 0;
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isSignBox) {
      box.setAttribute('inputmode', 'text');
    } else if (question.base === 16) {
      box.setAttribute('inputmode', 'text');
      box.setAttribute('autocapitalize', 'characters');
    } else if (question.base === 2 && isTouchDevice) {
      box.setAttribute('inputmode', 'none');
    } else {
      box.setAttribute('inputmode', 'numeric');
    }

    if (question.scored) {
      box.disabled = true;
    }

    box.addEventListener('focus', () => {
      state.focusedBoxIndex = idx;
      box.select();
    });

    box.addEventListener('click', () => {
      const q = currentQuestion();
      if (!q || q.scored) return;

      const isBinaryDigit = (q.base === 2 && !isSignBox);
      if (isBinaryDigit) {
        const current = q.userAnswer[idx];
        let nextVal = '1';
        if (current === '0') nextVal = '1';
        else if (current === '1') nextVal = '0';
        else nextVal = '1';
        setBoxValue(idx, nextVal);
      }
      box.select();
    });

    box.addEventListener('input', () => {
      const q = currentQuestion();
      if (!q || q.scored) {
        box.value = q ? (q.userAnswer[idx] === '?' ? '' : q.userAnswer[idx]) : '';
        return;
      }
      let raw = box.value.trim().toUpperCase();
      const defaultChar = q.base === 2 ? '0' : '?';
      if (!raw) {
        setBoxValue(idx, defaultChar);
        return;
      }
      const char = raw.slice(-1);
      const isSign = q.hasSignBox && idx === 0;

      if (isSign) {
        if (char === '-' || char === '+' || char === '=') {
          const signVal = char === '=' ? '+' : char;
          setBoxValue(idx, signVal);
          moveFocus(1);
        } else {
          box.value = q.userAnswer[idx] === '?' ? '' : q.userAnswer[idx];
        }
      } else {
        const validChars = DIGIT_CHARS.slice(0, q.base);
        if (validChars.includes(char)) {
          setBoxValue(idx, char);
          moveFocus(1);
        } else {
          box.value = q.userAnswer[idx] === '?' ? '' : q.userAnswer[idx];
        }
      }
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitAnswer();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveFocus(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveFocus(1);
        return;
      }
      if (e.key === 'Backspace') {
        const q = currentQuestion();
        if (q && !q.scored) {
          e.preventDefault();
          const defaultChar = q.base === 2 ? '0' : '?';
          if (q.userAnswer[idx] !== defaultChar || box.value !== '') {
            setBoxValue(idx, defaultChar);
          } else {
            moveFocus(-1);
          }
        }
      }
    });

    row.appendChild(box);
  });
}

function renderIndicatorRows(question) {
  const carryWrap = $('#carryRowWrap');
  const borrowWrap = $('#borrowRowWrap');
  carryWrap.style.display = 'none';
  borrowWrap.style.display = 'none';
  carryWrap.innerHTML = '';
  borrowWrap.innerHTML = '';

  if (question.op === 'add' && question.carryIn) {
    carryWrap.style.display = 'flex';
    const spacer = document.createElement('div');
    spacer.className = 'row-label';
    carryWrap.appendChild(spacer);

    const fracLen = question.hasPoints ? (question.maxFracLen || 0) : 0;
    question.carryIn.forEach((c, idx) => {
      if (question.hasPoints && idx === question.carryIn.length - fracLen) {
        const dotSpacer = document.createElement('div');
        dotSpacer.className = 'bit-box dot-box';
        dotSpacer.style.visibility = 'hidden';
        carryWrap.appendChild(dotSpacer);
      }
      const box = document.createElement('div');
      box.className = 'indicator-box';
      box.textContent = c ? '1' : '';
      carryWrap.appendChild(box);
    });
  } else if (question.op === 'sub' && question.borrowOut) {
    borrowWrap.style.display = 'flex';
    const spacer = document.createElement('div');
    spacer.className = 'row-label';
    borrowWrap.appendChild(spacer);

    const fracLen = question.hasPoints ? (question.maxFracLen || 0) : 0;
    question.borrowOut.forEach((bOut, idx) => {
      if (question.hasPoints && idx === question.borrowOut.length - fracLen) {
        const dotSpacer = document.createElement('div');
        dotSpacer.className = 'bit-box dot-box';
        dotSpacer.style.visibility = 'hidden';
        borrowWrap.appendChild(dotSpacer);
      }
      const box = document.createElement('div');
      box.className = 'indicator-box borrow';
      box.textContent = bOut ? '\u2190' : '';
      borrowWrap.appendChild(box);
    });
  }
}

function updateControlButtonsState() {
  const q = currentQuestion();
  const resetBtn = $('#resetBtn');
  const submitBtn = $('#submitBtn');
  if (!q) return;
  if (resetBtn) resetBtn.disabled = q.scored;
  if (submitBtn) submitBtn.disabled = q.scored;
}

function renderQuestion(question) {
  computeBoxSize(Math.max(question.a.length, question.userAnswer.length) + 1);

  renderOperandRow($('#operandARow'), question.a.split(''), '');
  renderOperandRow($('#operandBRow'), question.b.split(''), OP_SYMBOLS[question.op]);
  renderAnswerRow(question);
  renderIndicatorRows(question);
  renderSolutionRow(question, false);

  $('#scoreDisplay').innerHTML = '';
  $('#sizeDisplay').textContent = question.size + (question.base === 2 ? ' bit' : ' digit') + (question.size > 1 ? 's' : '');
  updateControlButtonsState();

  const problemScroll = $('.problem-scroll');
  if (problemScroll) {
    setTimeout(() => {
      problemScroll.scrollLeft = problemScroll.scrollWidth;
    }, 50);
  }

  // Prefetch Gemini AI solution in background immediately upon question generation
  

  // Before submitting, NO AI solution button scope should be present
  const aiSolBtn = $('#aiSolBtn');
  if (aiSolBtn) {
    aiSolBtn.style.display = question.scored ? 'inline-flex' : 'none';
  }

  resetTimer();
  startTimer();

  if (state.hideBoxes) {
    const singleInput = $('#singleAnswerInput');
    if (singleInput && !question.scored) {
      setTimeout(() => {
        singleInput.focus();
      }, 60);
    }
  } else {
    const firstBox = $('.answer-box[data-index="0"]');
    if (firstBox && !question.scored) {
      state.focusedBoxIndex = 0;
      setTimeout(() => {
        firstBox.focus();
        if (typeof firstBox.select === 'function') firstBox.select();
      }, 60);
    }
  }
}

/* ---------------------------------------------------------------------
   5. ANSWER BOX INTERACTION
   --------------------------------------------------------------------- */
function currentQuestion() { return state.history[state.historyIndex]; }

function updateSingleBox(idx, val) {
  const box = $(`.answer-box[data-index="${idx}"]`);
  if (!box) return;
  box.value = val === '?' ? '' : val;
  box.classList.toggle('placeholder', val === '?');
  box.classList.toggle('filled', val !== '?');
  box.classList.remove('correct', 'wrong', 'unanswered-mark');
}

function setBoxValue(idx, val) {
  const q = currentQuestion();
  if (!q) return;
  q.userAnswer[idx] = val;
  playClickSound();
  updateSingleBox(idx, val);
}

function moveFocus(delta) {
  const boxes = $$('.answer-box');
  if (!boxes.length) return;
  let idx = state.focusedBoxIndex + delta;
  idx = Math.max(0, Math.min(boxes.length - 1, idx));
  state.focusedBoxIndex = idx;
  const targetBox = boxes[idx];
  if (targetBox) {
    targetBox.focus();
    if (typeof targetBox.select === 'function') targetBox.select();
  }
}

// Keyboard support: valid digit keys per base, arrows move focus,
// backspace clears, enter submits.
function handleKeydown(e) {
  const q = currentQuestion();
  if (!q) return;

  if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); return; }

  // If focus is inside an answer input box, let the input box event listener handle it
  if (e.target && e.target.tagName === 'INPUT') return;

  const boxes = $$('.answer-box');
  if (!boxes.length) return;

  if (e.key === 'ArrowRight') { e.preventDefault(); moveFocus(1); return; }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); moveFocus(-1); return; }

  if (q.scored) return;

  const idx = state.focusedBoxIndex;
  const isSign = q.hasSignBox && idx === 0;

  if (e.key === 'Backspace') { setBoxValue(idx, '?'); return; }

  if (isSign) {
    if (e.key === '-') setBoxValue(idx, '-');
    else if (e.key === '+' || e.key === '=') setBoxValue(idx, '+');
    return;
  }

  if (e.key.length === 1) {
    const validChars = DIGIT_CHARS.slice(0, q.base);
    const up = e.key.toUpperCase();
    if (validChars.includes(up)) setBoxValue(idx, up);
  }
}

/* ---------------------------------------------------------------------
   6. SUBMIT / SCORING
   --------------------------------------------------------------------- */
function correctAnswerArray(q) {
  if (q.hasPoints) {
    const intDigits = q.answerInt.split('');
    const fracDigits = q.answerFrac.split('');
    if (q.hasSignBox) {
      return [q.isNegative ? '-' : '+', ...intDigits, '.', ...fracDigits];
    }
    return [...intDigits, '.', ...fracDigits];
  }
  const digits = q.answer.split('');
  if (q.hasSignBox) return [q.isNegative ? '-' : '+', ...digits];
  return digits;
}

function submitAnswer() {
  const q = currentQuestion();
  if (!q || q.scored) return;

  stopTimer();
  const correctArr = correctAnswerArray(q);
  let correctCount = 0;

  if (state.hideBoxes) {
    const singleInput = $('#singleAnswerInput');
    if (singleInput) {
      singleInput.disabled = true;
      syncSingleInputToUserAnswer(q, singleInput.value);
    }
  } else {
    q.userAnswer.forEach((val, idx) => {
      if (correctArr[idx] === '.') return;
      const box = $(`.answer-box[data-index="${idx}"]`);
      if (!box) return;
      box.disabled = true;
      box.classList.remove('placeholder', 'filled');
      if (val === '?') {
        box.classList.add('unanswered-mark');
        box.value = '?';
      } else if (val === correctArr[idx]) {
        box.classList.add('correct');
        correctCount++;
      } else {
        box.classList.add('wrong');
      }
    });
  }

  const total = correctArr.filter(c => c !== '.').length;
  const userNorm = normalizeAnswerString(q.userAnswer.join(''));
  const correctNorm = normalizeAnswerString(correctArr.join(''));
  const allCorrect = (userNorm !== '' && userNorm === correctNorm);

  if (state.hideBoxes) {
    const singleInput = $('#singleAnswerInput');
    if (singleInput) {
      singleInput.classList.add(allCorrect ? 'correct' : 'wrong');
    }
    if (allCorrect) {
      correctCount = total;
    }
  }

  q.scored = true;
  q.timeTaken = state.elapsed;

  // Calculate & record points using NST engine
  let ptsInfo = { pointsDelta: 0 };
  if (window.NST) {
    const BASE_NAMES = { '2': 'Binary', '8': 'Octal', '10': 'Decimal', '16': 'Hexadecimal' };
    const OP_SYMBOLS = { 'add': '+', 'sub': '-', 'mul': '×', 'div': '÷' };
    const problemDesc = `${BASE_NAMES[q.base] || ''} (${q.a} ${OP_SYMBOLS[q.op] || '+'} ${q.b})`;
    const userStr = q.userAnswer.join('');
    const correctStr = correctArr.join('');

    ptsInfo = window.NST.recordQuestionResult({
      type: 'arithmetic',
      problemStr: problemDesc,
      userAnswer: userStr,
      correctAnswer: correctStr,
      isCorrect: allCorrect,
      level: state.level,
      timeSeconds: state.elapsed
    });
    loadDashboard();
  }

  const scoreEl = $('#scoreDisplay');
  const deltaTag = ptsInfo.pointsDelta > 0 ? `+${ptsInfo.pointsDelta} pts` : `${ptsInfo.pointsDelta} pts`;
  const deltaColor = ptsInfo.pointsDelta > 0 ? '#16a34a' : '#dc2626';
  scoreEl.innerHTML = `
    <div class="label">${allCorrect ? 'Correct 🎉' : 'Incorrect ❌'}</div>
    <div class="value ${allCorrect ? 'good' : 'bad'}">${correctCount} / ${total} <span style="font-size:15px; color:${deltaColor}; font-weight:800; margin-left:6px;">(${deltaTag})</span></div>
  `;

  allCorrect ? playSuccessSound() : playErrorSound();
  updateSessionStats(allCorrect, state.elapsed);
  updateControlButtonsState();
  renderSolutionRow(q, true);
  revealIndicators();

  // Reveal the Gemini AI Solution button ONLY AFTER the user submits
  const aiSolBtn = $('#aiSolBtn');
  if (aiSolBtn) {
    aiSolBtn.style.display = 'inline-flex';
  }
}

/* ---------------------------------------------------------------------
   7. SOLUTION ROW + CARRY/BORROW VISUALIZATION
   --------------------------------------------------------------------- */
function renderSolutionRow(question, animate = false) {
  const row = $('#solutionRowWrap');
  if (!row) return;
  row.innerHTML = '';

  if (!question || !question.scored) {
    row.style.display = 'none';
    return;
  }

  row.style.display = 'flex';

  const label = document.createElement('div');
  label.className = 'row-label operator';
  label.style.color = 'var(--success)';
  label.style.fontWeight = '800';
  label.style.fontSize = '12px';
  label.textContent = '✓';
  row.appendChild(label);

  const correctArr = correctAnswerArray(question);
  correctArr.forEach((val, idx) => {
    if (val === '.') {
      const dotBox = document.createElement('div');
      dotBox.className = 'bit-box dot-box';
      dotBox.textContent = '.';
      row.appendChild(dotBox);
      return;
    }
    const box = document.createElement('div');
    box.className = 'bit-box correct' + (animate ? ' reveal-anim' : '');
    box.style.cursor = 'default';
    box.textContent = val;
    if (animate) {
      box.style.animationDelay = (idx * 50) + 'ms';
    }
    row.appendChild(box);
  });
}

function revealIndicators() {
  const wrap = $('#carryRowWrap').style.display !== 'none' ? $('#carryRowWrap') : $('#borrowRowWrap');
  const boxes = $$('.indicator-box', wrap);
  boxes.slice().reverse().forEach((box, i) => {
    setTimeout(() => box.classList.add('show'), i * 80);
  });
}

/* ---------------------------------------------------------------------
   8. RESET / NAVIGATION
   --------------------------------------------------------------------- */
function resetCurrentQuestion() {
  const q = currentQuestion();
  if (!q || q.scored) return;
  const defaultChar = q.base === 2 ? '0' : '?';
  q.userAnswer = q.userAnswer.map((val) => {
    if (val === '.' || val === '+' || val === '-') return val;
    return defaultChar;
  });
  q.scored = false;
  renderQuestion(q);
}

function goToQuestion(index) {
  if (index < 0 || index >= state.history.length) return;
  state.historyIndex = index;
  const q = currentQuestion();
  renderQuestion(q);
  if (q.scored) {
    const correctArr = correctAnswerArray(q);
    q.userAnswer.forEach((val, idx) => {
      const box = $(`.answer-box[data-index="${idx}"]`);
      if (!box) return;
      box.classList.remove('placeholder', 'filled');
      if (val === '?') box.classList.add('unanswered-mark');
      else if (val === correctArr[idx]) box.classList.add('correct');
      else box.classList.add('wrong');
    });
    renderSolutionRow(q, false);
    stopTimer();
  }
}

function nextQuestion() {
  if (state.historyIndex < state.history.length - 1) {
    goToQuestion(state.historyIndex + 1);
  } else {
    state.history.push(createQuestion());
    goToQuestion(state.history.length - 1);
  }
}

function previousQuestion() { goToQuestion(state.historyIndex - 1); }

function randomQuestion() {
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(createQuestion());
  goToQuestion(state.history.length - 1);
}

/* ---------------------------------------------------------------------
   9. TIMER
   --------------------------------------------------------------------- */
function startTimer() {
  state.timerStart = performance.now() - state.elapsed * 1000;
  state.timerRunning = true;
  clearInterval(state.timerHandle);
  state.timerHandle = setInterval(() => {
    state.elapsed = (performance.now() - state.timerStart) / 1000;
    $('#timerDisplay').textContent = state.elapsed.toFixed(1) + 's';
  }, 100);
}
function stopTimer() { state.timerRunning = false; clearInterval(state.timerHandle); }
function resetTimer() { stopTimer(); state.elapsed = 0; $('#timerDisplay').textContent = '0.0s'; }

/* ---------------------------------------------------------------------
   10. SESSION STATS
   --------------------------------------------------------------------- */
function updateSessionStats(wasFullyCorrect, timeTaken) {
  const s = state.session;
  s.solved++;
  s.totalTime += timeTaken;
  if (wasFullyCorrect) {
    s.correct++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
  } else {
    s.streak = 0;
  }
  renderStats();
}

function renderStats() {
  const s = state.session;
  $('#statSolved').textContent = s.solved;
  $('#statCorrect').textContent = s.correct;
  $('#statAccuracy').textContent = s.solved ? Math.round((s.correct / s.solved) * 100) + '%' : '0%';
  $('#statStreak').textContent = s.streak;
  $('#statBestStreak').textContent = s.bestStreak;
  $('#statAvgTime').textContent = (s.solved ? (s.totalTime / s.solved) : 0).toFixed(1) + 's';
  $('#streakDisplay').textContent = s.streak;
}

/* ---------------------------------------------------------------------
   11. SCREEN / SETTINGS CONTROL
   --------------------------------------------------------------------- */
const NUDGE_MAPPING = {
  add: { module: 'm8', name: 'Addition' },
  sub: { module: 'm9', name: 'Subtraction' },
  mul: { module: 'multiply', name: 'Multiplication' }
};

function startPractice(base, op) {
  state.base = base;
  state.op = op;
  $('#modeLabel').textContent = `${BASE_NAMES[base]} ${OP_NAMES[op]}`;
  $('#home-screen').classList.remove('active');
  $('#practice-screen').classList.add('active');

  const nudge = $('#practiceLearnNudge');
  if (nudge && !localStorage.getItem('numSysHideNudge')) {
    const target = NUDGE_MAPPING[op];
    if (target) {
      $('#nudgeTopicText').textContent = `${BASE_NAMES[base]} ${target.name}`;
      $('#nudgeLinkBtn').href = `learning.html?module=${target.module}&return=trainer`;
      nudge.style.display = 'flex';
    } else {
      nudge.style.display = 'none';
    }
  }

  state.history = [createQuestion()];
  state.historyIndex = 0;
  goToQuestion(0);
}

function backToHome() {
  stopTimer();
  $('#practice-screen').classList.remove('active');
  $('#home-screen').classList.add('active');
}

function setDifficulty(level) {
  state.level = level;
  $$('#difficultyGroup .pill').forEach(p => p.classList.toggle('active', p.dataset.level === level));
}

// Shows the actual bit count (relative to Binary) under each difficulty
// pill label, e.g. "Easy · 8 bits", so the size is clear before starting.
function labelDifficultyPills() {
  $$('#difficultyGroup .pill').forEach(p => {
    const level = p.dataset.level;
    const bits = DIFFICULTY[2][level];
    const countEl = p.querySelector('.pill-count');
    if (countEl) countEl.textContent = `${bits} bits`;
  });
}

/* ---------------------------------------------------------------------
   12. EVENT WIRING
   --------------------------------------------------------------------- */
function init() {
  $$('.mode-card').forEach(card => {
    const go = () => startPractice(Number(card.dataset.base), card.dataset.op);
    card.addEventListener('click', go);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  const nudgeDismissBtn = $('#nudgeDismissBtn');
  if (nudgeDismissBtn) {
    nudgeDismissBtn.addEventListener('click', () => {
      localStorage.setItem('numSysHideNudge', 'true');
      $('#practiceLearnNudge').style.display = 'none';
    });
  }

  $$('#difficultyGroup .pill').forEach(p => {
    p.addEventListener('click', () => setDifficulty(p.dataset.level));
  });
  labelDifficultyPills();

  const yearEl = $('#creditYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  $('#negativeToggle').addEventListener('change', e => { state.allowNegative = e.target.checked; });
  $('#soundToggle').addEventListener('change', e => { state.soundOn = e.target.checked; });

  const pointsToggleEl = $('#pointsToggle');
  if (pointsToggleEl) {
    pointsToggleEl.checked = state.enablePoints;
    pointsToggleEl.addEventListener('change', e => {
      state.enablePoints = e.target.checked;
      localStorage.setItem('enablePoints', state.enablePoints);
    });
  }

  const hideBoxesEl = $('#hideBoxesToggle');
  if (hideBoxesEl) {
    hideBoxesEl.checked = state.hideBoxes;
    hideBoxesEl.addEventListener('change', e => {
      state.hideBoxes = e.target.checked;
      localStorage.setItem('hideBoxes', state.hideBoxes);
      const q = currentQuestion();
      if (q) renderAnswerRow(q);
    });
  }

  $('#backBtn').addEventListener('click', backToHome);
  $('#submitBtn').addEventListener('click', submitAnswer);
  $('#resetBtn').addEventListener('click', resetCurrentQuestion);
  $('#prevBtn').addEventListener('click', previousQuestion);
  $('#nextBtn').addEventListener('click', nextQuestion);
  $('#randomBtn').addEventListener('click', randomQuestion);

  const aiSolBtn = $('#aiSolBtn');
  if (aiSolBtn) {
    aiSolBtn.addEventListener('click', openAiModal);
  }

  const aiOverlay = $('#aiModalOverlay');
  if (aiOverlay) {
    aiOverlay.addEventListener('click', e => {
      if (e.target === aiOverlay) closeAiModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAiModal();
    else handleKeydown(e);
  });

  window.addEventListener('resize', () => {
    const q = currentQuestion();
    if (q) computeBoxSize(Math.max(q.a.length, q.userAnswer.length) + 1);
  });

  renderStats();
}

/* =====================================================================
   GEMINI AI PREFETCH & STEP-BY-STEP SOLUTION ENGINE
   ===================================================================== */
function prefetchArithmeticAiSolution(q) {
  if (!q || q.aiSolutionPromise) return;

  const baseName = BASE_NAMES[q.base] || `Base ${q.base}`;
  const opName = OP_NAMES[q.op] || 'Operation';
  const opSymbol = OP_SYMBOLS[q.op] || '+';

  const prompt = `You are an expert Computer Science and Digital Logic tutor.
Provide a clean, beautifully formatted, step-by-step mathematical explanation for this positional number system arithmetic problem:
- Number System: ${baseName} (Base ${q.base})
- Operation: ${opName} (${opSymbol})
- Operand A: ${q.a}
- Operand B: ${q.b}
- Correct Answer: ${q.answer}${q.isNegative ? ' (Negative result)' : ''}

CRITICAL FORMATTING INSTRUCTIONS:
1. DO NOT write or output any programming code, Python scripts, function definitions, code blocks, or library imports (e.g. "import math", "import numpy", "def solve()").
2. DO NOT use raw LaTeX equations like \\frac, \\begin{align}, \\text{}, or dollar-sign math ($$). Use clean Unicode symbols (×, ÷, +, −, ➔, 2³, 16¹, Base 16).
3. Use clean Markdown headings (### for title, #### for steps), numbered lists (1., 2., 3.), bold text, and inline code backticks (\`...\`) for numbers and intermediate digits.
4. End clearly with "**Final Result:** \`${q.answer}\`".`;

  if (window.callGeminiAPI) {
    q.aiSolutionPromise = window.callGeminiAPI(prompt).then(sol => {
      return sol || generateFallbackArithmeticExplanation(q);
    }).catch((err) => {
      console.warn("Gemini API call failed, generating fallback arithmetic explanation:", err);
      return generateFallbackArithmeticExplanation(q);
    });
  } else {
    q.aiSolutionPromise = Promise.resolve(generateFallbackArithmeticExplanation(q));
  }
}

function generateFallbackArithmeticExplanation(q) {
  const baseName = BASE_NAMES[q.base] || `Base ${q.base}`;
  const opName = OP_NAMES[q.op] || 'Operation';
  let markdown = `### Step-by-Step ${baseName} ${opName}\n\n`;
  markdown += `**Problem:** \`${q.a}\` ${OP_SYMBOLS[q.op]} \`${q.b}\` in **${baseName} (Base ${q.base})**\n\n`;

  if (q.hasPoints) {
    markdown += `*Note: Align radix points by padding trailing zeros to fractional parts before performing column arithmetic.*\n\n`;
  }

  if (q.op === 'add') {
    markdown += `#### Column-by-Column Addition:\n`;
    let step = 1;
    const n = q.a.length;
    for (let i = n - 1; i >= 0; i--) {
      if (q.a[i] === '.' || q.b[i] === '.') {
        markdown += `${step++}. **Radix Point:** Align fractional digits across the decimal point.\n`;
        continue;
      }
      const dA = digitValue(q.a[i]);
      const dB = digitValue(q.b[i]);
      const carry = (q.carryIn && q.carryIn[i]) || 0;
      const sum = dA + dB + carry;
      const rem = sum % q.base;
      const newCarry = sum >= q.base ? 1 : 0;
      markdown += `${step++}. **Column (from right):** \`${digitChar(dA)}\` + \`${digitChar(dB)}\`${carry ? ` + carry \`1\`` : ''} = \`${sum}\` (decimal) ➔ Digit \`${digitChar(rem)}\`, Carry = \`${newCarry}\`.\n`;
    }
    markdown += `\n**Final Result:** \`${q.answer}\`\n`;
  } else if (q.op === 'sub') {
    markdown += `#### Column-by-Column Subtraction:\n`;
    let step = 1;
    const n = q.a.length;
    for (let i = n - 1; i >= 0; i--) {
      if (q.a[i] === '.' || q.b[i] === '.') {
        markdown += `${step++}. **Radix Point:** Align fractional digits across the decimal point.\n`;
        continue;
      }
      const dA = digitValue(q.a[i]);
      const dB = digitValue(q.b[i]);
      const bOut = (q.borrowOut && q.borrowOut[i]) || 0;
      markdown += `${step++}. **Column (from right):** Subtract \`${digitChar(dB)}\` from \`${digitChar(dA)}\`${bOut ? ` (borrow required)` : ''}.\n`;
    }
    markdown += `\n**Final Difference:** \`${q.answer}\`\n`;
  } else {
    markdown += `#### Step-by-Step Product:\n`;
    markdown += `Multiply \`${q.a}\` by \`${q.b}\` in Base ${q.base}.\n\n`;
    markdown += `**Final Product:** \`${q.answer}\`\n`;
  }
  return markdown;
}

function formatMarkdownToHTML(md) {
  if (!md) return '';

  // Pre-process & clean LaTeX/math symbols, dollar signs, and code block noise
  let sanitized = md
    // Strip code fences
    .replace(/```[a-z]*/gi, '')
    // Clean LaTeX math blocks $$ ... $$ and $ ... $
    .replace(/\$\$\\text\{([^}]+)\}\$\$/g, '$1')
    .replace(/\$\$(.*?)\$\$/gs, (_, inner) => inner.trim())
    .replace(/\$\\text\{([^}]+)\}\$/g, '$1')
    .replace(/\$([^$]+)\$/g, (_, inner) => {
      let cleaned = inner
        .replace(/\\text\{([^}]+)\}/g, '$1')
        .replace(/\\times/g, '×')
        .replace(/\\div/g, '÷')
        .replace(/\\cdot/g, '·')
        .replace(/\\rightarrow|\\Rightarrow|\\to/g, '➔')
        .replace(/_\{(\d+)\}/g, '<sub>$1</sub>')
        .replace(/_(\d+)/g, '<sub>$1</sub>')
        .replace(/\^\{(\d+)\}/g, '<sup>$1</sup>')
        .replace(/\^(\d+)/g, '<sup>$1</sup>');
      return `<code class="sol-code-pill">${cleaned}</code>`;
    })
    // Standalone LaTeX symbol replacements
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\cdot/g, '·')
    .replace(/\\rightarrow|\\Rightarrow|\\to/g, '➔')
    .replace(/_\{(\d+)\}/g, '<sub>$1</sub>')
    .replace(/_(\d+)/g, '<sub>$1</sub>')
    .replace(/\^\{(\d+)\}/g, '<sup>$1</sup>')
    .replace(/\^(\d+)/g, '<sup>$1</sup>')
    // Remove leftover dollar signs
    .replace(/\$/g, '');

  const lines = sanitized.split('\n');
  let out = ['<div class="sol-container">'];

  lines.forEach(rawLine => {
    let line = rawLine.trim();
    if (!line) return;

    // Filter out code block markers and programming library imports
    if (line.startsWith('```') || /^import\s+/i.test(line) || /^from\s+/i.test(line) || /^def\s+/i.test(line) || /^return\s+/i.test(line) || /soek/i.test(line)) {
      return;
    }

    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
      const title = line.replace(/^#{1,3}\s+/, '').replace(/^#+\s*/, '');
      out.push(`
        <div class="sol-header-card">
          <span class="sol-tag">✨ Step-by-Step AI Solution</span>
          <h3 class="sol-title">${title}</h3>
        </div>
      `);
      return;
    }

    if (line.startsWith('#### ')) {
      const subTitle = line.replace(/^#{4}\s+/, '').replace(/^#+\s*/, '');
      out.push(`
        <div class="sol-step-heading">
          <span>💡</span>
          <span>${subTitle}</span>
        </div>
      `);
      return;
    }

    let formatted = line
      .replace(/^#+\s*/, '') // strip any leftover leading #
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="sol-code-pill">$1</code>');

    if (line.includes('Final Result:') || line.includes('Final Product:') || line.includes('Final Difference:')) {
      const valMatch = line.match(/`([^`]+)`/) || line.match(/<strong>(.*?)<\/strong>/);
      const valStr = valMatch ? valMatch[1] : line.replace(/.*?:/, '').replace(/[$#]/g, '').trim();
      const label = line.includes('Product') ? 'Final Product' : (line.includes('Difference') ? 'Final Difference' : 'Final Result');
      out.push(`
        <div class="sol-result-card">
          <span class="sol-res-label">🎯 ${label}</span>
          <div class="sol-res-value">${valStr}</div>
        </div>
      `);
      return;
    }

    if (line.startsWith('**Problem:**') || line.startsWith('Problem:')) {
      out.push(`
        <div class="sol-problem-box">
          ${formatted}
        </div>
      `);
      return;
    }

    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      const stepNum = numMatch[1];
      const stepText = numMatch[2]
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code class="sol-code-pill">$1</code>');

      out.push(`
        <div class="sol-step-item">
          <div class="sol-step-badge">${stepNum}</div>
          <div class="sol-step-text">${stepText}</div>
        </div>
      `);
      return;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      const bulletText = formatted.replace(/^[-*]\s+/, '');
      out.push(`
        <div class="sol-step-item">
          <div class="sol-step-badge" style="background:rgba(99,102,241,0.2); color:#a5b4fc; box-shadow:none;">•</div>
          <div class="sol-step-text">${bulletText}</div>
        </div>
      `);
      return;
    }

    out.push(`<p style="margin:2px 0; font-size:13.5px; line-height:1.6; color:var(--text);">${formatted}</p>`);
  });

  out.push('</div>');
  return out.join('\n');
}

function openAiModal() {
  const q = currentQuestion();
  if (!q) return;
  const lenA = q.a.replace('.', '').length;
  const lenB = q.b.replace('.', '').length;
  if (lenA > 8 || lenB > 8) {
    alert("Detailed visual animation is only available for questions up to 8 digits.");
    return;
  }
  window.location.href = `learning.html?detailed=true&mode=arithmetic&op=${q.op}&base=${q.base}&a=${encodeURIComponent(q.a)}&b=${encodeURIComponent(q.b)}`;
}

function closeAiModal() {
  const overlay = $('#aiModalOverlay');
  if (overlay) overlay.classList.remove('show');
}

document.addEventListener('DOMContentLoaded', init);

/* =====================================================================
   DASHBOARD — load stats and update UI
   ===================================================================== */
function loadDashboard() {
  if (!window.NST) return;
  const s = window.NST.getStats();
  const totalSolved = s.totalSolved;
  const correct     = totalSolved - s.errors;
  const accuracy    = totalSolved > 0 ? Math.round((correct / totalSolved) * 100) : 0;

  const el = id => document.getElementById(id);
  if (el('dashPoints'))   el('dashPoints').textContent   = s.points;
  if (el('dashAccuracy')) el('dashAccuracy').textContent = accuracy + '%';
  if (el('dashSolved'))   el('dashSolved').textContent   = totalSolved;
  if (el('dashStreak'))   el('dashStreak').textContent   = s.maxStreak;
  if (el('dashErrors'))   el('dashErrors').textContent   = s.errors;

  // Leaderboard is unlocked for everyone
  if (el('lbProgressFill'))  el('lbProgressFill').style.width = '100%';
  if (el('lbProgressCount')) el('lbProgressCount').textContent = 'Unlocked';

  const lbBtn = el('lbBtn');
  if (lbBtn) {
    lbBtn.classList.remove('locked');
    lbBtn.classList.add('unlocked');
    lbBtn.textContent = '🏆 Leaderboard';
    lbBtn.title = 'View the Leaderboard';
    if (el('lbProgressTxt')) el('lbProgressTxt').textContent = '🏆 Leaderboard is available for all learners!';
  }
}

window.refreshDashboardUI = loadDashboard;

/* =====================================================================
   LEADERBOARD MODAL
   ===================================================================== */
function openLeaderboard() {
  const overlay = document.getElementById('lbOverlay');
  if (!overlay) return;
  overlay.classList.add('show');
  renderLeaderboard();
}

function closeLeaderboard() {
  const overlay = document.getElementById('lbOverlay');
  if (overlay) overlay.classList.remove('show');
}

async function renderLeaderboard() {
  const body = document.getElementById('lbBody');
  if (!body) return;
  body.innerHTML = '<p class="lb-loading">Loading rankings…</p>';

  let rows = [];
  if (window.NST && window.NST.fetchLeaderboard) {
    rows = await window.NST.fetchLeaderboard();
  }

  if (!rows || !rows.length) {
    // Fallback: show current user only if database returns no records
    const s = window.NST ? window.NST.getStats() : null;
    const name = window.NST ? window.NST.getDisplayName() : 'You';
    if (s && s.totalSolved > 0) {
      rows = [{ name, points: s.points, totalSolved: s.totalSolved, errors: s.errors, _isMe: true }];
    } else {
      body.innerHTML = '<p class="lb-empty">No rankings yet. Be the first to score!</p>';
      return;
    }
  }

  // Get current user details for highlighting
  let myUid = null;
  let myEmail = null;
  try {
    if (window.firebase && window.firebase.auth) {
      const u = window.firebase.auth().currentUser;
      if (u) {
        myUid = u.uid;
        myEmail = u.email;
      }
    }
  } catch (_) {}

  const rankEmojis = ['🥇','🥈','🥉'];
  const rankClasses = ['gold','silver','bronze'];

  let html = `<table class="lb-table">
    <thead><tr>
      <th>#</th><th>Player</th><th>Points</th><th>Solved</th><th>Accuracy</th>
    </tr></thead><tbody>`;

  rows.forEach((r, i) => {
    const rankNum  = i + 1;
    const rankDisp = rankNum <= 3
      ? `<span class="lb-rank ${rankClasses[i]}">${rankEmojis[i]} ${rankNum}</span>`
      : `<span class="lb-rank">${rankNum}</span>`;
    const solved   = Number(r.totalSolved || 0);
    const errors   = Number(r.errors || 0);
    const correct  = Math.max(0, solved - errors);
    const acc      = solved > 0 ? Math.round((correct / solved) * 100) + '%' : '—';
    const isMe     = r._isMe || (myUid && r.uid === myUid) || (myEmail && r.email === myEmail);
    const rowClass = isMe ? ' class="lb-me"' : '';
    const nameDisp = (r.name || (r.email ? r.email.split('@')[0] : 'Learner')) + (isMe ? ' <em>(You)</em>' : '');
    html += `<tr${rowClass}>
      <td>${rankDisp}</td>
      <td>${nameDisp}</td>
      <td><span class="lb-pts-val">${Number(r.points || 0)}</span></td>
      <td>${solved}</td>
      <td>${acc}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  body.innerHTML = html;
}

/* =====================================================================
   HISTORY MODAL HANDLERS
   ===================================================================== */
function openHistoryModal() {
  const overlay = document.getElementById('historyOverlay');
  if (!overlay) return;
  overlay.classList.add('show');
  renderHistoryList();
}

function closeHistoryModal() {
  const overlay = document.getElementById('historyOverlay');
  if (overlay) overlay.classList.remove('show');
}

function renderHistoryList() {
  const body = document.getElementById('historyBody');
  if (!body) return;
  const history = window.NST ? window.NST.getHistory() : [];
  if (!history || !history.length) {
    body.innerHTML = '<p class="lb-empty">No solved questions yet. Practice some questions to fill your history!</p>';
    return;
  }
  let html = `<div style="display:flex; flex-direction:column; gap:10px;">`;
  history.forEach((item) => {
    const isCorrect = item.isCorrect;
    const badgeBg = isCorrect ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)';
    const badgeColor = isCorrect ? '#16a34a' : '#dc2626';
    const ptsText = item.pointsDelta > 0 ? `+${item.pointsDelta} pts` : `${item.pointsDelta} pts`;
    const ptsBg = item.pointsDelta > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(220,38,38,0.12)';
    const ptsColor = item.pointsDelta > 0 ? '#d97706' : '#dc2626';

    html += `
      <div style="background:var(--bg-soft); border:1px solid var(--border); border-radius:12px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:11px; font-weight:700; background:rgba(99,102,241,0.12); color:var(--primary); padding:2px 8px; border-radius:6px;">${item.type}</span>
            <span style="font-size:13px; font-weight:700; color:var(--text);">${item.problem}</span>
          </div>
          <div style="font-size:12px; color:var(--muted); font-family:var(--font-mono); margin-top:3px;">
            Entered: <b style="color:var(--text);">${item.userAnswer}</b> | Answer: <b style="color:var(--text);">${item.correctAnswer}</b>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:12px; font-weight:700; background:${ptsBg}; color:${ptsColor}; padding:3px 10px; border-radius:999px;">${ptsText}</span>
          <span style="font-size:12px; font-weight:700; background:${badgeBg}; color:${badgeColor}; padding:3px 10px; border-radius:999px;">${isCorrect ? '✅ Correct' : '❌ Incorrect'}</span>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  body.innerHTML = html;
}

/* =====================================================================
   INIT EXTENSION — greeting + dashboard on page load
   ===================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // Inject time greeting
  if (window.NST) window.NST.injectTimeGreeting();

  // Load the dashboard
  loadDashboard();

  // Leaderboard close button
  const lbClose = document.getElementById('lbClose');
  if (lbClose) lbClose.addEventListener('click', closeLeaderboard);

  // Close on overlay background click
  const lbOverlay = document.getElementById('lbOverlay');
  if (lbOverlay) {
    lbOverlay.addEventListener('click', (e) => {
      if (e.target === lbOverlay) closeLeaderboard();
    });
  }

  const historyOverlay = document.getElementById('historyOverlay');
  if (historyOverlay) {
    historyOverlay.addEventListener('click', (e) => {
      if (e.target === historyOverlay) closeHistoryModal();
    });
  }

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLeaderboard();
      closeHistoryModal();
    }
  });
});

