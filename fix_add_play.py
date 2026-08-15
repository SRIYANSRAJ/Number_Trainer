import re
with open("learning.html", "r") as f:
    content = f.read()

new_funcs = """  function pause() {
    playing = false;
    clearInterval(playInterval);
    render();
  }
  function play() {
    if (revealed >= totalSteps) {
      revealed = 0;
    }
    playing = true;
    render();
    playInterval = setInterval(() => {
      if (revealed < totalSteps) {
        lastExplain = computeExplain(revealed);
        revealed++;
        render();
      } else {
        pause();
      }
    }, 1500);
  }"""

content = re.sub(
    r'(return `Every column is done.*?\}\s*)\}\s*function render\(\)',
    r'\1\n' + new_funcs + r'\n  function render()',
    content,
    flags=re.DOTALL
)

with open("learning.html", "w") as f:
    f.write(content)
