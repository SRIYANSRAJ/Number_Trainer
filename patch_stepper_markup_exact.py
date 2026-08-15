import re
with open("learning.html", "r") as f:
    content = f.read()

def replace_add_markup(match):
    return """function additionStepperMarkup(aStr, bStr, base, revealed) {
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
}"""

content = re.sub(r'function additionStepperMarkup\(.*?\)\s*\{.*?(?=\nfunction wireAdditionStepper)', replace_add_markup, content, flags=re.DOTALL)

def replace_sub_markup(match):
    return """function subtractionStepperMarkup(aStr, bStr, base, revealed) {
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
}"""

content = re.sub(r'function subtractionStepperMarkup\(.*?\)\s*\{.*?(?=\nfunction wireSubtractionStepper)', replace_sub_markup, content, flags=re.DOTALL)

with open("learning.html", "w") as f:
    f.write(content)
