/* Roue : dessin sur canvas et animation de rotation. */
window.BX = window.BX || {};

BX.wheel = (function () {
  var COLORS = ["#FFC93C", "#2DD4BF", "#FF5FA2", "#FF8A3D"];
  var TAU = Math.PI * 2;

  function create(canvas) {
    var w = { canvas: canvas, names: [], angle: 0, spinning: false };

    w.set = function (names) { w.names = names.slice(); w.draw(w.angle); };

    w.draw = function (angle) {
      var ctx = canvas.getContext("2d"), W = canvas.width, R = W / 2 - 10, n = w.names.length;
      ctx.clearRect(0, 0, W, W);
      if (!n) {
        ctx.beginPath(); ctx.arc(W / 2, W / 2, R, 0, TAU);
        ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fill(); return;
      }
      var seg = TAU / n;
      for (var i = 0; i < n; i++) {
        var a0 = angle + i * seg - Math.PI / 2, a1 = a0 + seg;
        ctx.beginPath(); ctx.moveTo(W / 2, W / 2); ctx.arc(W / 2, W / 2, R, a0, a1); ctx.closePath();
        ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fill();
        ctx.lineWidth = 6; ctx.strokeStyle = "#0B1230"; ctx.stroke();
        ctx.save(); ctx.translate(W / 2, W / 2); ctx.rotate(a0 + seg / 2);
        ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillStyle = "#0B1230";
        ctx.font = "800 " + (n > 5 ? 28 : 38) + "px 'Bricolage Grotesque','Arial Narrow',Arial,sans-serif";
        ctx.fillText(w.names[i], R - 36, 0, R * 0.62);
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(W / 2, W / 2, R, 0, TAU);
      ctx.lineWidth = 10; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.stroke();
    };

    // Fait tourner la roue pour que le segment `winIdx` s'arrête sous le pointeur (en haut)
    w.spin = function (winIdx, done) {
      var n = w.names.length; if (!n || w.spinning) return;
      var seg = TAU / n, jitter = (Math.random() - 0.5) * seg * 0.6;
      var base = (((-(winIdx + 0.5) * seg + jitter) % TAU) + TAU) % TAU;
      var cur = ((w.angle % TAU) + TAU) % TAU, delta = base - cur;
      if (delta < 0) delta += TAU;
      var from = w.angle, total = delta + TAU * 5, t0 = null;
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var dur = reduce ? 400 : 4600;
      w.spinning = true;
      function step(ts) {
        if (t0 === null) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 4);
        w.angle = from + total * e; w.draw(w.angle);
        if (k < 1) return requestAnimationFrame(step);
        w.spinning = false; done();
      }
      requestAnimationFrame(step);
    };
    return w;
  }

  return { create: create };
})();
