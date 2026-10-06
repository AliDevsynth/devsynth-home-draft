/* Devsynth website: mobile menu, reveal on scroll, scroll story, contact tabs */
(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // mobile menu
  var h = document.querySelector('.dsh-header'), t = h && h.querySelector('.dsh-header__toggle');
  if (t) t.addEventListener('click', function(){ var o = h.classList.toggle('is-open'); t.setAttribute('aria-expanded', o); t.setAttribute('aria-label', o ? 'Close menu' : 'Open menu'); });

  // light / dark switch ([data-theme-toggle]): sets data-theme on <html> and remembers the choice.
  // The saved choice is applied by the inline script in <head>, before the page paints.
  var root = document.documentElement;
  [].forEach.call(document.querySelectorAll('[data-theme-toggle]'), function(btn){
    function sync(){ btn.setAttribute('aria-checked', root.getAttribute('data-theme') === 'dark'); }
    sync();
    btn.addEventListener('click', function(){
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      if (!reduce) { root.classList.add('ds-theme-anim'); clearTimeout(btn._t); btn._t = setTimeout(function(){ root.classList.remove('ds-theme-anim'); }, 400); }
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('ds-theme', next); } catch (e) {}
      sync();
    });
  });

  // reveal on scroll: [data-reveal] gets .is-in once it enters the viewport
  var reveals = [].slice.call(document.querySelectorAll('[data-reveal]'));
  if (reveals.length) {
    if (!('IntersectionObserver' in window) || reduce) reveals.forEach(function(el){ el.classList.add('is-in'); });
    else {
      var ro = new IntersectionObserver(function(entries){ entries.forEach(function(en){ if (en.isIntersecting || en.boundingClientRect.top < 0) { en.target.classList.add('is-in'); ro.unobserve(en.target); } }); }, { rootMargin: '0px 0px -10% 0px' });
      reveals.forEach(function(el){ ro.observe(el); });
      // backup: a cheap scroll check, in case the observer is throttled (background tabs, some in-app browsers)
      var pending = false;
      var check = function(){
        pending = false;
        var vh = window.innerHeight;
        reveals = reveals.filter(function(el){
          if (el.classList.contains('is-in')) return false;
          if (el.getBoundingClientRect().top < vh * 0.92) { el.classList.add('is-in'); return false; }
          return true;
        });
        if (!reveals.length) { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); }
      };
      var onScroll = function(){ if (!pending) { pending = true; setTimeout(check, 60); } };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      setTimeout(check, 300);
    }
  }

  // count-up for [data-count] numbers (runs once, when the element is first shown)
  function countUp(el){
    if (el.dataset.done || reduce) return; el.dataset.done = '1';
    var end = parseFloat(el.dataset.count), dec = parseInt(el.dataset.decimals || '0', 10), pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
    var start = null, dur = 1200;
    function frame(ts){ if (!start) start = ts; var p = Math.min((ts - start) / dur, 1); var v = end * (1 - Math.pow(1 - p, 3)); el.textContent = pre + v.toFixed(dec) + suf; if (p < 1) requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
  }

  // scroll story ([data-scrolly]): the step nearest the middle of the viewport is active; the pinned frame follows it
  [].forEach.call(document.querySelectorAll('[data-scrolly]'), function(root){
    var steps = [].slice.call(root.querySelectorAll('[data-step]')), frames = [].slice.call(root.querySelectorAll('[data-frame]'));
    var dots = [].slice.call(root.querySelectorAll('[data-goto]')), cur = root.querySelector('[data-current]'), fill = root.querySelector('.dsh-scrolly__fill');
    var active = -1, ticking = false;
    function setActive(i){
      if (i === active) return; active = i;
      steps.forEach(function(s, j){ s.classList.toggle('is-active', j === i); });
      frames.forEach(function(f, j){ f.classList.toggle('is-active', j === i); });
      dots.forEach(function(d, j){ d.classList.toggle('is-active', j === i); });
      if (cur) cur.textContent = (i + 1 < 10 ? '0' : '') + (i + 1);
      var f = frames[i]; if (f) [].forEach.call(f.querySelectorAll('[data-count]'), countUp);
      var s = steps[i]; if (s) [].forEach.call(s.querySelectorAll('[data-count]'), countUp);
    }
    function update(){
      ticking = false;
      var mid = window.innerHeight / 2, best = 0, bestD = Infinity;
      steps.forEach(function(s, j){ var r = s.getBoundingClientRect(); var d = Math.abs(r.top + r.height / 2 - mid); if (d < bestD) { bestD = d; best = j; } });
      setActive(best);
      if (fill && steps.length > 1) {
        var first = steps[0].getBoundingClientRect(), last = steps[steps.length - 1].getBoundingClientRect();
        var a = first.top + first.height / 2, b = last.top + last.height / 2;
        var p = Math.min(Math.max((mid - a) / (b - a), 0), 1);
        fill.style.setProperty('--fill', (p * 100).toFixed(1) + '%');
      }
    }
    function onScroll(){ if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    dots.forEach(function(d){ d.addEventListener('click', function(){ var s = steps[parseInt(d.dataset.goto, 10)]; if (!s) return; var r = s.getBoundingClientRect(); window.scrollTo({ top: window.scrollY + r.top + r.height / 2 - window.innerHeight / 2, behavior: reduce ? 'auto' : 'smooth' }); }); });
    update();
  });

  // hero sprint board ([data-board]): In progress -> Done, then the top To do -> In progress.
  // Done keeps at most two cards: the oldest fades out and comes back at the bottom of To do,
  // so the loop runs forever and no column ever grows.
  [].forEach.call(document.querySelectorAll('[data-board]'), function(board){
    if (reduce || !board.animate) return;
    var col = function(k){ return board.querySelector('[data-col="' + k + '"]'); };
    var todo = col('todo'), prog = col('prog'), done = col('done');
    var cards = function(c){ return [].slice.call(c.querySelectorAll('.ds-hero__tk')); };
    var EASE = 'cubic-bezier(.2,.7,.2,1)';

    // FLIP: measure every card, change the DOM, then animate each card from its old spot
    function flip(mutate){
      var all = [].slice.call(board.querySelectorAll('.ds-hero__tk'));
      var before = new Map(all.map(function(el){ return [el, el.getBoundingClientRect()]; }));
      mutate();
      all.forEach(function(el){
        var a = before.get(el), b = el.getBoundingClientRect();
        var dx = a.left - b.left, dy = a.top - b.top;
        if (dx || dy) done_(el.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 650, easing: EASE }), 650);
      });
    }
    // timers, not animation.finished: some browsers never resolve it in background tabs, which would stall the loop
    function fade(el, from, to, ms){ el.style.opacity = to; done_(el.animate([{ opacity: from }, { opacity: to }], { duration: ms, easing: 'ease' }), ms); return after(ms); }
    // end every animation on a timer too, so a card can never stay stuck mid-move or half-faded
    function done_(anim, ms){ setTimeout(function(){ try { anim.cancel(); } catch (e) {} }, ms + 60); }
    function after(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

    // the entrance animation (CSS) must be finished before cards move, otherwise it replays on re-insert
    function settle(el){ el.style.animation = 'none'; el.style.opacity = 1; }

    var step = 0, running = false, visible = true;
    function tick(){
      if (running || !visible || document.hidden) return;
      running = true;
      var job;
      if (step % 2 === 0) {
        // In progress -> Done (first make room in Done)
        var moving = cards(prog)[0];
        var old = cards(done);
        var recycle = old.length >= 2 ? old[old.length - 1] : null;
        job = (recycle ? fade(recycle, 1, 0, 300) : Promise.resolve()).then(function(){
          flip(function(){
            if (recycle) { recycle.style.opacity = 0; todo.appendChild(recycle); }
            if (moving) done.insertBefore(moving, done.querySelector('.ds-hero__tk'));
          });
          return recycle ? after(350).then(function(){ return fade(recycle, 0, 1, 400); }) : null;
        });
      } else {
        // top of To do -> In progress
        var next = cards(todo)[0];
        job = Promise.resolve(next && flip(function(){ prog.appendChild(next); }));
      }
      step++;
      job.then(function(){ running = false; }, function(){ running = false; });
      setTimeout(function(){ running = false; }, 2000); // safety net
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function(es){ visible = es[0].isIntersecting; }).observe(board);
    }
    setTimeout(function(){
      [].forEach.call(board.querySelectorAll('.ds-hero__tk'), settle);
      tick();
      setInterval(tick, 2600);
    }, 2600);
  });

  // "Two ways" cards ([data-ways]): no card is highlighted at rest. Hover or keyboard focus highlights one,
  // leaving the grid clears it; on touch screens a tap highlights the card.
  [].forEach.call(document.querySelectorAll('[data-ways]'), function(grid){
    var cards = [].slice.call(grid.querySelectorAll('.dsh-way'));
    function activate(card){ cards.forEach(function(c){ c.classList.toggle('is-active', c === card); }); }
    var canHover = window.matchMedia('(hover: hover)').matches;
    cards.forEach(function(card){
      if (canHover) card.addEventListener('mouseenter', function(){ activate(card); });
      card.addEventListener('focusin', function(){ activate(card); });
      card.addEventListener('click', function(e){ if (!e.target.closest('a')) activate(card); });
    });
    if (canHover) grid.addEventListener('mouseleave', function(){ if (!grid.contains(document.activeElement)) activate(null); });
    grid.addEventListener('focusout', function(e){ if (!grid.contains(e.relatedTarget)) activate(null); });
  });

  // "What we build" tabs ([data-svc]): click or arrow keys pick a service. The tabs also rotate on their own
  // every 6s; a timer fills the active tab's progress line (timers, not CSS animation events, which
  // background tabs and some browsers don't fire). Hover, keyboard focus, or being off screen pauses it.
  [].forEach.call(document.querySelectorAll('[data-svc]'), function(root){
    var tabs = [].slice.call(root.querySelectorAll('[role=tab]'));
    var cur = Math.max(0, tabs.findIndex(function(t){ return t.classList.contains('is-active'); }));
    // each tab is shown for 6s, or its data-dur (the AI tab stays longer so its chat demo can finish)
    var STEP = 100, elapsed = 0;
    function dur(){ return +tabs[cur].getAttribute('data-dur') || 6000; }
    function bar(){ var p = tabs[cur].querySelector('.dsh-svc__prog'); if (p) p.style.setProperty('--p', Math.min(elapsed / dur(), 1)); }
    function show(i, focus){
      if (tabs[cur]) { var old = tabs[cur].querySelector('.dsh-svc__prog'); if (old) old.style.setProperty('--p', 0); }
      cur = (i + tabs.length) % tabs.length; elapsed = 0;
      tabs.forEach(function(t, j){
        var on = j === cur, p = document.getElementById(t.getAttribute('aria-controls'));
        t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
        if (p) { p.classList.toggle('is-active', on); p.inert = !on; }
      });
      var t = tabs[cur];
      if (focus) t.focus();
      // keep the active chip in view on small screens, without moving the page
      var row = t.parentNode; if (row.scrollWidth > row.clientWidth) row.scrollTo({ left: t.offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' });
      root.dispatchEvent(new CustomEvent('svc:change'));
    }
    tabs.forEach(function(t, i){
      t.addEventListener('click', function(){ show(i); });
      t.addEventListener('keydown', function(e){
        var k = e.key, d = (k === 'ArrowDown' || k === 'ArrowRight') ? 1 : (k === 'ArrowUp' || k === 'ArrowLeft') ? -1 : 0;
        if (d) { e.preventDefault(); show(cur + d, true); }
      });
    });
    show(cur);
    if (reduce) return; // no auto-rotation for reduced motion
    root.classList.add('is-auto');
    var hover = false, focus = false, off = false;
    function sync(){ root.classList.toggle('is-paused', hover || focus || off || document.hidden); }
    if (window.matchMedia('(hover: hover)').matches) {
      root.addEventListener('mouseenter', function(){ hover = true; sync(); });
      root.addEventListener('mouseleave', function(){ hover = false; sync(); });
    }
    // only keyboard focus pauses; a mouse click or tap also focuses the tab, and that shouldn't stop the rotation for good
    root.addEventListener('focusin', function(){ try { focus = !!root.querySelector(':focus-visible'); } catch (e) { focus = true; } sync(); });
    root.addEventListener('focusout', function(e){ if (!root.contains(e.relatedTarget)) { focus = false; sync(); } });
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) new IntersectionObserver(function(es){ off = !es[0].isIntersecting; sync(); }, { threshold: .25 }).observe(root);
    setInterval(function(){
      if (root.classList.contains('is-paused')) return;
      elapsed += STEP;
      if (elapsed >= dur()) show(cur + 1); else bar();
    }, STEP);
  });

  // AI chat demo ([data-chat]): a mock cursor points at a source, clicks the message box, types the next
  // question, sends it; a typing bubble turns into the answer; then it scrolls the chat up and back down.
  // Runs only while its tab is open and on screen; timers only (no rAF), so it never stalls in background tabs.
  [].forEach.call(document.querySelectorAll('[data-chat]'), function(win){
    if (reduce) return; // reduced motion: the full conversation stays as static markup
    var view = win.querySelector('.dsh-chat__view'), list = win.querySelector('.dsh-chat__list');
    var input = win.querySelector('.dsh-chat__input'), typed = win.querySelector('.dsh-chat__typed');
    var send = win.querySelector('.dsh-chat__send'), cur = win.querySelector('.dsh-chat__cursor'), sb = win.querySelector('.dsh-chat__scroll');
    var next = [].slice.call(list.querySelectorAll('[data-chat-next]'));
    var question = next[0].textContent, rest = next.slice(1).map(function(el){ return el.outerHTML; });
    next.forEach(function(el){ el.remove(); });
    var start = list.innerHTML, panel = win.closest('.dsh-svc__panel'), tabs = win.closest('[data-svc]');
    var timers = [], offset = 0, running = false, onScreen = false;
    function at(ms, fn){ timers.push(setTimeout(fn, ms)); }
    function pt(el, fx, fy){ var r = el.getBoundingClientRect(), w = win.getBoundingClientRect(); return [r.left - w.left + r.width * (fx == null ? .5 : fx), r.top - w.top + r.height * (fy == null ? .5 : fy)]; }
    function move(el, fx, fy){ var p = pt(el, fx, fy); cur.style.transform = 'translate(' + p[0] + 'px,' + p[1] + 'px)'; }
    function click(){ cur.classList.remove('is-click'); void cur.offsetWidth; cur.classList.add('is-click'); }
    function scrollTo(y){
      var vh = view.clientHeight, lh = list.scrollHeight, max = Math.max(0, lh - vh);
      offset = Math.min(Math.max(y, 0), max); list.style.transform = 'translateY(' + (-offset) + 'px)';
      if (max) { var th = Math.max(30, vh * vh / lh); sb.style.height = th + 'px'; sb.style.top = (offset / max) * (vh - th) + 'px'; }
    }
    function add(html){ var d = document.createElement('div'); d.innerHTML = html.trim(); var el = d.firstChild; el.removeAttribute('data-chat-next'); el.classList.add('is-new'); list.appendChild(el); scrollTo(1e6); return el; }
    function reset(){
      timers.forEach(clearTimeout); timers = [];
      list.innerHTML = start; list.style.transform = ''; offset = 0;
      typed.textContent = ''; input.classList.remove('is-focus', 'has-text');
      cur.style.opacity = 0; sb.style.opacity = 0; cur.classList.remove('is-click');
    }
    function play(){
      reset();
      var chip = list.querySelector('.dsh-ui__src i');
      cur.style.transition = 'none'; cur.style.transform = 'translate(' + (win.clientWidth - 40) + 'px,' + (win.clientHeight - 20) + 'px)'; void cur.offsetWidth; cur.style.transition = '';
      at(300, function(){ cur.style.opacity = 1; move(chip, .45, .7); });
      at(1250, function(){ chip.classList.add('is-hot'); });
      at(2300, function(){ chip.classList.remove('is-hot'); move(input, .35, .6); });
      at(3150, function(){
        click(); input.classList.add('is-focus');
        var n = 0; (function key(){ typed.textContent = question.slice(0, ++n); input.classList.add('has-text'); if (n < question.length) at(42, key); })();
      });
      at(4700, function(){ move(send, .5, .6); });
      at(5450, function(){
        click(); send.classList.add('is-press'); at(160, function(){ send.classList.remove('is-press'); });
        typed.textContent = ''; input.classList.remove('has-text', 'is-focus');
        add('<div class="dsh-ui__bub dsh-ui__bub--me">' + question + '</div>');
      });
      var dots;
      at(6100, function(){ add(rest[0]); dots = add('<div class="dsh-ui__bub dsh-chat__dots"><b></b><b></b><b></b></div>'); });
      at(7400, function(){ if (dots) dots.remove(); add(rest[1]); });
      at(8300, function(){ move(view, .62, .45); });
      at(9100, function(){ sb.style.opacity = 1; scrollTo(0); });
      at(10500, function(){ scrollTo(1e6); });
      at(11600, function(){ sb.style.opacity = 0; cur.style.opacity = 0; });
      at(12600, play); // loop while the tab stays open (e.g. while the user hovers the section)
    }
    function sync(){
      var go = onScreen && !document.hidden && (!panel || panel.classList.contains('is-active'));
      if (go && !running) { running = true; reset(); timers.push(setTimeout(play, 700)); } // wait for the panel to slide in
      else if (!go && running) { running = false; reset(); }
    }
    if (tabs) tabs.addEventListener('svc:change', sync);
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) new IntersectionObserver(function(es){ onScreen = es[0].isIntersecting; sync(); }, { threshold: .35 }).observe(win);
    else { onScreen = true; sync(); }
  });

  // Tab demos ([data-demo]): small scripted "someone is using it" loops for the other service windows.
  // Each run restores the window's original markup, so a loop always starts clean. Same start/stop rules as the chat.
  var DEMOS = {
    mobile: function(d){ // tap an order, swipe the feed up, tap Book again
      var rows = d.qa('.dsh-ui-phone__row'), list = d.q('.dsh-ui-phone__list'), feed = d.q('.dsh-ui-phone__feed'), go = d.q('.dsh-ui-phone__go');
      d.place(.75, 1.05);
      d.at(300, function(){ d.show(); d.move(rows[0], .55, .5); });
      d.at(1200, function(){ d.click(); rows[0].classList.add('is-hot'); });
      d.at(2300, function(){ rows[0].classList.remove('is-hot'); d.move(feed, .6, .8); });
      d.at(3000, function(){ d.move(feed, .6, .25); list.style.transform = 'translateY(' + (-(list.scrollHeight - feed.clientHeight)) + 'px)'; });
      d.at(4000, function(){ rows[3].classList.add('is-hot'); });
      d.at(4700, function(){ rows[3].classList.remove('is-hot'); d.move(go, .5, .5); });
      d.at(5500, function(){ d.click(); d.press(go); go.textContent = '✓ Booked for Friday'; go.classList.add('is-done'); });
      d.at(7300, function(){ d.hide(); });
      return 8300;
    },
    web: function(d){ // hover a bar, switch 7 days -> 30 days, hover again
      var bars = d.qa('.dsh-ui__bars b'), range = d.qa('.dsh-ui__range span'), kpis = d.qa('.dsh-ui__kpi b');
      d.place(.9, 1.1);
      d.at(300, function(){ d.show(); d.move(bars[5], .5, .3); });
      d.at(1150, function(){ bars[5].classList.add('is-hot'); d.tip(bars[5], 'Sat · 412 orders'); });
      d.at(2400, function(){ bars[5].classList.remove('is-hot'); d.untip(); d.move(range[1], .5, .5); });
      d.at(3200, function(){
        d.click(); range[0].classList.remove('on'); range[1].classList.add('on');
        kpis.forEach(function(k){ k.textContent = k.getAttribute('data-b'); });
        bars.forEach(function(b){ b.style.height = b.getAttribute('data-b'); b.classList.remove('l'); });
      });
      d.at(4300, function(){ d.move(bars[7], .5, .25); });
      d.at(5100, function(){ bars[7].classList.add('is-hot'); d.tip(bars[7], 'This week · 1.3k orders'); });
      d.at(6800, function(){ bars[7].classList.remove('is-hot'); d.untip(); d.hide(); });
      return 8000;
    },
    portal: function(d){ // type an email, sign in with SSO, click through roles
      var f = d.q('[data-field]'), btn = d.q('.dsh-ui__btn'), roles = d.qa('.dsh-ui__roles span');
      d.place(.9, 1.1);
      d.at(300, function(){ d.show(); d.move(f, .3, .55); });
      d.at(1100, function(){ d.click(); f.classList.add('is-focus'); d.type(f, 'you@acme.com', 55); });
      d.at(2300, function(){ d.move(btn, .5, .55); });
      d.at(3100, function(){ d.click(); d.press(btn); f.classList.remove('is-focus'); btn.textContent = 'Signing in…'; });
      d.at(4000, function(){ btn.textContent = '✓ Signed in as Admin'; btn.classList.add('is-done'); roles[0].classList.add('on'); });
      d.at(4900, function(){ d.move(roles[1], .5, .6); });
      d.at(5600, function(){ d.click(); roles[0].classList.remove('on'); roles[1].classList.add('on'); });
      d.at(6400, function(){ d.move(roles[2], .5, .6); });
      d.at(7100, function(){ d.click(); roles[1].classList.remove('on'); roles[2].classList.add('on'); });
      d.at(8300, function(){ d.hide(); });
      return 9300;
    },
    saas: function(d){ // no cursor: a live admin view; events slide in, counters tick, plan mix shifts
      var feed = d.q('.dsh-ui__events'), mix = d.qa('.dsh-ui__mix span'), k = {};
      d.qa('[data-k]').forEach(function(b){ k[b.getAttribute('data-k')] = b; });
      var events = [
        ['NW', '#0182CA', 'Northwind', 'upgraded to Scale', { ws: 0, seats: 40, trial: 0 }, [37, 43, 20]],
        ['GX', '#EF4444', 'Globex', 'added 8 seats', { ws: 0, seats: 8, trial: 0 }, [37, 44, 19]],
        ['IN', '#22C55E', 'Initech', 'started a free trial', { ws: 1, seats: 5, trial: 1 }, [38, 43, 19]],
        ['UC', '#F97316', 'Umbrella Co.', 'joined on the Team plan', { ws: 1, seats: 12, trial: 0 }, [37, 45, 18]],
        ['HL', '#6366F1', 'Hooli', 'turned on SSO', { ws: 0, seats: 0, trial: 0 }, [36, 45, 19]]
      ];
      var t = 600;
      events.forEach(function(e){
        d.at(t, function(){
          var row = document.createElement('div');
          row.className = 'dsh-ui__ev is-new';
          row.innerHTML = '<i style="background:' + e[1] + '">' + e[0] + '</i><span><b>' + e[2] + '</b> ' + e[3] + '</span><em>now</em>';
          feed.insertBefore(row, feed.firstChild);
          var rows = feed.children; if (rows.length > 3) feed.removeChild(rows[rows.length - 1]);
          [].forEach.call(rows, function(r, i){ if (i) { var em = r.querySelector('em'); if (em && em.textContent === 'now') em.textContent = '1m'; r.classList.remove('is-new'); } });
          Object.keys(e[4]).forEach(function(key){
            if (!e[4][key]) return;
            var b = k[key], v = parseInt(b.textContent.replace(/,/g, ''), 10) + e[4][key];
            b.textContent = v.toLocaleString('en-US'); b.classList.add('is-up');
            d.at(700, function(){ b.classList.remove('is-up'); });
          });
          mix.forEach(function(m, i){ m.style.width = e[5][i] + '%'; });
        });
        t += 1500;
      });
      return t + 600;
    },
    int: function(d){ // no cursor: each tool lights up as data arrives and the sync log adds a line
      var nodes = d.qa('.dsh-ui-flow__n[data-log]'), log = d.q('.dsh-ui__log'), t = 500;
      nodes.forEach(function(n){
        d.at(t, function(){
          n.classList.remove('is-hit'); void n.offsetWidth; n.classList.add('is-hit');
          var parts = n.getAttribute('data-log').split('|'), line = document.createElement('div');
          line.className = 'is-new'; line.innerHTML = '<span>' + parts[0] + '</span><em>✓ ' + parts[1] + '</em>';
          [].forEach.call(log.children, function(x){ x.classList.remove('is-new'); });
          log.appendChild(line); if (log.children.length > 3) log.removeChild(log.firstElementChild);
        });
        t += 1600;
      });
      return t + 400;
    }
  };
  [].forEach.call(document.querySelectorAll('[data-demo]'), function(root){
    var script = DEMOS[root.getAttribute('data-demo')];
    if (reduce || !script) return;
    var snap = root.innerHTML, panel = root.closest('.dsh-svc__panel'), tabs = root.closest('[data-svc]');
    var timers = [], running = false, onScreen = false, cur;
    function at(ms, fn){ timers.push(setTimeout(fn, ms)); }
    function pt(el, fx, fy){ var r = el.getBoundingClientRect(), w = root.getBoundingClientRect(); return [r.left - w.left + r.width * fx, r.top - w.top + r.height * fy]; }
    var d = {
      at: at,
      q: function(sel){ return root.querySelector(sel); },
      qa: function(sel){ return [].slice.call(root.querySelectorAll(sel)); },
      place: function(fx, fy){ cur.style.transition = 'none'; cur.style.transform = 'translate(' + root.clientWidth * fx + 'px,' + root.clientHeight * fy + 'px)'; void cur.offsetWidth; cur.style.transition = ''; },
      move: function(el, fx, fy){ var p = pt(el, fx, fy); cur.style.transform = 'translate(' + p[0] + 'px,' + p[1] + 'px)'; },
      show: function(){ cur.style.opacity = 1; },
      hide: function(){ cur.style.opacity = 0; },
      click: function(){ cur.classList.remove('is-click'); void cur.offsetWidth; cur.classList.add('is-click'); },
      press: function(el){ el.classList.add('is-press'); at(160, function(){ el.classList.remove('is-press'); }); },
      // tooltip above the element, kept inside the window: clamped left/right, flipped below if it would hit the title bar
      tip: function(el, text){
        var tp = root.querySelector('.dsh-demo__tip'), top = pt(el, .5, 0), bottom = pt(el, .5, 1), bar = root.querySelector('.dsh-ui__bar');
        tp.textContent = text;
        var w = tp.offsetWidth, h = tp.offsetHeight, half = w / 2 + 8, minTop = (bar ? bar.offsetHeight : 0) + 6;
        var below = top[1] - h - 8 < minTop;
        tp.classList.toggle('is-below', below);
        tp.style.left = Math.min(Math.max(top[0], half), root.clientWidth - half) + 'px';
        tp.style.top = (below ? bottom[1] : top[1]) + 'px';
        tp.classList.add('is-on');
      },
      untip: function(){ var tp = root.querySelector('.dsh-demo__tip'); if (tp) tp.classList.remove('is-on'); },
      type: function(field, text, ms){ var out = field.querySelector('.dsh-demo__typed'), n = 0; field.classList.add('has-text'); (function key(){ out.textContent = text.slice(0, ++n); if (n < text.length) at(ms, key); })(); }
    };
    function reset(){ timers.forEach(clearTimeout); timers = []; root.innerHTML = snap; cur = root.querySelector('.dsh-demo__cursor'); }
    function play(){ reset(); var len = script(d); at(len, play); }
    function sync(){
      var go = onScreen && !document.hidden && (!panel || panel.classList.contains('is-active'));
      if (go && !running) { running = true; reset(); timers.push(setTimeout(play, 700)); }
      else if (!go && running) { running = false; reset(); }
    }
    if (tabs) tabs.addEventListener('svc:change', sync);
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) new IntersectionObserver(function(es){ onScreen = es[0].isIntersecting; sync(); }, { threshold: .35 }).observe(root);
    else { onScreen = true; sync(); }
  });

  // Technology orbit ([data-tech-pulse]): every 2.6s a wave rings out from the DS mark and each logo pops as it
  // passes (inner ring first). Timers only; runs only while the orbit is on screen.
  [].forEach.call(document.querySelectorAll('[data-tech-pulse]'), function(orbit){
    if (reduce) return;
    var nodes = [].slice.call(orbit.querySelectorAll('.dsh-tech__node')), core = orbit.querySelector('.dsh-tech__core');
    var EVERY = 2600, timer = null;
    function pulse(){
      if (document.hidden) return;
      var w = document.createElement('span'); w.className = 'dsh-tech__wave'; orbit.insertBefore(w, core);
      setTimeout(function(){ w.remove(); }, EVERY + 100);
      core.classList.add('is-beat'); setTimeout(function(){ core.classList.remove('is-beat'); }, 320);
      nodes.forEach(function(n){
        var r = parseFloat(n.style.getPropertyValue('--r')) || 0;
        // the wave reaches radius r at about this time (it grows from 66px to ~300px over the first half)
        var at = Math.max(0, (r - 66) / 240) * EVERY * .55;
        setTimeout(function(){ n.classList.add('is-hit'); setTimeout(function(){ n.classList.remove('is-hit'); }, 420); }, at);
      });
    }
    function start(){ if (!timer) { pulse(); timer = setInterval(pulse, EVERY); } }
    function stop(){ clearInterval(timer); timer = null; }
    if ('IntersectionObserver' in window) new IntersectionObserver(function(es){ es[0].isIntersecting ? start() : stop(); }, { threshold: .2 }).observe(orbit);
    else start();
  });

  // Technology orbit, beams ([data-tech-beams]): dotted lines join the DS mark to every tool; every 1.5s a dot
  // shoots along one line, the line turns solid and the tool lights up with its name. Visits every tool in a
  // spread-out order. Timers only; runs only while the orbit is on screen.
  [].forEach.call(document.querySelectorAll('[data-tech-beams]'), function(orbit){
    var NS = 'http://www.w3.org/2000/svg', C = 280; // the orbit is drawn on a 560 x 560 box
    var nodes = [].slice.call(orbit.querySelectorAll('.dsh-tech__node'));
    var pts = nodes.map(function(n){
      var a = parseFloat(n.style.getPropertyValue('--a')) * Math.PI / 180, r = parseFloat(n.style.getPropertyValue('--r'));
      return [C + r * Math.cos(a), C + r * Math.sin(a)];
    });
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'dsh-tech__beams'); svg.setAttribute('viewBox', '0 0 560 560');
    var lines = pts.map(function(p){ var l = document.createElementNS(NS, 'line'); l.setAttribute('x1', C); l.setAttribute('y1', C); l.setAttribute('x2', p[0]); l.setAttribute('y2', p[1]); svg.appendChild(l); return l; });
    var dot = document.createElementNS(NS, 'circle'); dot.setAttribute('r', 4); dot.setAttribute('cx', C); dot.setAttribute('cy', C); svg.appendChild(dot);
    orbit.insertBefore(svg, orbit.firstChild.nextSibling);
    if (reduce) return; // lines stay as a static diagram
    var order = nodes.map(function(_, k){ return (k * 7) % nodes.length; }), i = 0, timer = null;
    function shoot(){
      if (document.hidden) return;
      var j = order[i++ % order.length], p = pts[j], s = 0, STEPS = 14;
      lines.forEach(function(l, x){ l.classList.toggle('is-on', x === j); });
      nodes.forEach(function(n){ n.classList.remove('is-on'); });
      (function step(){
        s++; dot.setAttribute('cx', C + (p[0] - C) * s / STEPS); dot.setAttribute('cy', C + (p[1] - C) * s / STEPS);
        if (s < STEPS) setTimeout(step, 30); else nodes[j].classList.add('is-on');
      })();
    }
    function start(){ if (!timer) { shoot(); timer = setInterval(shoot, 1500); } }
    function stop(){ clearInterval(timer); timer = null; }
    if ('IntersectionObserver' in window) new IntersectionObserver(function(es){ es[0].isIntersecting ? start() : stop(); }, { threshold: .2 }).observe(orbit);
    else start();
  });

  // Technology orbit, assemble + float ([data-tech-float]): the logos start outside the rings and fly into place
  // (one after another) the first time the orbit scrolls into view; then each bobs gently, slightly out of step.
  // On mouse devices the rings lean toward the pointer (inner ring more than outer, for depth).
  [].forEach.call(document.querySelectorAll('[data-tech-float]'), function(orbit){
    var nodes = [].slice.call(orbit.querySelectorAll('.dsh-tech__node')), rings = orbit.querySelectorAll('.dsh-tech__ring');
    nodes.forEach(function(n, i){
      var f = document.createElement('span'); f.className = 'dsh-tech__float'; f.style.animationDelay = (-i * .45) + 's';
      while (n.firstChild) f.appendChild(n.firstChild); n.appendChild(f);
    });
    if (reduce) return;
    nodes.forEach(function(n){ n.classList.add('is-out'); });
    var done = false;
    function assemble(){
      if (done) return; done = true;
      nodes.forEach(function(n, i){ setTimeout(function(){ n.classList.remove('is-out'); }, 150 + i * 55); });
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function(es){ if (es[0].isIntersecting) { assemble(); io.disconnect(); } }, { threshold: .3 });
      io.observe(orbit);
    } else assemble();
    setTimeout(function(){ if (!done && !('IntersectionObserver' in window)) assemble(); }, 3000);
    if (!window.matchMedia('(hover: hover)').matches) return;
    var stage = orbit.parentNode;
    function lean(x, y){
      rings[0].style.transform = 'translate(' + (x * 14) + 'px,' + (y * 14) + 'px)';
      if (rings[1]) rings[1].style.transform = 'translate(' + (x * 26) + 'px,' + (y * 26) + 'px)';
    }
    stage.addEventListener('mousemove', function(e){ var r = orbit.getBoundingClientRect(); lean((e.clientX - r.left) / r.width - .5, (e.clientY - r.top) / r.height - .5); });
    stage.addEventListener('mouseleave', function(){ lean(0, 0); });
  });

  // Technology legend <-> orbit ([data-tech-legend]): hovering, focusing or tapping a group box lights up that
  // group's logos (the rest fade); hovering a logo highlights its group box. Works with any orbit motion.
  [].forEach.call(document.querySelectorAll('[data-tech-legend]'), function(legend){
    var sec = legend.closest('section'), orbit = sec && sec.querySelector('.dsh-tech__orbit');
    if (!orbit) return;
    var boxes = [].slice.call(legend.querySelectorAll('li[data-g]')), nodes = [].slice.call(orbit.querySelectorAll('.dsh-tech__node[data-g]'));
    var tapped = null;
    function pick(g){
      orbit.classList.toggle('is-spot', g != null);
      nodes.forEach(function(n){ n.classList.toggle('is-pick', n.getAttribute('data-g') === g); });
      boxes.forEach(function(b){ b.classList.toggle('is-pick', b.getAttribute('data-g') === g); });
    }
    var canHover = window.matchMedia('(hover: hover)').matches;
    boxes.forEach(function(b){
      var g = b.getAttribute('data-g');
      if (canHover) { b.addEventListener('mouseenter', function(){ pick(g); }); b.addEventListener('mouseleave', function(){ pick(tapped); }); }
      b.addEventListener('focus', function(){ pick(g); });
      b.addEventListener('blur', function(){ pick(tapped); });
      // touch / click: toggle the group on and off
      b.addEventListener('click', function(){ tapped = tapped === g ? null : g; pick(tapped); });
    });
    if (canHover) nodes.forEach(function(n){
      n.addEventListener('mouseenter', function(){ boxes.forEach(function(b){ b.classList.toggle('is-pick', b.getAttribute('data-g') === n.getAttribute('data-g')); }); });
      n.addEventListener('mouseleave', function(){ pick(tapped); });
    });
  });

  // Industries list + panel ([data-ind]): the list on the left is a tab list; the open industry shows in the dark panel.
  // Moves on every 3.5s; hover, click or arrow keys pick one. Hover / focus / off screen pauses; reduced motion: no auto.
  [].forEach.call(document.querySelectorAll('[data-ind]'), function(root){
    var rows = [].slice.call(root.querySelectorAll('.dsh-ind__row')), panels = [].slice.call(root.querySelectorAll('.dsh-ind__panel'));
    var n = rows.length, cur = 0, hold = false, onScreen = true;
    function show(i, focus){
      cur = (i + n) % n;
      rows.forEach(function(r, j){ var on = j === cur; r.classList.toggle('is-on', on); r.setAttribute('aria-selected', on); r.tabIndex = on ? 0 : -1; });
      panels.forEach(function(p, j){ p.classList.toggle('is-on', j === cur); p.inert = j !== cur; });
      if (focus) rows[cur].focus();
      var list = rows[cur].parentNode; if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: rows[cur].offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' });
    }
    var canHover = window.matchMedia('(hover: hover)').matches;
    rows.forEach(function(r, i){
      if (canHover) r.addEventListener('mouseenter', function(){ show(i); });
      r.addEventListener('click', function(){ show(i); });
      r.addEventListener('keydown', function(e){ var d = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : (e.key === 'ArrowUp' || e.key === 'ArrowLeft') ? -1 : 0; if (d) { e.preventDefault(); show(cur + d, true); } });
    });
    show(0);
    if (reduce) return;
    root.addEventListener('mouseenter', function(){ hold = true; }); root.addEventListener('mouseleave', function(){ hold = false; });
    root.addEventListener('focusin', function(){ hold = true; }); root.addEventListener('focusout', function(e){ if (!root.contains(e.relatedTarget)) hold = false; });
    if ('IntersectionObserver' in window) new IntersectionObserver(function(es){ onScreen = es[0].isIntersecting; }, { threshold: .3 }).observe(root);
    setInterval(function(){ if (!hold && onScreen && !document.hidden) show(cur + 1); }, 3500);
  });

  // FAQ chat ([data-faq]): clicking a question chip "asks" it in the chat window; a typing bubble turns into the answer,
  // typed out word by word. Questions and answers come from the hidden <dl>. Reduced motion: the answer appears at once.
  [].forEach.call(document.querySelectorAll('[data-faq]'), function(root){
    var chips = [].slice.call(root.querySelectorAll('.dsh-faq__chip')), log = root.querySelector('.dsh-faq__log');
    var qs = [].slice.call(root.querySelectorAll('.dsh-faq__all dt')), as = [].slice.call(root.querySelectorAll('.dsh-faq__all dd'));
    var timers = [];
    function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function ask(i){
      timers.forEach(clearTimeout); timers = [];
      chips.forEach(function(c, j){ c.classList.toggle('is-on', j === i); c.setAttribute('aria-pressed', j === i); });
      log.innerHTML = '';
      log.appendChild(el('div', 'dsh-faq__me dsh-faq__in', qs[i].textContent));
      var row = el('div', 'dsh-faq__ds dsh-faq__in'); row.appendChild(el('b', '', 'DS'));
      var answer = as[i].textContent;
      if (reduce) { row.appendChild(el('p', '', answer)); log.appendChild(row); return; }
      var dots = el('div', 'dsh-faq__dots'); dots.innerHTML = '<i></i><i></i><i></i>'; row.appendChild(dots); log.appendChild(row);
      timers.push(setTimeout(function(){
        row.removeChild(dots); var p = el('p'); row.appendChild(p);
        var words = answer.split(' '), n = 0;
        (function type(){ p.textContent = words.slice(0, ++n).join(' '); if (n < words.length) timers.push(setTimeout(type, 28)); })();
      }, 700));
    }
    var win = root.querySelector('.dsh-faq__win');
    chips.forEach(function(c, i){ c.addEventListener('click', function(){
      ask(i);
      // stacked layout (phones / tablets): bring the chat into view so the answer is seen
      if (window.innerWidth <= 1024) { var r = win.getBoundingClientRect(); if (r.top < 0 || r.bottom > window.innerHeight) win.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); }
    }); });
    // first question plays when the section first comes into view
    var started = false;
    function start(){ if (!started) { started = true; ask(0); } }
    if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function(es){ if (es[0].isIntersecting) { start(); io.disconnect(); } }, { threshold: .3 }); io.observe(root); }
    else start();
    setTimeout(start, 6000); // fallback if the observer never fires
  });

  // Contact form ([data-contact]): checks name + email, then shows the thank-you state. Draft only: nothing is sent.
  // In WordPress the form plugin takes over submission (Hamza); keep the field names.
  [].forEach.call(document.querySelectorAll('[data-contact]'), function(form){
    var card = form.parentNode, ok = card.querySelector('.dsh-contact__ok'), err = form.querySelector('.dsh-contact__err');
    var name = form.querySelector('[name=name]'), email = form.querySelector('[name=email]');
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var bad = [];
      if (!name.value.trim()) bad.push(name);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) bad.push(email);
      [name, email].forEach(function(f){ f.setAttribute('aria-invalid', bad.indexOf(f) > -1); });
      err.hidden = !bad.length;
      if (bad.length) { bad[0].focus(); return; }
      form.hidden = true; ok.hidden = false;
    });
    [name, email].forEach(function(f){ f.addEventListener('input', function(){ f.removeAttribute('aria-invalid'); }); });
  });

  // generic tabs (.dsh-tabs [role=tab]); not used on the home page right now
  var tabs = [].slice.call(document.querySelectorAll('.dsh-tabs [role=tab]'));
  function sel(b){ tabs.forEach(function(x){ var on = x === b; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; document.getElementById(x.getAttribute('aria-controls')).hidden = !on; }); }
  tabs.forEach(function(b, i){ b.addEventListener('click', function(){ sel(b); }); b.addEventListener('keydown', function(ev){ if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { var n = tabs[(i + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; sel(n); n.focus(); } }); });
})();
