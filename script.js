/* =========================================================================
   NUMBER SYSTEM TRAINER — AUTHENTICATION, ROUTE PROTECTION & POINTS ENGINE
   Authors: Sriyans & Devashish
   Copyright © 2026 Sriyans & Devashish
   ========================================================================= */

// =========================================================================
// 1. FIREBASE CONFIGURATION & SAFE INIT
// =========================================================================
let firebaseApp = null;
let isFirebaseReady = false;
let isFirestoreReady = false;

function initFirebaseWithConfig(config) {
  if (!config || !config.apiKey || config.apiKey === "YOUR_API_KEY_HERE") return;
  try {
    if (typeof firebase !== 'undefined' && firebase.initializeApp) {
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(config);
      } else {
        firebaseApp = firebase.app();
      }
      isFirebaseReady = true;
      if (firebase.firestore) {
        firebase.firestore(); // ensure it's accessible
        isFirestoreReady = true;
      }
      
      // Setup auth listener once initialized
      setupFirebaseAuthListener();
    }
  } catch (err) {
    console.warn("Firebase Auth init notice:", err.message);
  }
}

// Fetch dynamic config from backend or Cloudflare proxy
if (typeof fetch !== 'undefined') {
  const isGitHubPages = window.location.hostname.includes('github.io');
  const configUrl = isGitHubPages ? 'https://gemini-proxy.sriyansraj02.workers.dev/firebase-config' : '/api/firebase-config';
  
  fetch(configUrl)
    .then(res => res.ok ? res.json() : null)
    .then(config => {
      if (config && config.apiKey) {
        window.FIREBASE_CONFIG = config;
        initFirebaseWithConfig(config);
      } else if (!isGitHubPages) {
        // Fallback check on dev
        console.warn("Local API missing Firebase config.");
      }
    })
    .catch(err => console.warn("Dynamic Firebase config fetch notice:", err));
}

// =========================================================================
// THEME MANAGEMENT ENGINE (Dark Theme Default with Light Theme Toggle)
// =========================================================================
const THEME_KEY = 'numSysTheme';

function applyTheme(theme) {
  const currentTheme = theme || localStorage.getItem(THEME_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);

  const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
  toggleBtns.forEach(btn => {
    const icon = btn.querySelector('.theme-toggle-icon');
    const label = btn.querySelector('.theme-toggle-label');
    if (currentTheme === 'light') {
      if (icon) icon.textContent = '☀️';
      if (label) label.textContent = 'Light';
      btn.setAttribute('aria-label', 'Switch to Dark Theme');
      btn.title = 'Switch to Dark Theme';
    } else {
      if (icon) icon.textContent = '🌙';
      if (label) label.textContent = 'Dark';
      btn.setAttribute('aria-label', 'Switch to Light Theme');
      btn.title = 'Switch to Light Theme';
    }
  });
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, newTheme);
  applyTheme(newTheme);
}

// Apply immediately on script load to prevent any flash
applyTheme();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => applyTheme());
} else {
  applyTheme();
}

// =========================================================================
// 2. SESSION AUTH HELPERS & DATA ISOLATION
// =========================================================================
function isAuthenticated() {
  const localAuth = sessionStorage.getItem('numSysAuth') === 'true'
    || localStorage.getItem('numSysAuth') === 'true';
  if (isFirebaseReady && typeof firebase !== 'undefined' && firebase.auth) {
    try {
      const fbUser = firebase.auth().currentUser;
      return !!fbUser || localAuth;
    } catch (_) {
      return localAuth;
    }
  }
  return localAuth;
}

