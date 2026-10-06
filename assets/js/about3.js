/* About v3: count-up stats, hero PR checks loop, "our team today" ribbon (team section), scroll-lit story text, principle tabs with live windows,
   process line that fills on scroll. Every widget starts in its finished state, so the page
   reads fine without JS, with reduced motion, and in screenshots. */
(function(){
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function onView(el, cb, margin){
    if (!('IntersectionObserver' in window)) return cb();
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) { io.disconnect(); cb(); } }); }, { rootMargin: margin || '0px 0px -15% 0px' });
    io.observe(el);
  }

  // 1. count-up: <b data-count="1.2" data-suffix="M+">1.2M+</b>
  if (!reduce) [].forEach.call(document.querySelectorAll('[data-count]'), function(b){
    var end = parseFloat(b.getAttribute('data-count')), suf = b.getAttribute('data-suffix') || '', dec = (String(end).split('.')[1] || '').length;
    onView(b, function(){
      var t0 = performance.now(), d = 1400;
      (function step(t){ var k = Math.min(1, (t - t0) / d), v = end * (1 - Math.pow(1 - k, 3)); b.textContent = v.toFixed(dec) + suf; if (k < 1) requestAnimationFrame(step); })(t0);
    });
  });

  // 2. hero ribbon: each city's 9 am to 6 pm on a 24h UTC axis, live local time, and a "Now" line at the real time
  [].forEach.call(document.querySelectorAll('[data-ribbon]'), function(r){
    function offsetHours(tz, d){
      var p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d), o = {};
      p.forEach(function(x){ o[x.type] = x.value; });
      var local = Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute);
      return Math.round((local - d.getTime()) / 6e4) / 60;
    }
    function paint(){
      var now = new Date(), k = (now.getUTCHours() + now.getUTCMinutes() / 60) / 24;
      r.querySelector('.ab3-rib__track').style.setProperty('--k', k);
      [].forEach.call(r.querySelectorAll('.ab3-rib__row'), function(row){
        var tz = row.getAttribute('data-tz'), off = offsetHours(tz, now), start = ((9 - off) % 24 + 24) % 24, bar = row.querySelector('.ab3-rib__bar');
        var main = bar.querySelector('i'), wrap = bar.querySelector('.ab3-rib__wrap');
        var over = start + 9 - 24;   // part of the working day that wraps past 24:00 UTC
        main.style.left = (start / 24 * 100) + '%'; main.style.width = (Math.min(9, 24 - start) / 24 * 100) + '%';
        main.classList.toggle('is-split', over > 0);
        if (over > 0) { if (!wrap) { wrap = document.createElement('b'); wrap.className = 'ab3-rib__wrap'; bar.appendChild(wrap); } wrap.style.width = (over / 24 * 100) + '%'; }
        else if (wrap) wrap.remove();
        row.querySelector('time').textContent = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(now);
        var h = (now.getUTCHours() + now.getUTCMinutes() / 60 + off + 24) % 24;
        row.classList.toggle('is-awake', h >= 9 && h < 18);
      });
    }
    paint(); setInterval(paint, 30000);
  });

  // hero B: the pull request's CI checks run one at a time, then all pass, then the run starts again
  if (!reduce) [].forEach.call(document.querySelectorAll('[data-checks]'), function(ul){
    var li = [].slice.call(ul.children), i = 0;
    setInterval(function(){ li.forEach(function(x, k){ x.classList.toggle('is-run', k === i); }); i = (i + 1) % (li.length + 2); }, 900);
  });

  // 3. story: words go from grey to dark as the paragraph scrolls up the screen
  var lit = [].slice.call(document.querySelectorAll('.ab3-lit'));
  if (lit.length && !reduce) {
    var words = [];
    lit.forEach(function(p){
      p.innerHTML = p.textContent.trim().split(/\s+/).map(function(w){ return '<span class="w">' + w + '</span>'; }).join(' ');
      words = words.concat([].slice.call(p.querySelectorAll('.w')));
    });
    var box = lit[0].parentNode;
    function light(){
      var r = box.getBoundingClientRect(), vh = innerHeight;
      var k = Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (r.height + vh * 0.25)));
      var n = Math.round(words.length * k);
      words.forEach(function(w, j){ w.classList.toggle('is-dim', j >= n); });
    }
    addEventListener('scroll', light, { passive: true }); addEventListener('resize', light); light();
  }

  // 4. principle tabs: auto-advance with a progress line, pause on hover, click to pick
  [].forEach.call(document.querySelectorAll('[data-ab3-tabs]'), function(root){
    var tabs = [].slice.call(root.querySelectorAll('.ab3-tab')), panes = [].slice.call(root.querySelectorAll('.ab3-pane')), list = root.querySelector('.ab3-tabs');
    var cur = 0, timer, dur = 5500;
    function show(n){
      cur = n;
      tabs.forEach(function(t, k){ t.classList.toggle('is-on', k === n); t.setAttribute('aria-selected', k === n); var i = t.querySelector('.ab3-tab__prog i'); if (i) { i.style.animation = 'none'; i.offsetWidth; i.style.animation = ''; } });
      panes.forEach(function(p, k){ p.classList.toggle('is-on', k === n); });
      var chat = panes[n].querySelector('.ab3-chat');
      if (chat && !reduce) { chat.classList.remove('is-typed'); setTimeout(function(){ chat.classList.add('is-typed'); }, 1400); }
      clearTimeout(timer); if (!reduce) timer = setTimeout(next, dur);
    }
    function next(){ if (list.classList.contains('is-held')) { timer = setTimeout(next, 400); return; } show((cur + 1) % tabs.length); }
    tabs.forEach(function(t, k){ t.addEventListener('click', function(){ show(k); }); });
    root.addEventListener('mouseenter', function(){ list.classList.add('is-held'); });
    root.addEventListener('mouseleave', function(){ list.classList.remove('is-held'); });
    show(0);
  });

  // 5. process: the line fills as the section scrolls; each step lights up when the line reaches it
  [].forEach.call(document.querySelectorAll('[data-ab3-steps]'), function(root){
    var line = root.querySelector('.ab3-steps__track i'), steps = [].slice.call(root.querySelectorAll('.ab3-step'));
    if (reduce) return;
    function fill(){
      var r = root.getBoundingClientRect(), vh = innerHeight;
      var k = Math.max(0, Math.min(1, (vh * 0.8 - r.top) / (vh * 0.55)));
      line.style.setProperty('--fill', (k * 100) + '%');
      steps.forEach(function(s, j){ s.classList.toggle('is-lit', k >= (j + 0.5) / steps.length); });
    }
    addEventListener('scroll', fill, { passive: true }); addEventListener('resize', fill); fill();
  });

})();
