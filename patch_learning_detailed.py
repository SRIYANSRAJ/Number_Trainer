import re
with open("learning.html", "r") as f:
    content = f.read()

detailed_code = """
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
    if (fromBase !== 10 && toBase === 10) {
      // Base to Decimal
      html += railBlock("Expansion", "Multiply by place values", `Read each digit and multiply it by its positional weight in Base ${fromBase}.`, `
        <div style="text-align:center;">${sumBreakdownHTML(qStr, fromBase)}</div>
      `);
    } else if (fromBase === 10 && toBase !== 10) {
      // Decimal to Base
      const parts = qStr.split(".");
      const intPart = parseInt(parts[0], 10);
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
      html += railBlock("Step 1: Convert to Decimal", `Expand Base ${fromBase} to Decimal`, `First, bring ${qStr} into Base 10.`, `
        <div style="text-align:center;">${sumBreakdownHTML(qStr, fromBase)}</div>
      `);
      
      // Calculate decimal value
      const parts = qStr.split(".");
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
"""

content = content.replace("function boot() {", detailed_code + "\nfunction boot() {")

with open("learning.html", "w") as f:
    f.write(content)