function clearLocalStats() {
  localStorage.removeItem(POINTS_KEY);
  localStorage.removeItem(MAX_STREAK_KEY);
  localStorage.removeItem(CURRENT_STREAK_KEY);
  localStorage.removeItem(TOTAL_SOLVED_KEY);
  localStorage.removeItem(ERRORS_KEY);
  localStorage.removeItem(CONVERSIONS_KEY);
  localStorage.removeItem(ARITHMETIC_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(ERROR_NOTEBOOK_KEY);
  localStorage.removeItem('numSysCurrentUid');
}

function setAuthSession(userEmail = 'user@sriyansraj.com', displayName = '') {
  sessionStorage.setItem('numSysAuth', 'true');
  localStorage.setItem('numSysAuth', 'true');
  sessionStorage.setItem('numSysUser', userEmail);
  if (displayName) localStorage.setItem('numSysName', displayName);

  let fbUser = null;
  if (isFirebaseReady && typeof firebase !== 'undefined' && firebase.auth) {
    try { fbUser = firebase.auth().currentUser; } catch (_) {}
  }
  const uid = fbUser ? fbUser.uid : ('local_' + userEmail);

  const prevUid = localStorage.getItem('numSysCurrentUid');
  if (prevUid && prevUid !== uid) {
    clearLocalStats();
  }
  localStorage.setItem('numSysCurrentUid', uid);
}

function clearAuthSession() {
  sessionStorage.removeItem('numSysAuth');
  localStorage.removeItem('numSysAuth');
  sessionStorage.removeItem('numSysUser');
  localStorage.removeItem('numSysName');
  clearLocalStats();
}

function getDisplayName() {
  if (!isAuthenticated()) return 'Learner';

  if (isFirebaseReady && typeof firebase !== 'undefined' && firebase.auth) {
    try {
      const user = firebase.auth().currentUser;
      if (user && user.displayName) return user.displayName;
    } catch (_) {}
  }

  const storedName = localStorage.getItem('numSysName');
  if (storedName) return storedName;

  if (isFirebaseReady && typeof firebase !== 'undefined' && firebase.auth) {
    try {
      const user = firebase.auth().currentUser;
      if (user && user.email) return user.email.split('@')[0];
    } catch (_) {}
  }

  const storedEmail = sessionStorage.getItem('numSysUser') || localStorage.getItem('numSysUser') || '';
  if (storedEmail && storedEmail.includes('@')) return storedEmail.split('@')[0];
  return 'Learner';
}

// =========================================================================
// 3. ROUTE PROTECTION & USER STATS LOADING
// =========================================================================
function checkIsLoginPage() {
  const currentPath = window.location.pathname.toLowerCase();
  if (currentPath.endsWith('index1.html') || currentPath.endsWith('number-system-quiz.html')) return false;
  return currentPath.endsWith('index.html') || currentPath.endsWith('/') || currentPath === '';
}

async function loadUserStatsFromFirestore(user) {
  if (!user || !isFirestoreReady) return;
  try {
    const currentUid = localStorage.getItem('numSysCurrentUid');
    if (currentUid && currentUid !== user.uid) {
      clearLocalStats();
    }
    localStorage.setItem('numSysCurrentUid', user.uid);

    const db = firebase.firestore();
    const docRef = db.collection('userStats').doc(user.uid);
    const doc = await docRef.get();

    if (doc.exists) {
      const data = doc.data();
      const fetchedMax = parseInt(data.maxStreak || 0, 10);
      const fetchedCur = parseInt(data.currentStreak || data.streak || 0, 10);
      const localMax = parseInt(localStorage.getItem(MAX_STREAK_KEY) || '0', 10);
      const localCur = parseInt(localStorage.getItem(CURRENT_STREAK_KEY) || '0', 10);

      const fetchedPts = parseInt(data.points || 0, 10);
      const localPts = parseInt(localStorage.getItem(POINTS_KEY) || '0', 10);

      const fetchedSolved = parseInt(data.totalSolved || 0, 10);
      const localSolved = parseInt(localStorage.getItem(TOTAL_SOLVED_KEY) || '0', 10);

      const fetchedErrors = parseInt(data.errors || 0, 10);
      const localErrors = parseInt(localStorage.getItem(ERRORS_KEY) || '0', 10);

      const fetchedConversions = parseInt(data.conversions || 0, 10);
      const localConversions = parseInt(localStorage.getItem(CONVERSIONS_KEY) || '0', 10);

      const fetchedArithmetic = parseInt(data.arithmetic || 0, 10);
      const localArithmetic = parseInt(localStorage.getItem(ARITHMETIC_KEY) || '0', 10);

      const maxS = Math.max(fetchedMax, fetchedCur, localMax);
      const curS = Math.max(fetchedCur, localCur);
      const pts = Math.max(fetchedPts, localPts);
      const solved = Math.max(fetchedSolved, localSolved);
      const errs = Math.max(fetchedErrors, localErrors);
      const convs = Math.max(fetchedConversions, localConversions);
      const arith = Math.max(fetchedArithmetic, localArithmetic);

      const stats = {
        points: pts,
        maxStreak: maxS,
        currentStreak: curS,
        totalSolved: solved,
        errors: errs,
        conversions: convs,
        arithmetic: arith
      };
      saveStats(stats);

      if (pts > fetchedPts || solved > fetchedSolved || maxS > fetchedMax) {
        syncStatsToFirestore(stats);
      }

      if (Array.isArray(data.history)) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(data.history));
      } else {
        localStorage.setItem(HISTORY_KEY, '[]');
      }

      if (Array.isArray(data.errorNotebook)) {
        localStorage.setItem(ERROR_NOTEBOOK_KEY, JSON.stringify(data.errorNotebook));
      } else {
        localStorage.setItem(ERROR_NOTEBOOK_KEY, '[]');
      }
    } else {
      // Initialize brand new user record in Firestore
      const defaultStats = {
        points: 0,
        maxStreak: 0,
        currentStreak: 0,
        totalSolved: 0,
        errors: 0,
        conversions: 0,
        arithmetic: 0
      };
      saveStats(defaultStats);
      localStorage.setItem(HISTORY_KEY, '[]');
      localStorage.setItem(ERROR_NOTEBOOK_KEY, '[]');
      syncStatsToFirestore(defaultStats);
    }

    if (typeof window.refreshDashboardUI === 'function') {
      window.refreshDashboardUI();
    }
  } catch (err) {
    console.warn("Error loading user stats from Firestore:", err.message);
  }
}

