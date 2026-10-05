/* Confettis : un canvas plein écran qui se retire tout seul. */
window.BX = window.BX || {};

BX.confetti = function () {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var cv = document.createElement("canvas");
  cv.setAttribute("aria-hidden", "true");
  cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:50";
  document.body.appendChild(cv);
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  var ctx = cv.getContext("2d"), cols = ["#FFC93C", "#2DD4BF", "#FF5FA2", "#FF8A3D", "#FFFFFF"];
  var P = [];
  for (var i = 0; i < 180; i++) {
    var side = i % 2 ? 1 : -1;
    P.push({
      x: (side === 1 ? 0.1 : 0.9) * cv.width, y: cv.height * 0.85,
      vx: side * (4 + Math.random() * 9) * dpr, vy: -(10 + Math.random() * 14) * dpr,
      s: (6 + Math.random() * 8) * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      c: cols[i % cols.length]
    });
  }
  var t0 = null;
  (function frame(ts) {
    if (t0 === null) t0 = ts;
    var el = ts - t0;
    ctx.clearRect(0, 0, cv.width, cv.height);
    P.forEach(function (p) {
      p.vy += 0.38 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - el / 3600);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    });
    if (el < 3600) requestAnimationFrame(frame); else cv.remove();
  })(performance.now());
};
