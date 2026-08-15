import re
with open("number-system-quiz.html", "r") as f:
    content = f.read()

# Replace openQuizAiModal function
new_open_ai_modal = """function openQuizAiModal() {
  if (!currentQ) return;
  const qStr = currentQ.qStr.replace('.', '');
  if (qStr.length > 8) {
    alert("Detailed visual animation is only available for questions up to 8 digits.");
    return;
  }
  window.location.href = `learning.html?detailed=true&mode=conversion&from=${currentQ.fB}&to=${currentQ.tB}&q=${encodeURIComponent(currentQ.qStr)}`;
}"""

content = re.sub(r'function openQuizAiModal\(\) \{.*?(?=\n\s*function closeQuizAiModal)', new_open_ai_modal + '\n', content, flags=re.DOTALL)

# Remove prefetch calls
content = re.sub(r'prefetchQuizAiSolution\(.*?\);?', '', content)

with open("number-system-quiz.html", "w") as f:
    f.write(content)
