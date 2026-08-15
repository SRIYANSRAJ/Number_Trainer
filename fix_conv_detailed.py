import re
with open("learning.html", "r") as f:
    content = f.read()

replacement = """
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
"""

content = re.sub(r'// Determine conversion steps\n.*?html \+= railBlock\("Step 2: Decimal to Target Base.*?</script>', replacement + '\n    container.innerHTML = html;\n  }\n}\n</script>', content, flags=re.DOTALL)

with open("learning.html", "w") as f:
    f.write(content)
