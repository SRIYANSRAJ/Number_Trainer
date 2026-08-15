import re
with open("learning.html", "r") as f:
    content = f.read()

def replace_add_explain(match):
    return """function computeExplain(stepIdx) {
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
  }"""

content = re.sub(r'function computeExplain\(stepIdx\)\s*\{.*?return `Every column is done.*?\}\s*\}', replace_add_explain, content, flags=re.DOTALL)

def replace_sub_explain(match):
    return """function computeExplain(stepIdx) {
    const colArrIdx = len - 1 - stepIdx;
    const c = cols[colArrIdx];
    if (c.isPoint) return "Radix point column. Just bring it straight down.";
    if (!c.borrowIn) {
      if (c.borrowOut) return `${valDigit(c.aOrig)} is smaller than ${valDigit(c.b)}, so this column can't subtract directly — it borrows one full group of ${base} from the column to its left, becoming ${c.aOrig + base}. ${c.aOrig + base} − ${valDigit(c.b)} = ${valDigit(c.resultDigit)}.`;
      return `${valDigit(c.aOrig)} − ${valDigit(c.b)} = ${valDigit(c.resultDigit)}. No borrowing needed — the top digit was already big enough.`;
    }
    let txt = `This column previously lent a group away, so its top digit ${valDigit(c.aOrig)} dropped to ${c.aOrig - 1}. `;
    if (c.borrowOut) return txt + `Now ${c.aOrig - 1} is smaller than ${valDigit(c.b)}, so it must borrow from its left neighbor, becoming ${c.aOrig - 1 + base}. ${c.aOrig - 1 + base} − ${valDigit(c.b)} = ${valDigit(c.resultDigit)}.`;
    return txt + `${c.aOrig - 1} − ${valDigit(c.b)} = ${valDigit(c.resultDigit)}.`;
  }"""

content = re.sub(r'function computeExplain\(stepIdx\)\s*\{.*?return txt \+ `\$\{c\.aOrig - 1\}.*?\}\s*\}', replace_sub_explain, content, flags=re.DOTALL)

with open("learning.html", "w") as f:
    f.write(content)
