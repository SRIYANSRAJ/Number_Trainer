import re
with open("learning.html", "r") as f:
    content = f.read()

new_addColumns = """function addColumns(aStr, bStr, base) {
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
}"""

content = re.sub(r'function addColumns\(.*?\).*?(?=\n// ---- Column subtraction)', new_addColumns + '\n', content, flags=re.DOTALL)

new_subColumns = """function subColumns(aStr, bStr, base) {
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
}"""

content = re.sub(r'function subColumns\(.*?\).*?(?=\nconst CORE_EXPORTS)', new_subColumns + '\n', content, flags=re.DOTALL)

with open("learning.html", "w") as f:
    f.write(content)