function protectRoute() {
  const onLoginPage = checkIsLoginPage();
  if (!onLoginPage) {
    if (!isAuthenticated()) {
      document.documentElement.style.display = 'none';
      window.location.replace('index.html');
      return false;
    }
  } else {
    if (isAuthenticated()) {
      window.location.replace('index1.html');
      return false;
    }
  }
  return true;
}

async function checkAdminAuthorization(user) {
  if (!user) return false;
  try {
    const tokenResult = await user.getIdTokenResult();
    if (tokenResult && tokenResult.claims && tokenResult.claims.admin === true) {
      return true;
    }
  } catch (e) {
    console.debug('Custom claim check notice:', e.message);
  }

  if (isFirestoreReady && typeof firebase !== 'undefined' && firebase.firestore) {
    try {
      const snap = await firebase.firestore().collection('admins').doc(user.uid).get();
      if (snap.exists) {
        const data = snap.data() || {};
        if (data.isAdmin !== false) {
          return true;
        }
      }
    } catch (e) {
      console.debug('admins/' + user.uid + ' doc check notice:', e.message);
    }
  }

  return false;
}

function applyAdminUIState(isAdmin) {
  const isCurrentlyAdmin = isAdmin || window.IS_ADMIN || sessionStorage.getItem('numSysIsAdmin') === 'true';
  
  if (isCurrentlyAdmin) {
    document.body.classList.add('admin-mode');
    
    // Hide personal score/points/stats/mistakes UI elements for admin
    const selectorsToHide = [
      '#pointsBadge', '#statPoints', '#dashPoints', '#streakDisplay', '#statStreak',
      '#statBestStreak', '#pointsToggle', '#leaderboardModal', '#mistakesNavBtn'
    ];
    selectorsToHide.forEach(selector => {
      const el = document.querySelector(selector);
      if (el) el.style.display = 'none';
    });

    // Inject or update Admin Mode badge in topbar / header
    let badge = document.getElementById('adminModeHeaderBadge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'adminModeHeaderBadge';
      badge.className = 'mode-badge admin';
      badge.innerHTML = '👑 Admin Mode';
      badge.style.cssText = 'background:rgba(245,158,11,0.2); color:#fcd34d; border:1px solid rgba(245,158,11,0.4); padding:4px 12px; border-radius:12px; font-weight:700; font-size:12px; display:inline-flex; align-items:center; gap:4px; margin-right:8px;';
      
      const container = document.querySelector('.top-right-controls') || document.querySelector('.topbar-right') || document.body;
      if (container) container.insertBefore(badge, container.firstChild);
    }
  } else {
    document.body.classList.remove('admin-mode');
    const badge = document.getElementById('adminModeHeaderBadge');
    if (badge) badge.remove();
  }
}

// Firebase Auth state listener
function setupFirebaseAuthListener() {
  if (typeof firebase !== 'undefined' && firebase.auth) {
    try {
      firebase.auth().onAuthStateChanged(async (user) => {
        const onLoginPage = checkIsLoginPage();
        if (user) {
          setAuthSession(user.email, user.displayName || '');
          const isAdmin = await checkAdminAuthorization(user);
          window.IS_ADMIN = isAdmin;
          sessionStorage.setItem('numSysIsAdmin', isAdmin ? 'true' : 'false');

          if (isAdmin) {
            clearLocalStats();
          } else {
            await loadUserStatsFromFirestore(user);
          }

          applyAdminUIState(isAdmin);

          if (onLoginPage) window.location.replace('index1.html');
        } else if (isFirebaseReady && !onLoginPage) {
          clearAuthSession();
          window.location.replace('index.html');
        } else {
          clearLocalStats();
        }
      });
    } catch (err) {
      console.warn("Auth listener notice:", err.message);
    }
  }
}

// Global logout
function logoutUser() {
  clearAuthSession();
  if (isFirebaseReady && typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().signOut()
      .then(() => window.location.replace('index.html'))
      .catch(() => window.location.replace('index.html'));
  } else {
    window.location.replace('index.html');
  }
}

// Run protection immediately
protectRoute();

// =========================================================================
// 4. TIME-BASED GREETING
// =========================================================================
function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { emoji: '🌅', text: 'Good Morning' };
  if (hour >= 12 && hour < 17) return { emoji: '☀️', text: 'Good Afternoon' };
  if (hour >= 17 && hour < 21) return { emoji: '🌆', text: 'Good Evening' };
  return { emoji: '🌙', text: 'Good Night' };
}

