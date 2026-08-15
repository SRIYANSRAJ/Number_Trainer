import re
with open("learning.html", "r") as f:
    content = f.read()

boot_str = """
function boot() {
  initGlobalDelegation();
  const params = new URLSearchParams(window.location.search);
  if (params.get("detailed") === "true") {
    registerPage("detailed-animation", renderDetailedAnimationPage, initDetailedAnimationPage);
    navigate("detailed-animation", { noScroll: true });
    return;
  }
  const mod = params.get("module") || window.location.hash.replace("#", "");
  navigate(PAGE_RENDERERS[mod] ? mod : "home", { noScroll: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
"""

content = content.replace("container.innerHTML = html;\n  }\n}", "container.innerHTML = html;\n  }\n}\n\n" + boot_str)

with open("learning.html", "w") as f:
    f.write(content)
