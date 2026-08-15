import re
with open("learning.html", "r") as f:
    content = f.read()

def replace_sub_explain(match):
    return """function computeExplain(stepIdx) {
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
  }"""

# we match the specific block in subtraction stepper
content = re.sub(r'function computeExplain\(stepIdx\)\s*\{\s*const colArrIdx = len - 1 - stepIdx;.*?return txt;\s*\}', replace_sub_explain, content, flags=re.DOTALL)

with open("learning.html", "w") as f:
    f.write(content)