function injectTimeGreeting() {
  const el = document.getElementById('timeGreeting');
  if (!el) return;
  const { emoji, text } = getTimeGreeting();
  const name = getDisplayName();
  const emojiEl = el.querySelector('#greetEmoji');
  const textEl = el.querySelector('#greetText');
  if (emojiEl) emojiEl.textContent = emoji;
  if (textEl) textEl.textContent = `${text}, ${name}!`;
}

// =========================================================================
// 5. UNIFIED DIGITAL POINTS & STATS ENGINE
// =========================================================================
const POINTS_KEY = 'numSysPoints';
const MAX_STREAK_KEY = 'numSysMaxStreak';
const CURRENT_STREAK_KEY = 'numSysCurrentStreak';
const TOTAL_SOLVED_KEY = 'numSysTotalSolved';
const ERRORS_KEY = 'numSysErrors';
const CONVERSIONS_KEY = 'numSysConversions';
const ARITHMETIC_KEY = 'numSysArithmetic';
const HISTORY_KEY = 'numSysHistory';
const ERROR_NOTEBOOK_KEY = 'numSysErrorNotebook';

function getStats() {
  return {
    points: parseInt(localStorage.getItem(POINTS_KEY) || '0', 10),
    maxStreak: parseInt(localStorage.getItem(MAX_STREAK_KEY) || '0', 10),
    currentStreak: parseInt(localStorage.getItem(CURRENT_STREAK_KEY) || '0', 10),
    totalSolved: parseInt(localStorage.getItem(TOTAL_SOLVED_KEY) || '0', 10),
    errors: parseInt(localStorage.getItem(ERRORS_KEY) || '0', 10),
    conversions: parseInt(localStorage.getItem(CONVERSIONS_KEY) || '0', 10),
    arithmetic: parseInt(localStorage.getItem(ARITHMETIC_KEY) || '0', 10),
  };
}

function saveStats(stats) {
  localStorage.setItem(POINTS_KEY, Math.max(0, stats.points));
  localStorage.setItem(MAX_STREAK_KEY, stats.maxStreak);
  localStorage.setItem(CURRENT_STREAK_KEY, stats.currentStreak);
  localStorage.setItem(TOTAL_SOLVED_KEY, stats.totalSolved);
  localStorage.setItem(ERRORS_KEY, stats.errors);
  localStorage.setItem(CONVERSIONS_KEY, stats.conversions);
  localStorage.setItem(ARITHMETIC_KEY, stats.arithmetic);
}

// ── HISTORY MANAGEMENT (Last 200 solved questions) ──────────────────────────
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function addHistoryEntry(entry) {
  const list = getHistory();
  list.unshift({
    id: Date.now() + Math.random().toString(36).substring(2, 5),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: new Date().toLocaleDateString(),
    ...entry
  });
  // Keep last 200 entries
  const trimmed = list.slice(0, 200);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  syncStatsToFirestore(getStats());
  return trimmed;
}

