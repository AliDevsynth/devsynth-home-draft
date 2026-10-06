/* Devsynth inner pages: chip filters ([data-filter]) and table-of-contents highlighting ([data-toc]). */
(function(){
  // chip filters: buttons with data-f="group:value" show only cards whose data-tags contain the value
  [].forEach.call(document.querySelectorAll('[data-filter]'), function(root){
    var chips = [].slice.call(root.querySelectorAll('[data-f]'));
    var cards = [].slice.call(document.querySelectorAll(root.getAttribute('data-filter')));
    var active = {};
    function apply(){
      cards.forEach(function(c){
        var tags = (c.getAttribute('data-tags') || '').split(' ');
        var ok = Object.keys(active).every(function(g){ return !active[g] || tags.indexOf(active[g]) > -1; });
        c.hidden = !ok;
      });
      chips.forEach(function(ch){ var p = ch.getAttribute('data-f').split(':'); var on = (active[p[0]] || '') === p[1]; ch.classList.toggle('is-on', on); ch.setAttribute('aria-pressed', on); });
    }
    chips.forEach(function(ch){ ch.addEventListener('click', function(){ var p = ch.getAttribute('data-f').split(':'); active[p[0]] = active[p[0]] === p[1] ? '' : p[1]; apply(); }); });
    apply();
  });
  // table of contents: highlight the section in view
  [].forEach.call(document.querySelectorAll('[data-toc]'), function(toc){
    var links = [].slice.call(toc.querySelectorAll('a[href^="#"]'));
    var secs = links.map(function(a){ return document.getElementById(a.getAttribute('href').slice(1)); });
    function onScroll(){
      var y = window.innerHeight * 0.3, cur = 0;
      secs.forEach(function(s, i){ if (s && s.getBoundingClientRect().top < y) cur = i; });
      links.forEach(function(a, i){ a.classList.toggle('is-on', i === cur); });
    }
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  });
})();
