    /* Sound Effects (Web Audio API) */
    let quizAudioCtx = null;
    function getQuizAudioCtx() {
      if (!quizAudioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        quizAudioCtx = new AC();
      }
      if (quizAudioCtx && quizAudioCtx.state === 'suspended') {
        quizAudioCtx.resume();
      }
      return quizAudioCtx;
    }
    function playQuizTone(freq, duration, type = 'sine', gainPeak = 0.18) {
      try {
        const ctx = getQuizAudioCtx();
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
      } catch (e) { }
    }
    const playClickSound   = () => playQuizTone(520, 0.06, 'square', 0.1);
    const playSuccessSound = () => { playQuizTone(660, 0.12, 'sine'); setTimeout(() => playQuizTone(880, 0.18, 'sine'), 90); };
    const playErrorSound   = () => { playQuizTone(180, 0.22, 'sawtooth', 0.14); };

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, .btn, .chip, .nav-switch-link, .lb-btn, .theme-toggle-btn, .lb-close, .switch, input[type="button"], input[type="submit"], input[type="checkbox"], .tab, a.btn');
      if (btn) {
        playClickSound();
      }
    }, true);

    const BASES = { 2: 'Binary', 8: 'Octal', 10: 'Decimal', 16: 'Hex' };
    const BASE_LIST = [2, 8, 10, 16];
    let currentQ = null;
    let stats = { correct: 0, total: 0, streak: 0 };
    let questionStartTime = Date.now();

    function randInt(bits) {
      if (bits <= 30) {
        const max = Math.pow(2, bits);
        const min = Math.pow(2, bits - 4) || 0;
        return BigInt(Math.floor(Math.random() * (max - min) + min));
      }
      const hexDigits = Math.ceil(bits / 4);
      let hex = "";
      for (let i = 0; i < hexDigits; i++) {
        const digit = (i === 0) ? (Math.floor(Math.random() * 8) + 8) : Math.floor(Math.random() * 16);
        hex += digit.toString(16);
      }
      return BigInt("0x" + hex);
    }

    /**
     * Generates a random fractional string in source base `sB` with 2 to 4 digits.
     * Ensures the last digit is non-zero so there are no trailing zeros.
     */
    function generateSourceFracString(sB) {
      const len = Math.floor(Math.random() * 3) + 2; // 2, 3, or 4 digits
      let fracStr = "";
      for (let i = 0; i < len; i++) {
        let digit;
        if (i === len - 1) {
          digit = Math.floor(Math.random() * (sB - 1)) + 1;
        } else {
          digit = Math.floor(Math.random() * sB);
        }
        fracStr += digit.toString(sB).toUpperCase();
      }
      return fracStr;
    }

    /**
     * Converts a fractional string `sFrac` in source base `sB` to target base `tB` string representation
     * by evaluating the exact fractional value of `sFrac` in base `sB`
     * and performing digit-by-digit recursive multiplication in base `tB` up to max 4 fractional places.
     */
    function convertFracBase(sFrac, sB, tB, maxDigits = 4) {
      if (!sFrac) return "";

      // Calculate exact numeric value of fractional string in base sB
      let val = 0;
      for (let i = 0; i < sFrac.length; i++) {
        const digit = parseInt(sFrac[i], sB);
        if (isNaN(digit)) continue;
        val += digit / Math.pow(sB, i + 1);
      }
      if (val <= 0) return "";

      // Convert value to target base tB up to max 4 places
      let res = "";
      let temp = val;
      const limit = Math.min(maxDigits, 4);
      for (let i = 0; i < limit; i++) {
        temp = Math.round(temp * 1e12) / 1e12; // Guard against IEEE 754 float precision noise
        if (temp <= 0) break;
        temp *= tB;
        let digit = Math.floor(temp);
        res += digit.toString(tB).toUpperCase();
        temp -= digit;
      }
      return res;
    }

    function generateQuestion() {
      const bits = parseInt(document.getElementById('bitWidth').value);
      const hasFrac = document.getElementById('fracToggle').checked;

      let sB = document.getElementById('sourceBase').value;
      let tB = document.getElementById('targetBase').value;

      if (sB === 'random') sB = BASE_LIST[Math.floor(Math.random() * 4)];
      if (tB === 'random') tB = BASE_LIST[Math.floor(Math.random() * 4)];

      sB = parseInt(sB); tB = parseInt(tB);
      if (sB === tB) {
        const available = BASE_LIST.filter(b => b !== sB);
        tB = available[Math.floor(Math.random() * available.length)];
      }

      const intPart = randInt(bits);
      const sInt = intPart.toString(sB).toUpperCase();
      const tInt = intPart.toString(tB).toUpperCase();

      let sFrac = "";
      let tFrac = "";

      if (hasFrac) {
        sFrac = generateSourceFracString(sB);
        tFrac = convertFracBase(sFrac, sB, tB, 4);
      }

      currentQ = {
        sB, tB,
        qStr: sFrac ? `${sInt}.${sFrac}` : sInt,
        aStr: tFrac ? `${tInt}.${tFrac}` : tInt,
        isVerified: false
      };

      document.getElementById('sourceLbl').textContent = BASES[currentQ.sB];
      document.getElementById('targetLbl').textContent = BASES[currentQ.tB];
      document.getElementById('questionValue').textContent = currentQ.qStr;

      const ansInp = document.getElementById('answerInput');
      ansInp.value = "";
      ansInp.className = "";
      if (currentQ.tB === 16) {
        ansInp.setAttribute('inputmode', 'text');
        ansInp.setAttribute('autocapitalize', 'characters');
        ansInp.placeholder = "Type hex result (0-9, A-F)...";
      } else {
        ansInp.setAttribute('inputmode', 'numeric');
        ansInp.removeAttribute('autocapitalize');
        ansInp.placeholder = `Type ${BASES[currentQ.tB]} result...`;
      }

      document.getElementById('feedback').style.display = "none";
      const aiBtn = document.getElementById('quizAiSolBtn');
      if (aiBtn) aiBtn.style.display = "none";

      const btnVerifyTxt = document.getElementById('btnVerifyText');
      if (btnVerifyTxt) btnVerifyTxt.textContent = "Check Answer";

      // Prefetch Gemini AI step-by-step conversion solution in background immediately
      

      questionStartTime = Date.now();
      setTimeout(() => { ansInp.focus(); }, 50);
    }

    function normalize(s) {
      if (!s) return "";
      let c = s.trim().toUpperCase().replace(/^0[B|X|O]/, "");
      let [i, f] = c.split('.');
      i = i ? i.replace(/^0+/, '') : "0";
      if (i === "") i = "0";
      if (f) {
        f = f.substring(0, 4).replace(/0+$/, '');
        return f.length ? i + "." + f : i;
      }
      return i;
    }

    function handleQuizAction() {
      if (currentQ && currentQ.isVerified) {
        generateQuestion();
      } else {
        verifyAnswer();
      }
    }

    function verifyAnswer() {
      if (!currentQ) return;
      const ansInp = document.getElementById('answerInput');
      const userRaw = ansInp.value.trim();
      const userNorm = normalize(userRaw);
      const correctNorm = normalize(currentQ.aStr);
      const isCorrect = userNorm === correctNorm;

      currentQ.isVerified = true;
      stats.total++;
      const fb = document.getElementById('feedback');
      fb.style.display = "block";

      const elapsedSec = (Date.now() - questionStartTime) / 1000;
      const bitLevel = document.getElementById('bitWidth').value;

      let ptsRes = { pointsDelta: 0, masteredFromNotebook: false };
      if (window.NST && window.NST.recordQuestionResult) {
        const problemDesc = `${BASES[currentQ.sB]} ➔ ${BASES[currentQ.tB]} (${currentQ.qStr})`;
        ptsRes = window.NST.recordQuestionResult({
          type: 'conversion',
          problemStr: problemDesc,
          userAnswer: userRaw || 'Empty',
          correctAnswer: currentQ.aStr,
          isCorrect: isCorrect,
          level: bitLevel,
          timeSeconds: elapsedSec,
          extraData: {
            sB: currentQ.sB,
            tB: currentQ.tB,
            qStr: currentQ.qStr,
            aStr: currentQ.aStr
          }
        });
        updateQuizPtsBadge();
      }

      const deltaTag = ptsRes.pointsDelta > 0 ? `+${ptsRes.pointsDelta} pts` : `${ptsRes.pointsDelta} pts`;
      const deltaColor = ptsRes.pointsDelta > 0 ? '#15803d' : '#b91c1c';

      if (isCorrect) {
        playSuccessSound();
        stats.correct++;
        stats.streak = ptsRes.currentStreak || (stats.streak + 1);
        ansInp.className = "correct success";
        fb.className = "feedback success";
        fb.innerHTML = `✓ <b>Logic Confirmed!</b> Excellent work. <span style="font-weight:800; color:${deltaColor};">(${deltaTag})</span>`;
      } else {
        playErrorSound();
        stats.streak = 0;
        ansInp.className = "wrong fail";
        fb.className = "feedback fail";
        fb.innerHTML = `✗ <b>Discrepancy Detected.</b> Correct result: <code>${currentQ.aStr}</code> <span style="font-weight:800; color:${deltaColor};">(${deltaTag})</span>`;
      }
      updateStats();

      // Reveal the Gemini AI Solution button ONLY AFTER the user submits
      const aiBtn = document.getElementById('quizAiSolBtn');
      if (aiBtn) aiBtn.style.display = "inline-flex";

      const btnVerifyTxt = document.getElementById('btnVerifyText');
      if (btnVerifyTxt) btnVerifyTxt.textContent = "Next Question →";
    }

    /* ---------------------------------------------------------------------
       QUIZ GEMINI AI PREFETCH & CONVERSION STEP ENGINE
       --------------------------------------------------------------------- */
    function prefetchQuizAiSolution(q) {
      if (!q || q.aiSolutionPromise) return;

      const sName = BASES[q.sB] || `Base ${q.sB}`;
      const tName = BASES[q.tB] || `Base ${q.tB}`;

      const prompt = `You are an expert Computer Science and Digital Logic tutor.
Provide a clean, beautifully formatted, step-by-step mathematical explanation for converting the number "${q.qStr}" from Base ${q.sB} (${sName}) to Base ${q.tB} (${tName}):
- Source Number: ${q.qStr} in Base ${q.sB} (${sName})
- Target Base: Base ${q.tB} (${tName})
- Correct Output: ${q.aStr}

CRITICAL FORMATTING INSTRUCTIONS:
1. DO NOT write or output any programming code, Python scripts, function definitions, code blocks, or library imports (e.g. "import math", "import numpy", "def convert()").
2. DO NOT use raw LaTeX equations like \\frac, \\begin{align}, \\text{}, or dollar-sign math ($$). Use clean Unicode symbols (×, ÷, +, −, ➔, 2³, 16¹, Base 16).
3. Use clean Markdown headings (### for title, #### for steps), numbered lists (1., 2., 3.), bold text, and inline code backticks (\`...\`) for numbers and intermediate digits.
4. End clearly with "**Final Result:** \`${q.aStr}\`".`;

      if (window.callGeminiAPI) {
        q.aiSolutionPromise = window.callGeminiAPI(prompt).then(sol => {
          return sol || generateFallbackConversionExplanation(q);
        }).catch((err) => {
          console.warn("Gemini API call failed for conversion, generating fallback:", err);
          return generateFallbackConversionExplanation(q);
        });
      } else {
        q.aiSolutionPromise = Promise.resolve(generateFallbackConversionExplanation(q));
      }
    }

    function generateFallbackConversionExplanation(q) {
      const sName = BASES[q.sB] || `Base ${q.sB}`;
      const tName = BASES[q.tB] || `Base ${q.tB}`;

      let md = `### Step-by-Step Conversion: ${sName} ➔ ${tName}\n\n`;
      md += `**Problem:** Convert \`${q.qStr}\` (${sName}) to **${tName} (Base ${q.tB})**\n\n`;

      const [intPart, fracPart] = q.qStr.split('.');
      md += `#### 1. Integer Part Conversion (\`${intPart}\`):\n`;
      const decimalInt = parseInt(intPart, q.sB);
      if (q.sB !== 10) {
        md += `- Expand \`${intPart}\` in Base ${q.sB}: Decimal value = \`${decimalInt}\`.\n`;
      }
      if (q.tB !== 10) {
        md += `- Convert Decimal \`${decimalInt}\` to Base ${q.tB} via division by ${q.tB}: Integer result = \`${decimalInt.toString(q.tB).toUpperCase()}\`.\n`;
      } else {
        md += `- Decimal result = \`${decimalInt}\`.\n`;
      }

      if (fracPart) {
        md += `\n#### 2. Fractional Part Conversion (\`.${fracPart}\`):\n`;
        md += `- Evaluate fractional digits in Base ${q.sB} and recursively multiply by ${q.tB}.\n`;
        const convertedFrac = convertFracBase(fracPart, q.sB, q.tB, 4);
        md += `- Converted fractional part = \`.${convertedFrac}\`.\n`;
      }

      md += `\n**Final Result:** \`${q.aStr}\` (${tName})\n`;
      return md;
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

        if (line.includes('Final Result:') || line.includes('Final Product:') || line.includes('Final Difference:') || line.includes('Final Conversion:')) {
          const valMatch = line.match(/`([^`]+)`/) || line.match(/<strong>(.*?)<\/strong>/);
          const valStr = valMatch ? valMatch[1] : line.replace(/.*?:/, '').replace(/[$#]/g, '').trim();
          out.push(`
            <div class="sol-result-card">
              <span class="sol-res-label">🎯 Final Conversion</span>
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

    function openQuizAiModal() {
  if (!currentQ) return;
  const qStr = currentQ.qStr.replace('.', '');
  if (qStr.length > 8) {
    alert("Detailed visual animation is only available for questions up to 8 digits.");
    return;
  }
  window.location.href = `learning.html?detailed=true&mode=conversion&from=${currentQ.sB}&to=${currentQ.tB}&q=${encodeURIComponent(currentQ.qStr)}`;
}


    function closeQuizAiModal() {
      const overlay = document.getElementById('quizAiModalOverlay');
      if (overlay) {
        overlay.classList.remove('show');
        overlay.style.display = 'none';
      }
    }

    function updateQuizPtsBadge() {
      const el = document.getElementById('quizPtsValue');
      if (!el) return;
      const st = window.NST ? window.NST.getStats() : null;
      if (st) el.textContent = st.points + ' pts';
    }

    function syncStatsFromNST() {
      if (window.NST && window.NST.getStats) {
        const st = window.NST.getStats();
        if (st) {
          stats.streak = st.currentStreak || 0;
          if (st.conversions && st.conversions > stats.total) {
            stats.total = st.conversions;
          }
        }
      }
    }

    function updateStats() {
      syncStatsFromNST();
      document.getElementById('scoreCorrect').textContent = stats.correct;
      document.getElementById('scoreTotal').textContent = stats.total;
      document.getElementById('streak').textContent = stats.streak;
    }

    window.refreshDashboardUI = function() {
      updateQuizPtsBadge();
      updateStats();
    };

    // ── HISTORY MODAL HANDLERS ────────────────────────────────────────────────
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
        body.innerHTML = '<p class="lb-empty">No solved questions yet. Solve some conversion problems!</p>';
        return;
      }
      let html = `<div style="display:flex; flex-direction:column; gap:10px;">`;
      history.forEach((item) => {
        const isCorrect = item.isCorrect;
        const badgeBg = isCorrect ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
        const badgeColor = isCorrect ? '#10b981' : '#f43f5e';
        const ptsText = item.pointsDelta > 0 ? `+${item.pointsDelta} pts` : `${item.pointsDelta} pts`;
        const ptsBg = item.pointsDelta > 0 ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.15)';
        const ptsColor = item.pointsDelta > 0 ? '#f59e0b' : '#f43f5e';

        html += `
          <div style="background:var(--card-item-bg); border:1px solid var(--card-item-border); border-radius:12px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; flex-direction:column; gap:2px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:11px; font-weight:700; background:rgba(99,102,241,0.15); color:var(--primary); padding:2px 8px; border-radius:6px; text-transform:uppercase;">${item.type}</span>
                <span style="font-size:13px; font-weight:700; color:var(--item-text);">${item.problem}</span>
              </div>
              <div style="font-size:12px; color:var(--item-subtext); font-family:'JetBrains Mono',monospace; margin-top:3px;">
                Entered: <b style="color:var(--item-text);">${item.userAnswer}</b> | Target: <b style="color:var(--item-text);">${item.correctAnswer}</b>
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

    // ── INITIALIZATION ────────────────────────────────────────────────────────
    generateQuestion();

    const quizInput = document.getElementById('answerInput');
    quizInput.addEventListener('input', function() {
      const start = this.selectionStart;
      const end = this.selectionEnd;
      this.value = this.value.toUpperCase();
      if (start !== null && end !== null) {
        this.setSelectionRange(start, end);
      }
    });
    quizInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleQuizAction();
    });

    document.addEventListener('DOMContentLoaded', () => {
      if (window.NST) {
        window.NST.injectTimeGreeting();
        updateQuizPtsBadge();
      }

      const histOverlay = document.getElementById('historyOverlay');
      if (histOverlay) {
        histOverlay.addEventListener('click', (e) => {
          if (e.target === histOverlay) closeHistoryModal();
        });
      }

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeHistoryModal();
        }
      });
    });

    if (document.readyState !== 'loading') {
      if (window.NST) {
        window.NST.injectTimeGreeting();
        updateQuizPtsBadge();
      }
    }