// ── ERROR NOTEBOOK MANAGEMENT (Conversion Page Only) ───────────────────────
function getErrorNotebook() {
  try {
    return JSON.parse(localStorage.getItem(ERROR_NOTEBOOK_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function addErrorNotebookEntry(item) {
  const list = getErrorNotebook();
  // Check duplicate question
  const existingIdx = list.findIndex(e => e.qStr === item.qStr && e.sB === item.sB && e.tB === item.tB);
  if (existingIdx !== -1) {
    list[existingIdx] = { ...list[existingIdx], timestamp: Date.now(), userEntered: item.userEntered };
  } else {
    list.unshift({
      id: 'err_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      sB: item.sB,
      tB: item.tB,
      qStr: item.qStr,
      aStr: item.aStr,
      userEntered: item.userEntered,
      timestamp: Date.now()
    });
  }
  localStorage.setItem(ERROR_NOTEBOOK_KEY, JSON.stringify(list));
  syncStatsToFirestore(getStats());
}

function removeErrorNotebookEntry(id) {
  let list = getErrorNotebook();
  list = list.filter(e => e.id !== id);
  localStorage.setItem(ERROR_NOTEBOOK_KEY, JSON.stringify(list));
  syncStatsToFirestore(getStats());
  return list;
}

function checkAndRemoveErrorNotebookEntry(qStr, sB, tB) {
  let list = getErrorNotebook();
  const initialLen = list.length;
  list = list.filter(e => !(e.qStr === qStr && e.sB === sB && e.tB === tB));
  if (list.length < initialLen) {
    localStorage.setItem(ERROR_NOTEBOOK_KEY, JSON.stringify(list));
    syncStatsToFirestore(getStats());
    return true; // was removed!
  }
  return false;
}

// ── NEW PROGRESSIVE SCORING SYSTEM CALCULATOR ────────────────────────────
/**
 * Helper to determine score tier, tier multiplier, and wrong penalty based on current points.
 * SCORE TIERS:
 * 0–249:    100% reward (1.0), wrong = -3
 * 250–499:  80% reward (0.8), wrong = -5
 * 500–749:  65% reward (0.65), wrong = -7
 * 750–999:  50% reward (0.5), wrong = -9
 * 1000+:    40% reward (0.4), wrong = -12
 */
function getScoreTier(points) {
  const pts = Math.max(0, points || 0);
  if (pts >= 1000) {
    return { name: '1000+', multiplier: 0.4, wrongPenalty: 12 };
  } else if (pts >= 750) {
    return { name: '750–999', multiplier: 0.5, wrongPenalty: 9 };
  } else if (pts >= 500) {
    return { name: '500–749', multiplier: 0.65, wrongPenalty: 7 };
  } else if (pts >= 250) {
    return { name: '250–499', multiplier: 0.8, wrongPenalty: 5 };
  } else {
    return { name: '0–249', multiplier: 1.0, wrongPenalty: 3 };
  }
}

/**
 * Calculates score delta based on Progressive Scoring System:
 * Correct Answer:
 * - Base = +5
 * - Difficulty: Easy (+0), Medium (+2), Hard (+4), Extreme (+6)
 * - Streak: 3–4 (+2), 5–9 (+4), 10–14 (+6), 15+ (+8)
 * - Speed: <=10s (+3), 10–20s (+2), 20–30s (+1), >30s (+0)
 * - Formula: Reward = Math.round((5 + Difficulty + Streak + Speed) * Tier Multiplier)
 * Wrong Answer:
 * - Score -= tier penalty (3, 5, 7, 9, or 12)
 * - Streak = 0
 * - Score can never go below 0.
 */
function recordQuestionResult({
  type,          // 'arithmetic' | 'conversion'
  problemStr,    // string description, e.g. "1010 + 0110 (Binary)"
  userAnswer,    // string
  correctAnswer, // string
  isCorrect,     // boolean
  level = 'easy',// 'easy' | 'medium' | 'hard' | 'extreme' or bits '4'|'8'|'16'|'32'
  timeSeconds = 0,
  extraData = {} // { sB, tB, qStr, aStr } for conversion
}) {
  if (window.IS_ADMIN || sessionStorage.getItem('numSysIsAdmin') === 'true') {
    // Admins do not record points, accuracy, history, or mistakes in the database
    return {
      pointsDelta: 0,
      totalPoints: 0,
      currentStreak: 0,
      maxStreak: 0,
      masteredFromNotebook: false,
      tier: { name: 'Admin', multiplier: 1, wrongPenalty: 0 },
      stats: { points: 0, totalSolved: 0, errors: 0, conversions: 0, arithmetic: 0 }
    };
  }

  const stats = getStats();
  stats.totalSolved++;
  if (type === 'conversion') stats.conversions++;
  else stats.arithmetic++;

  const currentTier = getScoreTier(stats.points);
  let pointsDelta = 0;
  let masteredFromNotebook = false;

  if (isCorrect) {
    // Current streak increment
    stats.currentStreak++;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);

    // 1. Base Points: +5
    let basePts = 5;

    // 2. Difficulty Bonus: Easy (+0), Medium (+2), Hard (+4), Extreme (+6)
    let levelBonus = 0;
    const lLower = String(level).toLowerCase();
    if (lLower === 'medium' || lLower === '8') levelBonus = 2;
    else if (lLower === 'hard' || lLower === '16') levelBonus = 4;
    else if (lLower === 'extreme' || lLower === '32') levelBonus = 6;

    // 3. Streak Bonus: 3–4 (+2), 5–9 (+4), 10–14 (+6), 15+ (+8)
    let streakBonus = 0;
    const curStr = stats.currentStreak;
    if (curStr >= 15) streakBonus = 8;
    else if (curStr >= 10) streakBonus = 6;
    else if (curStr >= 5) streakBonus = 4;
    else if (curStr >= 3) streakBonus = 2;

    // 4. Speed Bonus: <=10s (+3), 10–20s (+2), 20–30s (+1), >30s (+0)
    let timeBonus = 0;
    if (timeSeconds > 0) {
      if (timeSeconds <= 10) timeBonus = 3;
      else if (timeSeconds <= 20) timeBonus = 2;
      else if (timeSeconds <= 30) timeBonus = 1;
    }

    // Formula: Reward = Math.round((5 + Difficulty + Streak + Speed) * Tier Multiplier)
    const rawReward = basePts + levelBonus + streakBonus + timeBonus;
    pointsDelta = Math.round(rawReward * currentTier.multiplier);
    stats.points += pointsDelta;
  } else {
    // WRONG ANSWER -> Score -= tier penalty, Streak = 0, min points = 0
    stats.errors++;
    stats.currentStreak = 0;
    pointsDelta = -currentTier.wrongPenalty;
    stats.points = Math.max(0, stats.points + pointsDelta);
  }

  saveStats(stats);
  syncStatsToFirestore(stats);

  // Add to History
  addHistoryEntry({
    type: type === 'conversion' ? 'Conversion' : 'Arithmetic',
    problem: problemStr,
    userAnswer,
    correctAnswer,
    isCorrect,
    pointsDelta,
    timeSeconds: Math.round(timeSeconds * 10) / 10
  });

  return {
    pointsDelta,
    totalPoints: stats.points,
    currentStreak: stats.currentStreak,
    maxStreak: stats.maxStreak,
    masteredFromNotebook,
    tier: currentTier,
    stats
  };
}

// Deprecated wrapper for backward compatibility with older callers
function awardArithmeticPoints(level, correct, streak, timeSeconds = 0) {
  const res = recordQuestionResult({
    type: 'arithmetic',
    problemStr: 'Arithmetic Problem',
    userAnswer: correct ? 'Correct' : 'Wrong',
    correctAnswer: 'Answer',
    isCorrect: correct,
    level,
    timeSeconds
  });
  return res.pointsDelta;
}

function awardConversionPoints(level = '8', isCorrect = true, timeSeconds = 0) {
  const res = recordQuestionResult({
    type: 'conversion',
    problemStr: 'Base Conversion',
    userAnswer: isCorrect ? 'Correct' : 'Wrong',
    correctAnswer: 'Answer',
    isCorrect,
    level,
    timeSeconds
  });
  return res.pointsDelta;
}

/**
 * Sync stats to Firestore under userStats/{uid}
 */
function syncStatsToFirestore(stats) {
  if (window.IS_ADMIN || sessionStorage.getItem('numSysIsAdmin') === 'true') {
    // Admins store nothing in database!
    return;
  }
  const name = getDisplayName();
  const summaryObj = {
    uid: (isFirebaseReady && typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser)
      ? firebase.auth().currentUser.uid : 'local_user',
    name: name,
    email: (isFirebaseReady && typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser)
      ? firebase.auth().currentUser.email : (localStorage.getItem('numSysUser') || ''),
    points: Number(stats.points || 0),
    maxStreak: Math.max(Number(stats.maxStreak || 0), Number(stats.currentStreak || 0)),
    currentStreak: Number(stats.currentStreak || 0),
    totalSolved: Number(stats.totalSolved || 0),
    errors: Number(stats.errors || 0),
    conversions: Number(stats.conversions || 0),
    arithmetic: Number(stats.arithmetic || 0),
    accuracy: stats.totalSolved > 0
      ? Math.round(((stats.totalSolved - stats.errors) / stats.totalSolved) * 100)
      : 0,
    updatedAtMs: Date.now()
  };

  if (!isFirestoreReady || !isFirebaseReady) return;
  try {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const db = firebase.firestore();
    const history = getHistory();
    const errorNotebook = getErrorNotebook();

    const payload = {
      ...summaryObj,
      history: history,
      errorNotebook: errorNotebook,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Sync to userStats collection
    db.collection('userStats').doc(user.uid).set(payload, { merge: true })
      .catch(e => console.warn('userStats sync notice:', e.message));
  } catch (e) {
    console.warn('Firestore sync notice:', e.message);
  }
}

/**
 * Fetch top leaderboard from Firestore collection `userStats`.
 * Only actual registered student records are returned.
 * @returns {Promise<Array>}
 */
async function fetchLeaderboard() {
  const mergedMap = new Map();

  const fbUser = (isFirebaseReady && typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
  const myUid = fbUser ? fbUser.uid : null;
  const myEmail = fbUser ? fbUser.email : (localStorage.getItem('numSysUser') || '');
  const myName = getDisplayName();

  // Helper to add documents into mergedMap
  const addRows = (rows) => {
    if (!Array.isArray(rows)) return;
    rows.forEach(r => {
      if (!r) return;
      const rEmail = r.email || '';
      const rName = r.name || '';
      const isMe = (myUid && r.uid === myUid) || (myEmail && rEmail === myEmail) || (rName && myName && rName.toLowerCase() === myName.toLowerCase()) || r._isMe || false;

      let key = (isMe && myUid) ? myUid : (r.uid || r.id || rEmail || rName);
      if (!key) return;

      const existing = mergedMap.get(key);
      const rPoints = Number(r.points || 0);
      const exPoints = existing ? Number(existing.points || 0) : -1;

      if (!existing || rPoints >= exPoints) {
        mergedMap.set(key, {
          uid: r.uid || key,
          name: r.name || (r.email ? r.email.split('@')[0] : 'Learner'),
          email: r.email || '',
          points: Math.max(rPoints, existing ? Number(existing.points || 0) : 0),
          totalSolved: Math.max(Number(r.totalSolved || 0), existing ? Number(existing.totalSolved || 0) : 0),
          errors: Number(r.errors || 0),
          maxStreak: Math.max(Number(r.maxStreak || 0), existing ? Number(existing.maxStreak || 0) : 0),
          accuracy: r.accuracy != null ? Number(r.accuracy) : (r.totalSolved > 0 ? Math.round(((r.totalSolved - (r.errors || 0)) / r.totalSolved) * 100) : 0),
          _isMe: isMe || (existing && existing._isMe) || false
        });
      }
    });
  };

  // 1. Add current student's active session stats
  try {
    const localStats = getStats();
    if (localStats && (localStats.points > 0 || localStats.totalSolved > 0)) {
      const fbUser = (isFirebaseReady && typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
      addRows([{
        uid: fbUser ? fbUser.uid : ('local_' + getDisplayName()),
        name: getDisplayName(),
        email: fbUser ? fbUser.email : (localStorage.getItem('numSysUser') || ''),
        points: localStats.points,
        totalSolved: localStats.totalSolved,
        errors: localStats.errors,
        maxStreak: localStats.maxStreak,
        _isMe: true
      }]);
    }
  } catch (e) {}

  // 2. Fetch real student records from Firestore userStats
  if (isFirebaseReady && typeof firebase !== 'undefined' && firebase.firestore) {
    try {
      const db = firebase.firestore();
      let snap;
      try {
        snap = await db.collection('userStats').orderBy('points', 'desc').limit(20).get();
      } catch (orderErr) {
        // Fallback without ordering index if index is building
        snap = await db.collection('userStats').limit(50).get();
      }
      if (snap && !snap.empty) {
        const docs = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        addRows(docs);
      }
    } catch (e) {
      if (e.code === 'permission-denied' || (e.message && e.message.includes('permission'))) {
        console.warn('Firestore Permission Notice: To share leaderboard scores across all students, please enable read permission on userStats collection in Firebase Console rules.');
      } else {
        console.warn('Firestore leaderboard query notice:', e.message);
      }
    }
  }

  const result = Array.from(mergedMap.values());
  result.sort((a, b) => Number(b.points || 0) - Number(a.points || 0));

  return result.slice(0, 20);
}

// Expose globally so index.html, index1.html, and number-system-quiz.html can call these
window.NST = {
  getStats,
  saveStats,
  getScoreTier,
  recordQuestionResult,
  awardArithmeticPoints,
  awardConversionPoints,
  fetchLeaderboard,
  getDisplayName,
  getTimeGreeting,
  injectTimeGreeting,
  getHistory,
  getErrorNotebook,
  removeErrorNotebookEntry,
  loadUserStatsFromFirestore,
  clearLocalStats
};

// =========================================================================
// 6. LOGIN PAGE LOGIC (index.html)
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Inject time greeting if element exists
  injectTimeGreeting();

  // Toggle panels
  const container = document.getElementById('container');
  const registerBtn = document.getElementById('register');
  const loginBtn = document.getElementById('login');

  if (registerBtn && container) {
    registerBtn.addEventListener('click', () => container.classList.add('active'));
  }
  if (loginBtn && container) {
    loginBtn.addEventListener('click', () => container.classList.remove('active'));
  }

  // ── SIGN IN (email/password) ──────────────────────────────────────────
  const signInForm = document.getElementById('signInForm');
  if (signInForm) {
    signInForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = (document.getElementById('signInEmail')?.value || '').trim();
      const password = document.getElementById('signInPassword')?.value || '';

      if (!email || !password) {
        showToast('Please enter both email and password.', 'error');
        return;
      }

      if (isFirebaseReady && typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signInWithEmailAndPassword(email, password)
          .then((cred) => cred.user.reload().then(() => cred.user))
          .then((user) => {
            setAuthSession(user.email, user.displayName || '');
            showToast('Welcome back! Loading trainer…', 'success');
            setTimeout(() => window.location.replace('index1.html'), 700);
          })
          .catch(handleAuthError);
      } else {
        showToast('Firebase is not initialized. Please check your connection.', 'error');
      }
    });
  }

  // ── SIGN UP (email/password) ──────────────────────────────────────────
  const signUpForm = document.getElementById('signUpForm');
  if (signUpForm) {
    signUpForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = (document.getElementById('signUpName')?.value || '').trim();
      const email = (document.getElementById('signUpEmail')?.value || '').trim();
      const password = document.getElementById('signUpPassword')?.value || '';

      if (!name) {
        showToast('Please enter your full name.', 'error');
        return;
      }
      if (!email || !password) {
        showToast('Please provide a valid email and password.', 'error');
        return;
      }
      if (password.length < 6) {
        showToast('Password must be at least 6 characters.', 'error');
        return;
      }

      if (isFirebaseReady && typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().createUserWithEmailAndPassword(email, password)
          .then((cred) => {
            return cred.user.updateProfile({ displayName: name })
              .then(() => cred.user.reload())
              .then(() => cred.user);
          })
          .then((user) => {
            setAuthSession(user.email, name);
            showToast(`Account created! Welcome, ${name} 🎉`, 'success');
            setTimeout(() => window.location.replace('index1.html'), 800);
          })
          .catch(handleAuthError);
      } else {
        showToast('Firebase is not initialized. Please check your connection.', 'error');
      }
    });
  }

  // ── GOOGLE SIGN-IN ────────────────────────────────────────────────────
  function handleGoogleSignIn(e) {
    e.preventDefault();
    if (isFirebaseReady && typeof firebase !== 'undefined' && firebase.auth) {
      const provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider)
        .then((result) => {
          const user = result.user;
          setAuthSession(user.email, user.displayName || '');
          showToast(`Signed in as ${user.displayName || user.email} 🎉`, 'success');
          setTimeout(() => window.location.replace('index1.html'), 700);
        })
        .catch(handleAuthError);
    } else {
      showToast('Firebase is not initialized. Please check your connection.', 'error');
    }
  }

  const googleSignInBtn = document.getElementById('googleSignInBtn');
  const googleSignUpBtn = document.getElementById('googleSignUpBtn');
  if (googleSignInBtn) googleSignInBtn.addEventListener('click', handleGoogleSignIn);
  if (googleSignUpBtn) googleSignUpBtn.addEventListener('click', handleGoogleSignIn);
});

