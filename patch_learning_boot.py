import re
with open("learning.html", "r") as f:
    content = f.read()

new_boot = """function boot() {
  initGlobalDelegation();
  const params = new URLSearchParams(window.location.search);
  if (params.get("detailed") === "true") {
    registerPage("detailed-animation", renderDetailedAnimationPage, initDetailedAnimationPage);
    navigate("detailed-animation", { noScroll: true });
    return;
  }
  const mod = params.get("module") || window.location.hash.replace("#", "");
  navigate(PAGE_RENDERERS[mod] ? mod : "home", { noScroll: true });
}"""
content = re.sub(r'function boot\(\) \{.*?(?=\nif \(document.readyState === "loading")', new_boot + '\n', content, flags=re.DOTALL)

with open("learning.html", "w") as f:
    f.write(content)
