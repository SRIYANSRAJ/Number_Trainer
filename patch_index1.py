import re
with open("index1.html", "r") as f:
    content = f.read()

# Replace openAiModal function
new_open_ai_modal = """function openAiModal() {
  const q = currentQuestion();
  if (!q) return;
  const lenA = q.a.replace('.', '').length;
  const lenB = q.b.replace('.', '').length;
  if (lenA > 8 || lenB > 8) {
    alert("Detailed visual animation is only available for questions up to 8 digits.");
    return;
  }
  window.location.href = `learning.html?detailed=true&mode=arithmetic&op=${q.op}&base=${q.base}&a=${encodeURIComponent(q.a)}&b=${encodeURIComponent(q.b)}`;
}"""

content = re.sub(r'function openAiModal\(\) \{.*?(?=\nfunction closeAiModal)', new_open_ai_modal + '\n', content, flags=re.DOTALL)

# Remove prefetch calls
content = re.sub(r'prefetchArithmeticAiSolution\(.*?\);?', '', content)

with open("index1.html", "w") as f:
    f.write(content)
