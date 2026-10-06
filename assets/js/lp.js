/* Landing pages: load the Calendly booking frame only when the booking section is near the screen or a CTA is tapped,
   pass the page's UTM tags into it, and tag each CTA position (hero, mid, final, sticky). */
(function(){
  var box = document.querySelector('[data-cal]'); if (!box) return;
  var q = new URLSearchParams(location.search), keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
  function load(cta){
    if (box.classList.contains('is-loaded')) return;
    var u = new URL(box.getAttribute('data-cal'));
    u.searchParams.set('embed_type', 'Inline'); u.searchParams.set('embed_domain', location.hostname || 'devsynth.us'); u.searchParams.set('hide_gdpr_banner', '1');
    keys.forEach(function(k){ if (q.get(k)) u.searchParams.set(k, q.get(k)); });
    if (cta) u.searchParams.set('utm_content', (q.get('utm_content') ? q.get('utm_content') + '_' : '') + cta);
    var f = document.createElement('iframe'); f.src = u.toString(); f.title = 'Book a 30-minute call'; f.loading = 'lazy';
    box.appendChild(f); box.classList.add('is-loaded');
  }
  [].forEach.call(document.querySelectorAll('[data-cta]'), function(a){
    a.addEventListener('click', function(){ load(a.getAttribute('data-cta')); if (window.lintrk) window.lintrk('track', { conversion_id: 0 /* Hamza: "LP CTA click" id */ }); });
  });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) { load(); io.disconnect(); } }); }, { rootMargin: '400px' });
    io.observe(box);
  }
  // Calendly posts a message when a booking is made: fire the "LP booked call" conversion once
  window.addEventListener('message', function(e){
    if (e.data && e.data.event === 'calendly.event_scheduled' && !box.dataset.done) { box.dataset.done = 1; if (window.lintrk) window.lintrk('track', { conversion_id: 0 /* Hamza: "LP booked call" id */ }); }
  });
})();
