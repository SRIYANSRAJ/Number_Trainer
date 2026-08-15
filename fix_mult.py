import re
with open("learning.html", "r") as f:
    content = f.read()

# Let's remove ALL `renderMultiplicationLong` and `multRowHTML` and `multiplyLong` declarations and insert the new ones.

new_multiply = """function multiplyLong(mStr, nStr, base) {
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
"""

content = re.sub(r'function multiplyLong\(mStr.*?return html;\n\}(?=\nconst multState)', new_multiply, content, flags=re.DOTALL)
content = re.sub(r'function multiplyLong\(mStr.*?return html;\n\}', '', content, flags=re.DOTALL)
# Actually, wait. It's messed up now. I'll just use a more robust regex that finds all of them.

