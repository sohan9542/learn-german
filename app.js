/* Deutsch kompakt — tiny static SPA. Routes: #/ (home), #/<level>, #/<level>/<chapter>[/<section>], #/stars */
(function () {
  'use strict';
  var KEY = 'dk.v1';
  var S = load();
  if (!S.v || S.v < 2) { // v1 auto-marked chapters done just by opening them; clear those unreliable marks once
    if (Object.keys(S.done || {}).length) { S.done = {}; setTimeout(function () { toast('আগের ভুল ✓ চিহ্নগুলো মুছে দেওয়া হয়েছে। এখন শুধু "অধ্যায় শেষ" বোতামে ✓ লাগবে।', 5000); }, 800); }
    S.v = 2; save();
  }
  S.lastBy = S.lastBy || {};
  function load() { try { return Object.assign({ last: null, done: {}, stars: {}, rate: 1, scroll: {} }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { last: null, done: {}, stars: {}, rate: 1, scroll: {} }; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var app = $('#app');
  var BN = '০১২৩৪৫৬৭৮৯';
  function bn(n) { return String(n).replace(/\d/g, function (d) { return BN[d]; }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(msg, ms) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, ms || 2600); }

  /* ---------- level data loading ---------- */
  var cache = {};
  function levelMeta(id) { return (window.LEVELS || []).filter(function (l) { return l.id === id; })[0]; }
  function getLevel(id) {
    if (cache[id]) return Promise.resolve(cache[id]);
    var meta = levelMeta(id);
    if (!meta || !meta.ready) return Promise.resolve(null);
    if (window.LEVELS_DATA && window.LEVELS_DATA[id]) return Promise.resolve(cache[id] = window.LEVELS_DATA[id]);
    return new Promise(function (res) {
      var s = document.createElement('script'); s.src = meta.file;
      s.onload = function () { res(cache[id] = (window.LEVELS_DATA || {})[id] || null); };
      s.onerror = function () { res(null); };
      document.head.appendChild(s);
    });
  }

  /* ---------- audio ---------- */
  var player = new Audio(); player.preload = 'auto';
  var current = null, deVoice = null;
  function pickVoice() {
    if (!window.speechSynthesis) return;
    var vs = speechSynthesis.getVoices().filter(function (v) { return /^de(-|_|$)/i.test(v.lang); });
    deVoice = vs.filter(function (v) { return /google|natural|neural|online/i.test(v.name); })[0] || vs[0] || null;
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speakTTS(text, el) {
    if (!window.speechSynthesis) { done(el); toast('এই ব্রাউজারে অডিও নেই'); return; }
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; if (deVoice) u.voice = deVoice;
    u.rate = 0.9 * S.rate; u.onend = u.onerror = function () { done(el); };
    speechSynthesis.speak(u);
  }
  function done(el) { if (el) el.classList.remove('playing'); }
  function play(el) {
    var key = el.getAttribute('data-a'), text = el.getAttribute('data-t') || el.textContent;
    if (current) current.classList.remove('playing');
    current = el; el.classList.add('playing');
    try { player.pause(); } catch (e) {}
    if (window.speechSynthesis) speechSynthesis.cancel();
    window.__lastPlayed = { key: key, text: text };
    if (!key) return speakTTS(text, el);
    var fellBack = false;
    var fb = function () { if (fellBack) return; fellBack = true; window.__lastPlayed.fallback = true; speakTTS(text, el); };
    player.onended = function () { done(el); };
    player.onerror = fb;
    player.src = 'audio/' + key + '.mp3';
    player.playbackRate = S.rate;
    var p = player.play();
    if (p && p.catch) p.catch(function (err) { if (err && err.name === 'NotAllowedError') { done(el); } else fb(); });
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    var tg = t.closest && t.closest('[data-toggle]');
    if (tg && tg.closest('li.done')) { e.preventDefault(); e.stopPropagation(); delete S.done[tg.getAttribute('data-toggle')]; save(); toast('চিহ্ন সরানো হলো'); route(); return; }
    var rs = t.closest && t.closest('[data-reset]');
    if (rs) { e.preventDefault(); var pre = rs.getAttribute('data-reset') + '/'; Object.keys(S.done).forEach(function (k) { if (k.indexOf(pre) === 0) delete S.done[k]; }); save(); toast('সব ✓ মুছে ফেলা হলো'); route(); return; }
    var star = t.closest && t.closest('.star');
    if (star) { e.preventDefault(); e.stopPropagation(); toggleStar(star); return; }
    var rv = t.closest && t.closest('.reveal');
    if (rv) { rv.parentNode.classList.add('shown'); var s = rv.parentNode.querySelector('.answer .say'); if (s) play(s); return; }
    var rf = t.closest && t.closest('.rf');
    if (rf) { var ok = rf.getAttribute('data-ok') === '1'; rf.classList.add(ok ? 'ok' : 'bad');
      $$('.rf', rf.parentNode).forEach(function (b) { if (b.getAttribute('data-ok') === '1') b.classList.add('ok'); });
      var n = rf.parentNode.querySelector('.rfnote'); if (n) n.classList.add('shown');
      toast(ok ? 'ঠিক! Richtig ✓' : 'ভুল — সবুজটা সঠিক'); return; }
    var say = t.closest && t.closest('.say');
    if (say) { e.preventDefault(); play(say); }
  });

  /* ---------- stars ---------- */
  function rowInfo(el) {
    var tr = el.closest('tr'), de = tr && tr.querySelector('td.say');
    if (!de) return null;
    var pr = tr.querySelector('td.pr'), bnm = tr.querySelector('td.bn');
    return { a: de.getAttribute('data-a'), t: de.getAttribute('data-t'), html: de.innerHTML.replace(/<button[^]*?<\/button>/g, ''), pr: pr ? pr.textContent : '', bn: bnm ? bnm.textContent : '' };
  }
  function toggleStar(btn) {
    var info = rowInfo(btn); if (!info) return;
    if (S.stars[info.a]) { delete S.stars[info.a]; btn.classList.remove('on'); btn.textContent = '☆'; toast('তালিকা থেকে সরানো হলো'); }
    else { info.at = Date.now(); S.stars[info.a] = info; btn.classList.add('on'); btn.textContent = '★'; toast('★ "আমার শব্দ"-তে যোগ হলো'); }
    save(); updateStarCount();
    if (location.hash === '#/stars') renderStars();
  }
  function updateStarCount() { $('#starCount').textContent = bn(Object.keys(S.stars).length); }
  function addStars(root) {
    $$('table.voc td.say, table.cards td.say', root).forEach(function (td) {
      var tr = td.closest('tr'); if (!tr || !tr.querySelector('td.bn') || !tr.querySelector('td.pr') || tr.querySelector('.star')) return;
      var on = !!S.stars[td.getAttribute('data-a')];
      var b = document.createElement('button'); b.className = 'star' + (on ? ' on' : ''); b.type = 'button'; b.textContent = on ? '★' : '☆'; b.setAttribute('aria-label', 'star');
      tr.querySelector('td.bn').appendChild(b);
    });
  }

  /* ---------- progress / resume ---------- */
  var view = null; // {level, ch}
  function chKey(l, c) { return l + '/' + c; }
  function readPct() { var h = document.documentElement.scrollHeight - innerHeight; return h > 0 ? Math.min(1, scrollY / h) : 1; }
  var saveT;
  window.addEventListener('scroll', function () {
    if (!view) return;
    $('#readbar').style.width = (readPct() * 100).toFixed(1) + '%';
    clearTimeout(saveT); saveT = setTimeout(persistPos, 250);
  }, { passive: true });
  function persistPos() {
    if (!view) return;
    var k = chKey(view.level, view.ch);
    S.scroll[k] = Math.round(scrollY);
    S.last = { level: view.level, ch: view.ch, scroll: Math.round(scrollY), section: currentSection(), at: Date.now() };
    S.lastBy[view.level] = S.last;
    // no auto-complete: chapters are marked done only with the explicit button (tap again to undo)
    save();
  }
  function currentSection() {
    var hs = $$('main h2[id]'), id = null;
    for (var i = 0; i < hs.length; i++) { if (hs[i].getBoundingClientRect().top < 120) id = hs[i].id; else break; }
    return id;
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) persistPos(); });
  window.addEventListener('pagehide', persistPos);
  function setDoneBtn(b, on) { b.classList.toggle('on', on); b.textContent = on ? '✓ অধ্যায় শেষ (চাপলে চিহ্ন উঠবে)' : 'অধ্যায় শেষ ✓ চিহ্ন দিন'; }

  /* ---------- drawer ---------- */
  function openDrawer() {
    var lv = (view && view.level) || (S.last && S.last.level) || 'a1';
    getLevel(lv).then(function (L) {
      var d = $('#drawer');
      var h = '<h3>অধ্যায়সমূহ · Inhalt</h3><div class="lv">' + window.LEVELS.map(function (l) {
        return l.ready ? '<a href="#/' + l.id + '" class="' + (l.id === lv ? 'cur' : '') + '">' + l.title + '</a>' : '<span>' + l.title + ' <small>শীঘ্রই</small></span>';
      }).join('') + '<a href="#/">হোম</a><a href="#/stars">★ আমার শব্দ</a></div><ul>';
      if (L) L.chapters.forEach(function (c) {
        var cur = view && view.ch === c.id;
        h += '<li class="l1' + (cur ? ' cur' : '') + '"><a href="#/' + lv + '/' + c.id + '">' + esc(c.num) + ' — ' + esc(c.title) + (S.done[chKey(lv, c.id)] ? '<span class="tick">✓</span>' : '') + '</a></li>';
        if (cur) c.sections.forEach(function (s) { h += '<li class="l2"><a href="#/' + lv + '/' + c.id + '/' + s.id + '">' + esc(s.title) + '</a></li>'; });
      });
      d.innerHTML = h + '</ul>'; d.hidden = false; $('#scrim').hidden = false;
    });
  }
  function closeDrawer() { $('#drawer').hidden = true; $('#scrim').hidden = true; }
  $('#menuBtn').onclick = openDrawer; $('#scrim').onclick = closeDrawer;
  $('#drawer').addEventListener('click', function (e) { if (e.target.closest('a')) closeDrawer(); });
  var rates = [1, 0.75, 0.6], rateLbl = { 1: '১×', 0.75: '০.৭৫×', 0.6: 'ধীরে' };
  function setRateBtn() { var b = $('#rateBtn'); b.textContent = rateLbl[S.rate] || '১×'; b.classList.toggle('on', S.rate !== 1); }
  $('#rateBtn').onclick = function () { S.rate = rates[(rates.indexOf(S.rate) + 1) % rates.length]; save(); setRateBtn(); toast('উচ্চারণের গতি: ' + rateLbl[S.rate]); };

  /* ---------- views ---------- */
  function levelProgress(L, id) { var n = L.chapters.filter(function (c) { return S.done[chKey(id, c.id)]; }).length; return { n: n, total: L.chapters.length }; }
  function continueHTML(lv) {
    var last = lv ? S.lastBy[lv] : S.last;
    if (!last) return '';
    var L = cache[last.level], c = L && L.chapters.filter(function (x) { return x.id === last.ch; })[0];
    var label = c ? (last.level.toUpperCase() + ' · ' + c.num + ' — ' + c.title) : '';
    return '<a class="continue" href="#/' + last.level + '/' + last.ch + '" data-resume="1">▶ যেখানে ছিলেন সেখান থেকে চালিয়ে যান<small>' + esc(label) + '</small></a>';
  }
  function renderHome() {
    view = null; $('#readbar').style.width = '0';
    var lv = (S.last && S.last.level) || 'a1';
    getLevel(lv).then(function (L) {
      var p = levelProgress(L, lv);
      var h = '<section class="cover"><div class="kicker">GOETHE-ZERTIFIKAT · ' + window.LEVELS.filter(function (l) { return l.ready; }).map(function (l) { return l.title; }).join(' · ') + '</div><h1>Deutsch<br>kompakt</h1>' +
        '<div class="sub">বাংলাভাষীদের জন্য জার্মান পরীক্ষার<br>সংক্ষিপ্ত প্রস্তুতি — এখন শুনেও শিখুন</div><div class="line"></div>' +
        '<ul><li>যেকোনো জার্মান শব্দে চাপ দিন — উচ্চারণ শুনুন 🔊</li><li>প্রতিটি শব্দের বাংলা উচ্চারণ ও অর্থ</li><li>যেখানে থামবেন, পরের বার ঠিক সেখান থেকেই শুরু</li></ul>' +
        (S.last ? continueHTML() : '<a class="start" href="#/a1/ch1">শুরু করুন →</a>') +
        '<div class="hint">টিপস: ব্রাউজারের মেনু থেকে "Add to Home screen" দিন — অ্যাপের মতো খুলবে।</div></section>';
      h += '<div class="page"><div class="sec-title">স্তর · Niveau</div><div class="levels">' + window.LEVELS.map(function (l) {
        return l.ready ? '<a class="' + (l.id === lv ? 'cur' : 'rdy') + '" href="#/' + l.id + '"><b>' + l.title + '</b><small>' + (l.id === lv ? 'এখন পড়ছেন' : 'চালু আছে') + '</small></a>' : '<div class="soon"><b>' + l.title + '</b><small>শীঘ্রই আসছে</small></div>';
      }).join('') + '</div>';
      h += chapterList(L, lv, p) + '</div>';
      app.innerHTML = h; scrollTo(0, 0);
    });
  }
  function chapterList(L, lv, p) {
    var h = '<div class="sec-title">' + lv.toUpperCase() + ' অধ্যায়সমূহ</div><div class="small">অগ্রগতি: ' + bn(p.n) + '/' + bn(p.total) + ' অধ্যায় শেষ</div><div class="progress"><i style="width:' + (100 * p.n / p.total) + '%"></i></div><ul class="chlist">';
    L.chapters.forEach(function (c, i) {
      var k = chKey(lv, c.id), d = S.done[k], started = S.scroll[k] > 0;
      h += '<li class="' + (d ? 'done' : '') + '"><a href="#/' + lv + '/' + c.id + '"><span class="no" data-toggle="' + k + '" title="চিহ্ন বদলান">' + (d ? '✓' : bn(i + 1)) + '</span><span class="tt"><b>' + esc(c.title) + '</b><i>' + esc(c.de) + '</i></span><span class="st">' + (d ? 'শেষ' : started ? 'চলছে' : '') + '</span></a></li>';
    });
    return h + '</ul><p class="small">✓ ভুল করে লেগে গেলে সবুজ গোল ✓-তে চাপ দিন — চিহ্ন উঠে যাবে। <a href="#" data-reset="' + lv + '">সব ✓ মুছুন</a></p>';
  }
  function renderLevel(lv) {
    view = null;
    var meta = levelMeta(lv);
    if (meta && !meta.ready) { app.innerHTML = '<div class="page"><h1 class="chapter"><span class="num">' + meta.title + '</span>শীঘ্রই আসছে<span class="de">Kommt bald</span></h1><p>এই স্তরের বিষয়বস্তু তৈরি হচ্ছে। ততক্ষণ A1 চালিয়ে যান।</p><a class="continue" href="#/a1">A1-এ যান</a></div>'; return; }
    getLevel(lv).then(function (L) {
      if (!L) return renderHome();
      app.innerHTML = '<div class="page">' + continueHTML(lv) + chapterList(L, lv, levelProgress(L, lv)) + '</div>'; scrollTo(0, 0);
    });
  }
  function renderChapter(lv, cid, sec, resume) {
    getLevel(lv).then(function (L) {
      if (!L) return renderHome();
      var idx = -1; L.chapters.forEach(function (c, i) { if (c.id === cid) idx = i; });
      if (idx < 0) return renderLevel(lv);
      var c = L.chapters[idx], prev = L.chapters[idx - 1], next = L.chapters[idx + 1];
      view = { level: lv, ch: cid };
      var chips = '<div class="chips">' + c.sections.map(function (s) { return '<a href="#/' + lv + '/' + cid + '/' + s.id + '">' + esc(s.title) + '</a>'; }).join('') + '</div>';
      var html = c.html.replace('</h1>', '</h1>' + chips);
      app.innerHTML = '<article class="page" id="chap">' + html + '<div class="chfoot"><button class="donebtn" type="button"></button><div class="nav2">' +
        (prev ? '<a class="prev" href="#/' + lv + '/' + prev.id + '">← ' + esc(prev.title) + '</a>' : '<a class="prev" href="#/">← হোম</a>') +
        (next ? '<a href="#/' + lv + '/' + next.id + '">' + esc(next.title) + ' →</a>' : '<a href="#/">হোম →</a>') + '</div></div></article>';
      $$('#chap table').forEach(function (t) { if (t.classList.contains('grid')) { var w = document.createElement('div'); w.className = 'tw'; t.parentNode.insertBefore(w, t); w.appendChild(t); } });
      addStars(app); app.setAttribute('data-view', lv + '/' + cid);
      var b = $('.donebtn'); var k = chKey(lv, cid); setDoneBtn(b, !!S.done[k]);
      b.onclick = function () { if (S.done[k]) delete S.done[k]; else S.done[k] = true; save(); setDoneBtn(b, !!S.done[k]); toast(S.done[k] ? 'দারুণ! ✓ (আবার চাপলে চিহ্ন উঠে যাবে)' : 'চিহ্ন সরানো হলো'); };
      requestAnimationFrame(function () {
        if (sec && document.getElementById(sec)) document.getElementById(sec).scrollIntoView();
        else if (resume && S.scroll[k]) { scrollTo(0, S.scroll[k]); toast('আগের জায়গা থেকে শুরু হলো ↩'); }
        else scrollTo(0, 0);
        persistPos();
      });
    });
  }
  function renderStars() {
    view = null; $('#readbar').style.width = '0';
    var list = Object.keys(S.stars).map(function (k) { return S.stars[k]; }).sort(function (a, b) { return b.at - a.at; });
    var h = '<div class="page stars"><h1 class="chapter"><span class="num">★ ' + bn(list.length) + 'টি শব্দ</span>আমার শব্দ<span class="de">Meine Wörter</span></h1>';
    if (!list.length) h += '<p class="empty">এখনো কোনো শব্দ নেই।<br>শব্দভান্ডারের যেকোনো সারির ☆ চাপলে শব্দটি এখানে জমা হবে।</p>';
    else {
      h += '<p class="small">শব্দে চাপ দিয়ে শুনুন। ★ চাপলে তালিকা থেকে সরে যাবে।</p><table class="voc"><tbody>';
      list.forEach(function (w) { h += '<tr><td class="de say" data-a="' + esc(w.a) + '" data-t="' + esc(w.t) + '">' + w.html + '</td><td class="pr">' + esc(w.pr) + '</td><td class="bn">' + esc(w.bn) + '<button class="star on" type="button">★</button></td></tr>'; });
      h += '</tbody></table><p><button class="donebtn" id="playAll" type="button">▶ সবগুলো পরপর শুনুন</button></p>';
    }
    app.innerHTML = h + '</div>'; scrollTo(0, 0);
    var pa = $('#playAll');
    if (pa) pa.onclick = function () {
      var els = $$('#app td.say'), i = 0;
      (function nxt() { if (i >= els.length || location.hash !== '#/stars') return; var el = els[i++]; play(el); var iv = setInterval(function () { if (!el.classList.contains('playing')) { clearInterval(iv); setTimeout(nxt, 600); } }, 200); })();
    };
  }

  /* ---------- router ---------- */
  var firstLoad = true;
  function route() {
    closeDrawer(); persistPos();
    var hsh = location.hash.replace(/^#\/?/, ''), parts = hsh.split('/').filter(Boolean);
    var resume = false;
    if (firstLoad && !parts.length && S.last) { firstLoad = false; history.replaceState(null, '', '#/' + S.last.level + '/' + S.last.ch); parts = [S.last.level, S.last.ch]; resume = true; }
    else if (firstLoad && parts.length === 2) resume = true;
    firstLoad = false;
    if (route.resumeNext) { resume = true; route.resumeNext = false; }
    if (!parts.length) return renderHome();
    if (parts[0] === 'stars') return renderStars();
    if (parts.length === 1) return renderLevel(parts[0]);
    renderChapter(parts[0], parts[1], parts[2], resume);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-resume], .chlist a');
    if (a) route.resumeNext = true;
  }, true);
  window.addEventListener('hashchange', route);
  updateStarCount(); setRateBtn();
  getLevel((S.last && S.last.level) || 'a1').then(route);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
})();
