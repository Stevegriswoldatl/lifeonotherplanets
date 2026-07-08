// Life On Other Planets? — shared custom icon set (cyan line-art, matches the emblem).
// Two ways to use:
//   1) Static HTML:  <i class="ico" data-i="scan"></i>   (auto-filled on load)
//   2) In JS strings: LOPIcon('scan')  -> returns inline <svg> markup
// Icons inherit their container's text color via currentColor, and size to 1em.
(function () {
  var P = {
    scan:'<path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M20 16v2a2 2 0 0 1-2 2h-2"/><path d="M8 20H6a2 2 0 0 1-2-2v-2"/><path class="f" d="M12 8.4l1.2 2.4 2.4 1.2-2.4 1.2-1.2 2.4-1.2-2.4-2.4-1.2 2.4-1.2z"/>',
    galaxy:'<path d="M7.5 5.2C13 6 17.5 9.5 18.2 14.5"/><path d="M16.5 18.8C11 18 6.5 14.5 5.8 9.5"/><circle class="f" cx="12" cy="12" r="1.6"/>',
    atlas:'<path class="f" d="M12 3.5c.5 5 2.9 7.5 8 8-5.1.5-7.5 3-8 8-.5-5-2.9-7.5-8-8 5.1-.5 7.5-3 8-8z"/>',
    constellation:'<path d="M6 16l4-8 5 5 3-7"/><circle class="f" cx="6" cy="16" r="1.5"/><circle class="f" cx="10" cy="8" r="1.5"/><circle class="f" cx="15" cy="13" r="1.5"/><circle class="f" cx="18" cy="6" r="1.5"/>',
    sound:'<path d="M4 9.5h3l4-3v11l-4-3H4z"/><path d="M15.5 9.5a4 4 0 0 1 0 5"/><path d="M18 7.5a7 7 0 0 1 0 9"/>',
    mute:'<path d="M4 9.5h3l4-3v11l-4-3H4z"/><path d="M15.5 9.5l4 5"/><path d="M19.5 9.5l-4 5"/>',
    planet:'<circle cx="12" cy="12" r="4.3"/><ellipse cx="12" cy="12" rx="9" ry="3.3" transform="rotate(-22 12 12)"/>',
    notplanet:'<circle cx="12" cy="12" r="8"/><path d="M6.5 6.5l11 11"/>',
    unsure:'<circle cx="12" cy="12" r="8.4"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.6v.4"/><circle class="f" cx="12" cy="16.6" r="1"/>',
    target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle class="f" cx="12" cy="12" r="1.4"/>',
    trophy:'<path d="M8 5h8v3.5a4 4 0 0 1-8 0z"/><path d="M8 6.5H6a2 2 0 0 0 0 4h.5"/><path d="M16 6.5h2a2 2 0 0 1 0 4h-.5"/><path d="M12 12.5V16"/><path d="M9 19h6l-1-3h-4z"/>',
    share:'<path d="M8.5 11l7-4"/><path d="M8.5 13l7 4"/><circle cx="6" cy="12" r="2.3"/><circle cx="17" cy="6" r="2.3"/><circle cx="17" cy="18" r="2.3"/>',
    lock:'<rect x="5.5" y="10.5" width="13" height="8.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><circle class="f" cx="12" cy="14.5" r="1.3"/>',
    signal:'<path d="M12 20V11"/><path d="M9 20h6"/><path d="M8 9a5.5 5.5 0 0 1 8 0"/><path d="M5.5 6.5a9 9 0 0 1 13 0"/>',
    candidate:'<ellipse cx="12" cy="14" rx="8" ry="3"/><path d="M7.5 12.6a5 5 0 0 1 9 0"/><circle class="f" cx="8.5" cy="14" r=".9"/><circle class="f" cx="12" cy="15" r=".9"/><circle class="f" cx="15.5" cy="14" r=".9"/>',
    check:'<circle cx="12" cy="12" r="8.2"/><path d="M8 12l2.8 2.8L16 9.4"/>',
    graduate:'<path d="M12 5l9 4-9 4-9-4z"/><path d="M7 11v4c0 1.5 2.2 2.6 5 2.6s5-1.1 5-2.6v-4"/><path d="M21 9v4"/>',
    satellite:'<rect x="9.5" y="4" width="5" height="4" rx="1.4" transform="rotate(45 12 6)"/><path d="M5 13l3.5-3.5"/><path d="M2.5 9.5L6 6"/><path d="M19 13l-3.5-3.5"/><path d="M21.5 9.5L18 6"/><path d="M12 9v9"/><path d="M9 20a3 3 0 0 1 6 0"/>',
    star:'<path class="f" d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z"/>',
    help:'<circle cx="12" cy="12" r="8.4"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.6v.4"/><circle class="f" cx="12" cy="16.6" r="1"/>',
    arrow:'<path d="M5 12h13"/><path d="M13 6l6 6-6 6"/>',
    fire:'<path d="M12 3.5c3 3 4.5 5.5 4.5 8.5a4.5 4.5 0 0 1-9 0c0-1.2.4-2.2 1-3 .2 1 .8 1.6 1.6 1.8C9.4 8.2 10.4 5.8 12 3.5z"/>',
    flag:'<path d="M6 20V4"/><path d="M6 5h10l-2 3 2 3H6"/>',
    together:'<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>',
    eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>',
    menu:'<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    reward:'<path class="f" d="M12 3.5l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5L6.8 8.7l5-.6z"/>'
  };
  function svg(name, cls) {
    var p = P[name]; if (!p) return '';
    return '<svg class="lopico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>';
  }
  function apply(root) {
    var els = (root || document).querySelectorAll('i.ico[data-i]:not([data-done])');
    Array.prototype.forEach.call(els, function (el) { el.innerHTML = svg(el.getAttribute('data-i')); el.setAttribute('data-done', '1'); });
  }
  window.LOPIcon = svg;
  window.LOPIconApply = apply;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { apply(); });
  else apply();
})();