// =========================================================================
// 7. AUTH ERROR HANDLER
// =========================================================================
function handleAuthError(error) {
  console.error("Firebase Auth Error:", error);
  const code = error && error.code;
  if (code === 'auth/unauthorized-domain') {
    const host = window.location.hostname;
    showToast(`Domain "${host}" not authorized. Add it in Firebase Console → Authentication → Settings → Authorized Domains.`, 'error');
  } else if (code === 'auth/email-already-in-use') {
    showToast('That email is already registered. Try signing in instead.', 'error');
  } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    showToast('Incorrect email or password. Please try again.', 'error');
  } else if (code === 'auth/user-not-found') {
    showToast('No account found with that email. Sign up first!', 'error');
  } else if (code === 'auth/weak-password') {
    showToast('Password is too weak. Use at least 6 characters.', 'error');
  } else if (code === 'auth/popup-closed-by-user') {
    showToast('Sign-in popup was closed. Please try again.', 'info');
  } else {
    showToast(error.message || 'Authentication error. Please try again.', 'error');
  }
}

// =========================================================================
// 8. TOAST NOTIFICATION
// =========================================================================
function showToast(msg, type = 'info') {
  let toast = document.getElementById('auth-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'auth-toast';
    document.body.appendChild(toast);
  }
  toast.className = `auth-toast ${type}`;
  toast.textContent = msg;
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 3800);
}

