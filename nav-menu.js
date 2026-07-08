// Shared responsive top-nav: puts the emblem on the brand and collapses the other
// links into a slide-in hamburger menu on small screens. Adapts to each page's
// existing <nav> markup — no per-page restructuring needed. Loaded with `defer`.
(function () {
  function enhance() {
    var nav = document.querySelector("nav");
    if (!nav || nav.dataset.enhanced) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll("a"));
    if (links.length < 2) return;                 // nothing to collapse
    nav.dataset.enhanced = "1";
    nav.classList.add("nav-enhanced");

    // brand = first link; give it the emblem
    var brand = links[0];
    brand.classList.add("nav-brand");
    if (!brand.querySelector("img.nav-emblem")) {
      var img = document.createElement("img");
      img.className = "nav-emblem";
      img.src = "assets/emblem.png";
      img.alt = "";
      img.width = 26; img.height = 26;
      brand.insertBefore(img, brand.firstChild);
    }

    // wrap the remaining links so we can slide them in/out
    var wrap = document.createElement("div");
    wrap.className = "nav-links";
    links.slice(1).forEach(function (a) { wrap.appendChild(a); });

    var burger = document.createElement("button");
    burger.className = "nav-burger";
    burger.type = "button";
    burger.setAttribute("aria-label", "Menu");
    burger.setAttribute("aria-expanded", "false");
    burger.innerHTML = "☰";

    nav.appendChild(burger);
    nav.appendChild(wrap);

    function setOpen(open) {
      nav.classList.toggle("nav-open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.innerHTML = open ? "✕" : "☰";
    }
    burger.addEventListener("click", function (e) { e.stopPropagation(); setOpen(!nav.classList.contains("nav-open")); });
    wrap.addEventListener("click", function (e) { if (e.target.tagName === "A") setOpen(false); });
    document.addEventListener("click", function (e) { if (nav.classList.contains("nav-open") && !nav.contains(e.target)) setOpen(false); });
    window.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enhance);
  else enhance();
})();
