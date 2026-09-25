(function() {
  var pid = 'preloader';
  var el = document.getElementById(pid);
  if (!el) return;

  var svg = el.querySelector('.preloader-svg');

  setTimeout(function() {
    if (svg && !el.classList.contains('hidden')) {
      svg.classList.add('animate');
    }
  }, 500);

  // Hero bg — always use logo-elements variant
  (function() {
    var container = document.querySelector('.hero-bg-svg svg');
    if (!container) return;

    container.innerHTML = '';
    var ns = 'http://www.w3.org/2000/svg';
    var defs = [
        // Large logo rects - stroke only, no fill
        { tag: 'rect', attrs: { x: '60', y: '40', width: '80', height: '80', rx: '10', stroke: 'rgba(255,255,255,0.3)', 'stroke-width': '2', fill: 'none', transform: 'rotate(-5 100 80)' }},
        { tag: 'rect', attrs: { x: '540', y: '30', width: '90', height: '90', rx: '10', stroke: 'rgba(255,255,255,0.25)', 'stroke-width': '2', fill: 'none', transform: 'rotate(10 585 75)' }},
        { tag: 'rect', attrs: { x: '40', y: '450', width: '85', height: '85', rx: '10', stroke: 'rgba(255,255,255,0.28)', 'stroke-width': '2', fill: 'none', transform: 'rotate(-8 82 492)' }},
        { tag: 'rect', attrs: { x: '620', y: '470', width: '75', height: '75', rx: '10', stroke: 'rgba(255,255,255,0.32)', 'stroke-width': '2', fill: 'none', transform: 'rotate(12 657 507)' }},
        // Smaller rects - stroke only
        { tag: 'rect', attrs: { x: '250', y: '80', width: '30', height: '30', rx: '5', stroke: 'rgba(255,255,255,0.15)', 'stroke-width': '2', fill: 'none', transform: 'rotate(45 265 95)' }},
        { tag: 'rect', attrs: { x: '520', y: '280', width: '25', height: '25', rx: '4', stroke: 'rgba(255,255,255,0.12)', 'stroke-width': '2', fill: 'none', transform: 'rotate(-30 532 292)' }},
        { tag: 'rect', attrs: { x: '260', y: '480', width: '28', height: '28', rx: '4', stroke: 'rgba(255,255,255,0.14)', 'stroke-width': '2', fill: 'none', transform: 'rotate(20 274 494)' }},
        // Main center point - very subtle
        { tag: 'circle', attrs: { cx: '400', cy: '300', r: '3', fill: 'none', stroke: 'rgba(255,255,255,0.2)', 'stroke-width': '2' }},
        // Subtle concentric circles
        { tag: 'circle', attrs: { cx: '400', cy: '300', r: '140', stroke: 'rgba(255,255,255,0.1)', 'stroke-width': '1.5', fill: 'none' }},
        { tag: 'circle', attrs: { cx: '400', cy: '300', r: '220', stroke: 'rgba(255,255,255,0.06)', 'stroke-width': '1.5', fill: 'none' }},
        // Diagonal crossing lines
        { tag: 'line', attrs: { x1: '100', y1: '80', x2: '700', y2: '520', stroke: 'rgba(255,255,255,0.06)', 'stroke-width': '1.5' }},
        { tag: 'line', attrs: { x1: '700', y1: '80', x2: '100', y2: '520', stroke: 'rgba(255,255,255,0.06)', 'stroke-width': '1.5' }},
        // Small dots as open circles
        { tag: 'circle', attrs: { cx: '140', cy: '180', r: '3', fill: 'none', stroke: 'rgba(255,255,255,0.15)', 'stroke-width': '1.5' }},
        { tag: 'circle', attrs: { cx: '660', cy: '420', r: '4', fill: 'none', stroke: 'rgba(255,255,255,0.12)', 'stroke-width': '1.5' }},
        { tag: 'circle', attrs: { cx: '300', cy: '520', r: '2', fill: 'none', stroke: 'rgba(255,255,255,0.1)', 'stroke-width': '1.5' }},
        { tag: 'circle', attrs: { cx: '500', cy: '80', r: '3', fill: 'none', stroke: 'rgba(255,255,255,0.12)', 'stroke-width': '1.5' }},
      ];
      defs.forEach(function(d) {
        var el = document.createElementNS(ns, d.tag);
        for (var k in d.attrs) el.setAttribute(k, d.attrs[k]);
        container.appendChild(el);
      });
  })();
})();
