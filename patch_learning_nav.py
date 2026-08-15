import re
with open("learning.html", "r") as f:
    content = f.read()

# 1. Modify renderCurrentPage
new_renderCurrentPage = """function renderCurrentPage() {
  const p = PAGE_RENDERERS[STATE.page];
  if (!p) return "<p>Not found.</p>";
  
  const orderedPages = [];
  for (const group of NAV) {
    if (group.group === "Practice") continue;
    for (const item of group.items) {
      orderedPages.push({ id: item.id, label: item.label });
    }
  }

  const currentIndex = orderedPages.findIndex(item => item.id === STATE.page);
  let navHtml = '';
  
  if (STATE.page === "detailed-animation") {
    navHtml += `
      <div style="margin-top:40px; padding-top:24px; border-top:1px solid var(--border); text-align:center;">
        <button class="btn btn-primary" onclick="window.history.back()" style="padding:10px 20px;">← Back to Practice</button>
      </div>
    `;
  } else if (currentIndex !== -1 && orderedPages.length > 1) {
    const prev = currentIndex > 0 ? orderedPages[currentIndex - 1] : null;
    const next = currentIndex < orderedPages.length - 1 ? orderedPages[currentIndex + 1] : null;

    navHtml += `
      <div style="display:flex; justify-content:space-between; margin-top:40px; padding-top:24px; border-top:1px solid var(--border); gap:16px;">
        ${prev ? `<button class="btn btn-ghost" onclick="navigate('${prev.id}')" style="flex:1; justify-content:flex-start; text-align:left; max-width:50%;">
          <span style="font-size:12px; color:var(--item-subtext); display:block;">← Previous</span>
          <span style="font-size:14px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${prev.label}</span>
        </button>` : `<div style="flex:1"></div>`}
        ${next ? `<button class="btn btn-ghost" onclick="navigate('${next.id}')" style="flex:1; justify-content:flex-end; text-align:right; max-width:50%;">
          <span style="font-size:12px; color:var(--item-subtext); display:block;">Next →</span>
          <span style="font-size:14px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${next.label}</span>
        </button>` : `<div style="flex:1"></div>`}
      </div>
    `;
  }
  
  return p.render() + navHtml;
}"""

content = re.sub(r'function renderCurrentPage\(\) \{.*?(?=\nfunction renderApp)', new_renderCurrentPage + '\n', content, flags=re.DOTALL)

with open("learning.html", "w") as f:
    f.write(content)
