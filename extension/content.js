// CodePush content script — detects the solved problem on GeeksforGeeks,
// HackerRank and CodeChef pages and adds a floating "Push to GitHub" button.
(() => {
  "use strict";

  const PLATFORMS = [
    { id: "GFG", label: "GeeksforGeeks", folder: "GeeksforGeeks", match: "geeksforgeeks.org" },
    { id: "HackerRank", label: "HackerRank", folder: "HackerRank", match: "hackerrank.com" },
    { id: "CodeChef", label: "CodeChef", folder: "CodeChef", match: "codechef.com" },
  ];

  const PROBLEM_URL = /\/(problems|challenges|contests|submit|explore)\//i;

  function currentPlatform() {
    const host = location.hostname;
    for (const p of PLATFORMS) if (host.includes(p.match)) return p;
    return null;
  }

  function titleFromSlug(slug) {
    return (slug || "")
      .replace(/[-_]+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function getTitle() {
    let t = "";
    const h1 = document.querySelector("h1");
    if (h1) t = h1.textContent.trim();
    if (!t || t.length > 80) {
      let m = location.pathname.match(/\/problems\/([^/?#]+)/);
      if (m) t = titleFromSlug(m[1]);
      if (!t) {
        m = location.pathname.match(/\/challenges\/([^/?#]+)/);
        if (m) t = titleFromSlug(m[1]);
      }
    }
    if (!t) {
      t = document.title
        .replace(/\s*[|·—-]\s*(GeeksforGeeks|HackerRank|CodeChef).*$/i, "")
        .trim();
    }
    return t || "Untitled problem";
  }

  function getDifficulty() {
    const words = ["school", "basic", "easy", "medium", "hard", "expert"];
    const nodes = document.querySelectorAll(
      '[class*="difficulty" i], [class*="level" i], [class*="tag" i], [class*="badge" i]'
    );
    for (const el of nodes) {
      const t = (el.textContent || "").trim().toLowerCase();
      if (words.includes(t)) return t.charAt(0).toUpperCase() + t.slice(1);
    }
    return "";
  }

  function matchLang(t) {
    const s = (t || "").toLowerCase();
    if (s.includes("c++") || s === "cpp" || s.includes("c++src")) return "cpp";
    if (s.includes("python")) return "python3";
    if (s.includes("javascript") || s.includes("node")) return "javascript";
    if (s.includes("typescript")) return "typescript";
    if (s.includes("c#") || s.includes("csharp")) return "c#";
    if (s.includes("java")) return "java";
    if (s.includes("kotlin")) return "kotlin";
    if (s.includes("ruby")) return "ruby";
    if (s.includes("swift")) return "swift";
    if (s.includes("sql")) return "sql";
    if (s.includes("golang") || s === "go") return "go";
    if (s.includes("rust")) return "rust";
    if (s.includes("php")) return "php";
    if (s.includes("dart")) return "dart";
    if (s.includes("scala")) return "scala";
    if (s === "c" || s === "text/x-csrc" || s === "c_cpp") return "c";
    return "";
  }

  // Last-resort: ask the editor itself which language it is set to.
  // C and C++ share the c_cpp/C-like mode, so sniff the code text.
  function languageFromEditors(code) {
    try {
      if (window.ace) {
        const el = document.querySelector(".ace_editor");
        if (el) {
          const m = matchLang(String(window.ace.edit(el).session.getMode().$id).replace(/^ace\/mode\//, ""));
          if (m) return m;
        }
      }
      const cm5 = document.querySelector(".CodeMirror");
      if (cm5 && cm5.CodeMirror) {
        const mode = cm5.CodeMirror.getOption("mode");
        const m = matchLang(typeof mode === "string" ? mode : (mode && mode.name) || "");
        if (m) return m;
      }
      if (window.monaco && typeof window.monaco.editor.getEditors === "function") {
        const eds = window.monaco.editor.getEditors();
        if (eds && eds[0] && eds[0].getModel()) {
          const m = matchLang(eds[0].getModel().getLanguageId());
          if (m) return m;
        }
      }
      // Shared C/C++ mode — decide from the code itself.
      if (/\b(?:std::|cout|cin|endl|#include\s*<iostream>|class\s+\w+\s*{)/.test(code)) return "cpp";
      if (/^#include/.test(code.trim())) return "c";
    } catch {}
    return "";
  }

  function getLanguage() {
    const nodes = document.querySelectorAll(
      'select option:checked, [role="combobox"], [class*="language" i], [class*="lang-select" i], [data-testid*="language" i]'
    );
    for (const el of nodes) {
      const raw =
        el instanceof HTMLOptionElement ? el.textContent : el.value || el.textContent;
      const t = (raw || "").trim();
      if (!t || t.length > 40) continue;
      const m = matchLang(t);
      if (m) return m;
    }
    return languageFromEditors(extractCode());
  }

  // Best-effort code extraction across CodeMirror 5/6, Ace, Monaco and plain textareas.
  function extractCode() {
    try {
      const cm5 = document.querySelector(".CodeMirror");
      if (cm5 && cm5.CodeMirror && typeof cm5.CodeMirror.getValue === "function") {
        const v = cm5.CodeMirror.getValue();
        if (v && v.trim()) return v;
      }
      if (window.editor && typeof window.editor.getValue === "function") {
        const v = window.editor.getValue();
        if (v && v.trim()) return v;
      }
      const aceEl = document.querySelector(".ace_editor");
      if (aceEl && window.ace) {
        const v = window.ace.edit(aceEl).getValue();
        if (v && v.trim()) return v;
      }
      if (window.monaco && typeof window.monaco.editor.getEditors === "function") {
        const eds = window.monaco.editor.getEditors();
        if (eds && eds.length) {
          const v = eds[0].getValue();
          if (v && v.trim()) return v;
        }
      }
      const cm6 = document.querySelector(".cm-editor .cm-content");
      if (cm6 && cm6.innerText && cm6.innerText.trim()) return cm6.innerText;
      const ta = document.querySelector("textarea");
      if (ta && ta.value && ta.value.trim()) return ta.value;
    } catch {}
    return "";
  }

  function getProblem() {
    const platform = currentPlatform();
    if (!platform) return null;
    return {
      platform: platform.id,
      platformLabel: platform.label,
      folder: platform.folder,
      title: getTitle(),
      url: location.href.split("#")[0],
      difficulty: getDifficulty(),
      language: getLanguage(),
      code: extractCode(),
    };
  }

  function toast(text, ok, link) {
    const el = document.createElement("div");
    el.style.cssText =
      "position:fixed;left:50%;transform:translateX(-50%);bottom:88px;z-index:2147483647;max-width:440px;padding:12px 18px;border-radius:10px;font:14px/1.4 system-ui,sans-serif;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.4);";
    el.style.background = ok ? "#238636" : "#b62324";
    el.textContent = text;
    if (link) {
      const a = document.createElement("a");
      a.href = link;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = " View on GitHub";
      a.style.color = "#fff";
      a.style.textDecoration = "underline";
      el.appendChild(a);
    }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 8000);
  }

  let btn = null;

  async function onPushClick() {
    const problem = getProblem();
    if (!problem) {
      toast("Open a problem page to push.", false);
      return;
    }
    const { ghToken, repoName, privateRepo } = await chrome.storage.local.get([
      "ghToken",
      "repoName",
      "privateRepo",
    ]);
    if (!ghToken) {
      toast("Connect your GitHub account from the CodePush panel first.", false);
      return;
    }
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = "Pushing…";
    const res = await chrome.runtime.sendMessage({
      type: "pushSolution",
      ...problem,
      repoName,
      privateRepo,
    });
    btn.disabled = false;
    btn.textContent = prev;
    if (res && res.ok) {
      toast(res.created ? "Pushed to GitHub! 🎉" : "Updated on GitHub.", true, res.htmlUrl);
    } else {
      toast((res && res.error) || "Push failed.", false);
    }
  }

  function mountButton() {
    if (document.getElementById("codepush-btn")) return;
    btn = document.createElement("button");
    btn.id = "codepush-btn";
    btn.type = "button";
    btn.textContent = "⬆ Push to GitHub";
    btn.title = "Push this solved problem to your GitHub repository (CodePush)";
    Object.assign(btn.style, {
      position: "fixed",
      right: "20px",
      bottom: "24px",
      zIndex: "2147483646",
      padding: "10px 18px",
      borderRadius: "999px",
      background: "#238636",
      color: "#fff",
      border: "none",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "pointer",
      boxShadow: "0 4px 14px rgba(0,0,0,.35)",
      fontFamily: "system-ui,sans-serif",
    });
    btn.addEventListener("click", onPushClick);
    document.body.appendChild(btn);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "getProblem") {
      sendResponse({ problem: getProblem() });
    }
  });

  // SPA-friendly: re-check periodically so the button appears after client-side navigation.
  setInterval(() => {
    if (currentPlatform() && PROBLEM_URL.test(location.pathname)) mountButton();
  }, 2000);
})();