// =========================================================================
// 9. GEMINI AI UNIFIED CLIENT (LOCAL EXPRESS & CLOUDFLARE PROXY FALLBACK)
// =========================================================================
window.callGeminiAPI = async function(prompt) {
  const isGitHubPages = window.location.hostname.includes('github.io');
  const proxyUrl = "https://gemini-proxy.sriyansraj02.workers.dev/";

  // 1. Try local server endpoint if not on GitHub Pages
  if (!isGitHubPages) {
    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.solution) {
          return data.solution;
        }
        if (data && data.error === "RATE_LIMIT_EXHAUSTED") {
          console.warn("Gemini API rate limit reached, switching to offline step-by-step generator.");
          return null;
        }
      }
    } catch (e) {
      console.warn("Local /api/solve request unavailable, trying Cloudflare Gemini proxy:", e);
    }
  }

  // 2. Direct Worker Call
  try {
    const workerRes = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!workerRes.ok) {
      console.warn(`Gemini Proxy HTTP status ${workerRes.status}, falling back to local math engine.`);
      return null;
    }

    const data = await workerRes.json();
    if (data.error && (data.error.code === 429 || data.error.status === "RESOURCE_EXHAUSTED")) {
      console.warn("Gemini Proxy rate limit hit, using offline solution generator.");
      return null;
    }

    let resText = null;
    if (data.solution) resText = data.solution;
    else if (data.text) resText = data.text;
    else if (data.result) resText = data.result;
    else if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      resText = data.candidates[0].content.parts[0].text;
    } else if (data.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      resText = data.response.candidates[0].content.parts[0].text;
    } else if (typeof data === 'string') {
      resText = data;
    }

    if (resText) {
      const trimmed = String(resText).trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.solution) return parsed.solution;
          if (parsed.text) return parsed.text;
        } catch (_) {}
      }
      return resText;
    }
    return null;
  } catch (err) {
    console.warn("Gemini API request failed, switching to offline step generator:", err.message);
    return null;
  }
};


