/* Deutsch kompakt — tiny static SPA. Routes: #/ (home), #/<level>, #/<level>/<chapter>[/<section>], #/stars, #/practice */
(function () {
  'use strict';
  var KEY = 'dk.v1';
  var S = load();
  if (!S.v || S.v < 2) { // v1 auto-marked chapters done just by opening them; clear those unreliable marks once
    if (Object.keys(S.done || {}).length) { S.done = {}; setTimeout(function () { toast('আগের ভুল ✓ চিহ্নগুলো মুছে দেওয়া হয়েছে। এখন শুধু "অধ্যায় শেষ" বোতামে ✓ লাগবে।', 5000); }, 800); }
    S.v = 2; saveLocal();
  }
  S.lastBy = S.lastBy || {};
  function load() { try { return Object.assign({ last: null, done: {}, stars: {}, rate: 1, scroll: {} }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { last: null, done: {}, stars: {}, rate: 1, scroll: {} }; } }
  function save() { var ch = stamp(); saveLocal(); if (ch) scheduleSync(); }
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
  function setDoneBtn(b, on) { b.classList.toggle('on', on); b.textContent = on ? '✓ অধ্যায় শেষ (চাপলে চিহ্ন উঠবে)' : 'অধ্যায় শেষ ✓ চিহ্ন দিন'; }

  /* ---------- drawer ---------- */
  function openDrawer() {
    var lv = (view && view.level) || (S.last && S.last.level) || 'a1';
    getLevel(lv).then(function (L) {
      var d = $('#drawer');
      var h = '<h3>অধ্যায়সমূহ · Inhalt</h3><div class="lv">' + window.LEVELS.map(function (l) {
        return l.ready ? '<a href="#/' + l.id + '" class="' + (l.id === lv ? 'cur' : '') + '">' + l.title + '</a>' : '<span>' + l.title + ' <small>শীঘ্রই</small></span>';
      }).join('') + '<a href="#/">হোম</a><a href="#/stars">★ আমার শব্দ</a><a href="#/practice" class="prk">🃏 শব্দ অনুশীলন</a></div>' + userBlockHTML() + '<ul>';
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
      h += '<div class="page">' + userBlockHTML() + practiceTile() + '<div class="sec-title">স্তর · Niveau</div><div class="levels">' + window.LEVELS.map(function (l) {
        return l.ready ? '<a class="' + (l.id === lv ? 'cur' : 'rdy') + '" href="#/' + l.id + '"><b>' + l.title + '</b><small>' + (l.id === lv ? 'এখন পড়ছেন' : 'চালু আছে') + '</small></a>' : '<div class="soon"><b>' + l.title + '</b><small>শীঘ্রই আসছে</small></div>';
      }).join('') + '</div>';
      h += chapterList(L, lv, p) + '</div>';
      app.innerHTML = h; app.setAttribute('data-view', 'home'); scrollTo(0, 0);
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
      app.innerHTML = '<div class="page">' + continueHTML(lv) + practiceTile() + chapterList(L, lv, levelProgress(L, lv)) + '</div>'; app.setAttribute('data-view', lv); scrollTo(0, 0);
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
    app.innerHTML = h + '</div>'; app.setAttribute('data-view', 'stars'); scrollTo(0, 0);
    var pa = $('#playAll');
    if (pa) pa.onclick = function () {
      var els = $$('#app td.say'), i = 0;
      (function nxt() { if (i >= els.length || location.hash !== '#/stars') return; var el = els[i++]; play(el); var iv = setInterval(function () { if (!el.classList.contains('playing')) { clearInterval(iv); setTimeout(nxt, 600); } }, 200); })();
    };
  }

  /* ---------- username login + cloud sync (Supabase PostgREST, plain fetch) ---------- */
  var SB_URL = 'https://npmbyjqmunltxqhlserd.supabase.co', SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbWJ5anFtdW5sdHhxaGxzZXJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyNjc0NDEsImV4cCI6MjEwODg0MzQ0MX0.M-icjwR4a0Oc5mddYebYMdKjF0PaUw4ShHq0QknJPGY';
  var UKEY = 'dk.user', QKEY = 'dk.sync';
  var SYNC_KEYS = ['done', 'stars', 'last', 'lastBy', 'scroll', 'rate', 'prac'];
  var USER = (function () { try { return JSON.parse(localStorage.getItem(UKEY) || 'null'); } catch (e) { return null; } })(); // {name} | {skip:true} | null
  var SNAP = {}; snapshot();
  function snapshot() { SYNC_KEYS.forEach(function (k) { SNAP[k] = JSON.stringify(S[k] === undefined ? null : S[k]); }); }
  function stamp() { // record per-key change times (and per-entry times for done/stars, so un-ticks survive a merge)
    var now = Date.now(); S._t = S._t || {}; S._m = S._m || {}; var changed = false;
    SYNC_KEYS.forEach(function (k) {
      var j = JSON.stringify(S[k] === undefined ? null : S[k]);
      if (j === SNAP[k]) return;
      changed = true; S._t[k] = now;
      if (k === 'done' || k === 'stars') {
        var old = JSON.parse(SNAP[k] || 'null') || {}, cur = S[k] || {};
        Object.keys(old).concat(Object.keys(cur)).forEach(function (x) { if ((x in old) !== (x in cur)) S._m[k + ':' + x] = now; });
      }
      SNAP[k] = j;
    });
    return changed;
  }
  function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function blob() { var b = { v: S.v, _t: S._t || {}, _m: S._m || {} }; SYNC_KEYS.forEach(function (k) { b[k] = S[k]; }); return b; }
  function hasData(d) { return !!d && (Object.keys(d.done || {}).length || Object.keys(d.stars || {}).length || d.last || Object.keys((d.prac || {}).srs || {}).length); }
  function mergeState(L, R) { // L = local, R = remote; returns merged blob
    var out = { v: Math.max(L.v || 0, R.v || 0), _t: {}, _m: {} }, Lt = L._t || {}, Rt = R._t || {}, Lm = L._m || {}, Rm = R._m || {};
    ['done', 'stars'].forEach(function (k) { // per entry: the side that changed it last wins; otherwise union
      var a = L[k] || {}, b = R[k] || {}, o = {};
      Object.keys(a).concat(Object.keys(b)).concat(Object.keys(Lm).concat(Object.keys(Rm)).filter(function (m) { return m.indexOf(k + ':') === 0; }).map(function (m) { return m.slice(k.length + 1); }))
        .forEach(function (x) {
          var tl = Lm[k + ':' + x] || 0, tr = Rm[k + ':' + x] || 0, inA = x in a, inB = x in b, keep, val;
          if (tl > tr) { keep = inA; val = a[x]; } else if (tr > tl) { keep = inB; val = b[x]; } else { keep = inA || inB; val = inA ? a[x] : b[x]; }
          if (keep) o[x] = val;
          var t = Math.max(tl, tr); if (t) out._m[k + ':' + x] = t;
        });
      out[k] = o;
    });
    var lb = {}; [L.lastBy || {}, R.lastBy || {}].forEach(function (m) { Object.keys(m).forEach(function (lv) { if (!lb[lv] || (m[lv] && (m[lv].at || 0) > (lb[lv].at || 0))) lb[lv] = m[lv]; }); });
    out.lastBy = lb;
    out.last = !L.last ? R.last : !R.last ? L.last : ((L.last.at || 0) >= (R.last.at || 0) ? L.last : R.last);
    ['scroll', 'rate'].forEach(function (k) { out[k] = (Lt[k] || 0) >= (Rt[k] || 0) ? (k in L ? L[k] : R[k]) : (k in R ? R[k] : L[k]); });
    out.scroll = Object.assign({}, (Lt.scroll || 0) >= (Rt.scroll || 0) ? R.scroll : L.scroll, out.scroll || {});
    var pl = L.prac || {}, pr = R.prac || {}, newer = (Lt.prac || 0) >= (Rt.prac || 0) ? pl : pr, older = newer === pl ? pr : pl;
    var prac = Object.assign({}, older, newer), srs = {}, sl = pl.srs || {}, sr = pr.srs || {};
    Object.keys(sl).concat(Object.keys(sr)).forEach(function (id) { var a = sl[id], b = sr[id]; srs[id] = !a ? b : !b ? a : ((a.at || 0) >= (b.at || 0) ? a : b); });
    prac.srs = srs;
    var nl = pl.nd || {}, nr = pr.nd || {}; if (nl.day && nl.day === nr.day) prac.nd = { day: nl.day, n: Math.max(nl.n || 0, nr.n || 0) };
    if (pl.srs || pr.srs || pl.dir || pr.dir) out.prac = prac;
    SYNC_KEYS.forEach(function (k) { var t = Math.max(Lt[k] || 0, Rt[k] || 0); if (t) out._t[k] = t; });
    return out;
  }
  function applyBlob(b) { SYNC_KEYS.forEach(function (k) { if (b[k] !== undefined) S[k] = b[k]; }); S._t = b._t; S._m = b._m; S.v = Math.max(S.v || 0, b.v || 0); S.lastBy = S.lastBy || {}; S.done = S.done || {}; S.stars = S.stars || {}; S.scroll = S.scroll || {}; snapshot(); saveLocal(); }
  function hdrs(extra) { return Object.assign({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }, extra || {}); }
  function sbGet(name) {
    return fetch(SB_URL + '/rest/v1/progress?username=eq.' + encodeURIComponent(name) + '&select=data,updated_at', { headers: hdrs(), cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (rows) { return rows && rows[0] ? rows[0].data : null; });
  }
  function sbPut(name, data, keepalive) {
    return fetch(SB_URL + '/rest/v1/progress', { method: 'POST', keepalive: !!keepalive, cache: 'no-store',
      headers: hdrs({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([{ username: name, data: data, updated_at: new Date().toISOString() }]) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); });
  }
  var syncState = 'idle', syncT = null, syncing = null;
  function setDirty(v) { try { if (v) localStorage.setItem(QKEY, JSON.stringify({ dirty: true, at: Date.now() })); else localStorage.removeItem(QKEY); } catch (e) {} }
  function isDirty() { try { return !!JSON.parse(localStorage.getItem(QKEY) || 'null'); } catch (e) { return false; } }
  function setSyncState(s) { syncState = s; window.__sync = { state: s, user: USER && USER.name, dirty: isDirty() }; $$('.syncst').forEach(function (e) { e.textContent = syncLabel(); }); }
  function syncLabel() { return { idle: '☁ সিঙ্ক হয়েছে', saving: '☁ সিঙ্ক হচ্ছে…', offline: '☁ অফলাইন — পরে সিঙ্ক হবে', error: '☁ সিঙ্ক হয়নি — আবার চেষ্টা হবে' }[syncState] || ''; }
  function scheduleSync() { if (!USER || !USER.name) return; setDirty(true); clearTimeout(syncT); syncT = setTimeout(syncNow, 2000); }
  function syncNow() { // pull -> merge -> push (so changes from another device are never overwritten)
    if (!USER || !USER.name) return Promise.resolve();
    if (syncing) return syncing;
    clearTimeout(syncT);
    if (navigator.onLine === false) { setSyncState('offline'); return Promise.resolve(); }
    var name = USER.name; setSyncState('saving');
    syncing = sbGet(name).then(function (remote) {
      var before = JSON.stringify(blob());
      if (remote && hasData(remote)) applyBlob(mergeState(blob(), remote));
      var changedUI = JSON.stringify(blob()) !== before;
      return sbPut(name, blob()).then(function () { setDirty(false); setSyncState('idle'); return changedUI; });
    }).catch(function (e) { setDirty(true); setSyncState(navigator.onLine === false ? 'offline' : 'error'); throw e; })
      .finally(function () { syncing = null; });
    return syncing.catch(function () {});
  }
  function flushOnHide() { if (USER && USER.name && isDirty() && navigator.onLine !== false) sbPut(USER.name, blob(), true).then(function () { setDirty(false); }).catch(function () {}); }
  window.addEventListener('online', function () { if (USER && USER.name && isDirty()) syncNow(); });
  window.addEventListener('offline', function () { if (USER && USER.name) setSyncState('offline'); });
  setInterval(function () { if (USER && USER.name && isDirty()) syncNow(); }, 30000);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { persistPos(); flushOnHide(); }
    else if (USER && USER.name) syncNow().then(function (ch) { if (ch && !view) route(); });
  });
  window.addEventListener('pagehide', function () { persistPos(); flushOnHide(); });
  function normName(s) { return String(s || '').trim().toLowerCase(); }
  function validName(s) { return /^[a-z0-9_.-]{3,30}$/.test(s); }
  function doLogin(name) {
    var btn = $('#loginGo'); if (btn) { btn.disabled = true; btn.textContent = 'অপেক্ষা করুন…'; }
    var finish = function (msg) { USER = { name: name }; localStorage.setItem(UKEY, JSON.stringify(USER)); toast(msg, 3500); afterLogin(); };
    if (navigator.onLine === false) { setDirty(true); setSyncState('offline'); return finish('👤 ' + name + ' — অফলাইন; নেট এলে সিঙ্ক হবে'); }
    return sbGet(name).then(function (remote) {
      if (remote && hasData(remote)) { applyBlob(mergeState(blob(), remote)); return sbPut(name, blob()).then(function () { setDirty(false); setSyncState('idle'); finish('স্বাগতম, ' + name + '! আগের অগ্রগতি ফিরিয়ে আনা হয়েছে ✓'); }); }
      stamp(); saveLocal();
      return sbPut(name, blob()).then(function () { setDirty(false); setSyncState('idle'); finish(hasData(blob()) ? 'স্বাগতম, ' + name + '! এই ফোনের অগ্রগতি ক্লাউডে রাখা হলো ✓' : 'স্বাগতম, ' + name + '! নতুন খাতা খোলা হলো ✓'); });
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'প্রবেশ করুন →'; }
      var er = $('#loginErr'); if (er) { er.textContent = 'সার্ভারে পৌঁছানো গেল না। নেট দেখে আবার চেষ্টা করুন, অথবা লগইন ছাড়াই চালিয়ে যান।'; er.hidden = false; }
    });
  }
  function afterLogin() {
    firstLoad = true; PS = null;
    if (S.last) { history.replaceState(null, '', '#/'); }
    updateStarCount(); setRateBtn(); updateUserPill();
    getLevel((S.last && S.last.level) || 'a1').then(route);
  }
  function logout() {
    if (!USER || !USER.name) { localStorage.removeItem(UKEY); USER = null; return route(); }
    var go = function () {
      localStorage.removeItem(UKEY); localStorage.removeItem(KEY); setDirty(false); USER = null; PS = null;
      S = Object.assign({ v: 2, last: null, done: {}, stars: {}, rate: 1, scroll: {}, lastBy: {} }); snapshot(); saveLocal();
      updateStarCount(); setRateBtn(); updateUserPill(); location.hash = '#/login'; route();
    };
    syncNow().then(function () {
      if (isDirty() && !confirm('শেষ পরিবর্তনগুলো এখনো ক্লাউডে যায়নি (অফলাইন)। তবুও লগআউট করবেন? এই ফোনের অসিঙ্ক অগ্রগতি মুছে যাবে।')) return;
      go();
    });
  }
  function updateUserPill() { var b = $('#userPill'); if (!b) return; b.hidden = !(USER && USER.name); if (USER && USER.name) b.textContent = '👤 ' + USER.name; }
  function userBlockHTML() {
    if (USER && USER.name) return '<div class="userbox">👤 <b>' + esc(USER.name) + '</b> <span class="syncst">' + syncLabel() + '</span><br><a href="#" data-logout="1">লগআউট / অন্য নাম</a> · <a href="#" data-syncnow="1">এখনই সিঙ্ক</a></div>';
    return '<div class="userbox">লগইন ছাড়া (শুধু এই ফোনে সংরক্ষিত) · <a href="#/login">নাম দিয়ে লগইন করুন</a></div>';
  }
  function renderLogin() {
    view = null; $('#readbar').style.width = '0';
    app.innerHTML = '<div class="page login"><h1 class="chapter"><span class="num">👤 লগইন · Anmelden</span>আপনার নাম লিখুন<span class="de">Ihr Name</span></h1>' +
      '<p>একটি নাম দিন (যেমন <b class="de">sohan</b>)। একই নাম দিয়ে অন্য ফোন বা কম্পিউটারে ঢুকলে আপনার শেষ করা অধ্যায়, পড়ার জায়গা, ★ শব্দ আর অনুশীলনের অগ্রগতি সেখানেও পাবেন।</p>' +
      '<form id="loginForm" autocomplete="off"><input id="loginName" type="text" inputmode="text" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="30" placeholder="যেমন: sohan" value="' + esc(USER && USER.name || '') + '">' +
      '<button class="pbtn" id="loginGo" type="submit">প্রবেশ করুন →</button></form>' +
      '<p class="loginerr" id="loginErr" hidden></p>' +
      '<p class="small">ইংরেজি ছোট হাতের অক্ষর, সংখ্যা, _ . - (৩–৩০ অক্ষর)। পাসওয়ার্ড নেই, তাই নামটা একটু আলাদা রাখুন (যেমন sohan.rahman); যে নামটা জানে, সে অগ্রগতি দেখতে পারবে।</p>' +
      '<button class="pbtn alt" id="loginSkip" type="button">লগইন ছাড়াই চালিয়ে যান</button><p class="small center">তখন অগ্রগতি শুধু এই ফোনে থাকবে, আগের মতোই।</p></div>';
    app.setAttribute('data-view', 'login');
    var inp = $('#loginName');
    $('#loginForm').onsubmit = function (e) {
      e.preventDefault(); var n = normName(inp.value);
      if (!validName(n)) { var er = $('#loginErr'); er.textContent = 'নামটা ৩–৩০ অক্ষরের হতে হবে: a-z, 0-9, _ . -'; er.hidden = false; return; }
      doLogin(n);
    };
    $('#loginSkip').onclick = function () { USER = { skip: true }; localStorage.setItem(UKEY, JSON.stringify(USER)); if (location.hash === '#/login') location.hash = '#/'; else route(); };
    setTimeout(function () { inp.focus(); }, 50);
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-logout],[data-syncnow]');
    if (!t) return; e.preventDefault(); closeDrawer();
    if (t.hasAttribute('data-logout')) logout(); else syncNow().then(function () { toast(syncLabel()); });
  });
  /* ---------- word practice (flashcards + spaced repetition) ---------- */
  var DAY = 864e5, STEPS = [1, 3, 7, 16, 35, 75, 150, 300];
  function P() {
    S.prac = Object.assign({ dir: 'de', phr: false, st: true, ex: {}, newPerDay: 20, nd: { day: '', n: 0 }, srs: {} }, S.prac || {});
    return S.prac;
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function endOfDay() { var d = new Date(); d.setHours(23, 59, 59, 999); return +d; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var chCards = {};
  // Which tables count as real word lists: every vocabulary table (table.voc), plus A1's number / clock-time /
  // weekday-month / date word tables (by table index in that chapter). Pronunciation drills (A1 ch2) never count.
  var WORD_TABLES = { 'a1/ch3': [0, 1, 3, 4, 5, 6] }, NO_CARDS = { 'a1/ch2': 1 };
  function bnDigits(s) { return String(s).replace(/\d/g, function (d) { return BN[d]; }); }
  function chapterCards(lv, c) { // -> [{id,t,html,pr,bn,voc,src}] ; voc = from a word-list table, else example/phrase
    var k = lv + '/' + c.id;
    if (chCards[k]) return chCards[k];
    var out = [];
    if (NO_CARDS[k]) return (chCards[k] = out);
    var tpl = document.createElement('template'); tpl.innerHTML = c.html;
    var wl = WORD_TABLES[k] || [];
    $$('table', tpl.content).forEach(function (tb, ti) {
      if (tb.classList.contains('ans')) return;
      var isWord = tb.classList.contains('voc') || wl.indexOf(ti) >= 0;
      $$('tbody tr', tb).forEach(function (tr) {
        var tds = $$('td', tr);
        tds.forEach(function (de, i) { // a card = German cell + pronunciation cell (+ meaning cell, or a digit/time cell before it)
          var pr = tds[i + 1];
          if (!de.classList.contains('say') || !pr || !pr.classList.contains('pr')) return;
          var t = de.getAttribute('data-t'), b = tds[i + 2], meaning = '';
          if (b && b.classList.contains('bn')) meaning = b.textContent.trim();
          else { var prev = tds[i - 1]; if (prev && prev.classList.contains('say') && /^[\d:.,\s€]+$/.test(prev.textContent.trim())) meaning = bnDigits(prev.textContent.trim()); }
          if (!t || !meaning) return;
          out.push({ id: de.getAttribute('data-a'), t: t, html: de.innerHTML, pr: pr.textContent.trim(), bn: meaning, voc: isWord, src: lv.toUpperCase() + ' · ' + c.num });
        });
      });
    });
    return (chCards[k] = out);
  }
  function doneChapters() { // [{lv, c, key}] for chapters marked done, in level/chapter order
    var lvs = (window.LEVELS || []).filter(function (l) { return l.ready && Object.keys(S.done).some(function (k) { return k.indexOf(l.id + '/') === 0; }); });
    return Promise.all(lvs.map(function (l) { return getLevel(l.id); })).then(function (Ls) {
      var res = [];
      Ls.forEach(function (L, i) { if (L) L.chapters.forEach(function (c) { var k = chKey(lvs[i].id, c.id); if (S.done[k]) res.push({ lv: lvs[i].id, c: c, key: k }); }); });
      return res;
    });
  }
  function buildPool(chs) {
    var p = P(), seen = {}, pool = [];
    function add(card) { if (!card.id || seen[card.id]) return; seen[card.id] = 1; pool.push(card); }
    chs.forEach(function (x) { if (p.ex[x.key]) return; chapterPick(x).forEach(add); });
    if (p.st) Object.keys(S.stars).forEach(function (k) { var w = S.stars[k]; add({ id: w.a, t: w.t, html: w.html, pr: w.pr, bn: String(w.bn || '').replace(/[☆★]\s*$/, '').trim(), voc: true, src: '★ আমার শব্দ' }); });
    return pool;
  }
  function chapterPick(x) { // word-list cards only, unless "sentences too" is switched on
    return chapterCards(x.lv, x.c).filter(function (c) { return c.voc || P().phr; });
  }
  function isDue(id, now) { var r = P().srs[id]; return r && r.due <= now; }
  function stats(pool) {
    var s = P().srs, e = endOfDay(), st = { due: 0, learned: 0, hard: 0, fresh: 0 };
    pool.forEach(function (c) { var r = s[c.id]; if (!r) { st.fresh++; return; } if (r.due <= e) st.due++; if (r.last === 'e') st.learned++; else st.hard++; });
    return st;
  }
  function newLeft() { var p = P(); if (p.nd.day !== today()) p.nd = { day: today(), n: 0 }; return Math.max(0, p.newPerDay - p.nd.n); }
  function grade(card, easy, randomMode) {
    var p = P(), r = p.srs[card.id], now = Date.now();
    if (!r) { if (p.nd.day !== today()) p.nd = { day: today(), n: 0 }; p.nd.n++; }
    if (easy) {
      if (r && r.due > now && randomMode) { /* practised early: keep its schedule */ }
      else { var n = (r && r.last === 'e') ? Math.min((r.n || 0) + 1, STEPS.length - 1) : 0; p.srs[card.id] = { n: n, due: now + STEPS[n] * DAY, last: 'e', h: r ? r.h || 0 : 0, at: now }; }
    } else {
      p.srs[card.id] = { n: -1, due: now + 10 * 60 * 1000, last: 'h', h: (r ? r.h || 0 : 0) + 1, at: now };
    }
    save();
  }
  var PS = null; // session state
  function startSession(pool, randomMode) {
    var now = Date.now(), due = [], fresh = [];
    pool.forEach(function (c) { var r = P().srs[c.id]; if (!r) fresh.push(c); else if (r.due <= now) due.push(c); });
    var q;
    if (randomMode) q = shuffle(pool.slice()).slice(0, 20);
    else {
      shuffle(due); fresh = shuffle(fresh).slice(0, newLeft());
      q = []; while (due.length || fresh.length) { // random mix of due + new
        var pick = !fresh.length ? due : !due.length ? fresh : (Math.random() < due.length / (due.length + fresh.length) ? due : fresh);
        q.push(pick.shift());
      }
    }
    PS = { pool: pool, q: q, i: 0, shown: false, n: 0, easy: 0, hard: 0, rnd: !!randomMode };
  }
  function renderPractice() {
    view = null; $('#readbar').style.width = '0';
    var p = P();
    doneChapters().then(function (chs) {
      var pool = buildPool(chs);
      if (!PS || PS.key !== poolKey(pool)) { startSession(pool, false); PS.key = poolKey(pool); }
      drawPractice(chs);
      scrollTo(0, 0);
    });
  }
  function poolKey(pool) { return pool.length + ':' + (pool[0] ? pool[0].id : '') + ':' + (pool[pool.length - 1] ? pool[pool.length - 1].id : ''); }
  function drawPractice(chs) {
    var p = P(), pool = PS.pool, st = stats(pool);
    window.__pracPool = pool.map(function (c) { return c.id; });
    var h = '<div class="page prac"><h1 class="chapter"><span class="num">🃏 ' + bn(pool.length) + 'টি শব্দ</span>শব্দ অনুশীলন<span class="de">Wörter üben</span></h1>';
    h += '<div class="pstats"><div><b>' + bn(st.due) + '</b><small>আজ বাকি</small></div><div><b>' + bn(st.learned) + '</b><small>শেখা (সহজ)</small></div><div><b>' + bn(st.hard) + '</b><small>কঠিন</small></div><div><b>' + bn(st.fresh) + '</b><small>নতুন</small></div></div>';
    h += '<div class="seg" role="group"><button type="button" data-dir="de" class="' + (p.dir === 'de' ? 'on' : '') + '">জার্মান → বাংলা<small>Deutsch zeigen</small></button><button type="button" data-dir="bn" class="' + (p.dir === 'bn' ? 'on' : '') + '">বাংলা → জার্মান<small>Bangla zeigen</small></button></div>';
    if (!pool.length) {
      if (chs.length) h += '<div class="pempty"><p><b>বাছাই করা অধ্যায়ে অনুশীলনের শব্দ নেই।</b></p><p>উচ্চারণ, ব্যাকরণ বা সংলাপের অধ্যায়ে শব্দতালিকা থাকে না। নিচের তালিকায় "বাক্য ও উদাহরণও রাখুন" চালু করুন, অথবা শব্দভান্ডারের অধ্যায় (যেমন A1 অধ্যায় ৫) শেষ করুন। কোনো অধ্যায়ে টিক না থাকলে সেটাও দিন।</p></div>'; else
      h += '<div class="pempty"><p><b>এখনো অনুশীলনের শব্দ নেই।</b></p><p>যে অধ্যায় পড়া শেষ, সেটার নিচে <b>"অধ্যায় শেষ ✓"</b> বোতাম চাপুন। সেই অধ্যায়ের শব্দগুলো এখানে চলে আসবে।</p><p>অথবা শব্দভান্ডারের যেকোনো শব্দের ☆ চাপুন; "আমার শব্দ"-ও এখানে অনুশীলন করা যায়।</p>' +
        '<a class="continue" href="#/' + ((S.last && S.last.level) || 'a1') + '">অধ্যায় তালিকায় যান →</a></div>';
    } else if (PS.i >= PS.q.length) {
      var dueNow = pool.filter(function (c) { return isDue(c.id, Date.now()); }).length;
      h += '<div class="pempty"><p class="big">🎉</p><p><b>' + (PS.n ? 'এই সেশন শেষ! ' + bn(PS.n) + 'টি কার্ড (সহজ ' + bn(PS.easy) + ' · কঠিন ' + bn(PS.hard) + ')' : 'আজকের সব শব্দ অনুশীলন হয়ে গেছে!') + '</b></p>' +
        (newLeft() === 0 && st.fresh ? '<p class="small">আজকের নতুন শব্দের সীমা (' + bn(p.newPerDay) + 'টি) শেষ। কাল আরও আসবে, বা নিচে সীমা বাড়ান।</p>' : '') +
        '<p class="small">কঠিন শব্দগুলো ১০ মিনিট পরে আবার আসবে; সহজগুলো ১, ৩, ৭, ১৬, ৩৫… দিন পরে।</p>' +
        (dueNow || (newLeft() && st.fresh) ? '<button class="pbtn" id="pAgain" type="button">আবার শুরু করুন (' + bn(dueNow) + 'টি বাকি)</button>' : '') +
        '<button class="pbtn alt" id="pRandom" type="button">তবুও অনুশীলন করুন (এলোমেলো ২০টি)</button></div>';
    } else {
      var c = PS.q[PS.i], de = '<div class="pde"><span class="say" data-a="' + esc(c.id) + '" data-t="' + esc(c.t) + '">' + c.html + '</span></div>';
      var bnHtml = '<div class="pbn">' + esc(c.bn) + '</div>', prHtml = '<div class="ppr">' + esc(c.pr) + '</div>';
      h += '<div class="psess">' + (PS.rnd ? 'এলোমেলো · ' : '') + 'কার্ড ' + bn(PS.i + 1) + '/' + bn(PS.q.length) + ' · এই সেশনে ' + bn(PS.n) + ' (সহজ ' + bn(PS.easy) + ' · কঠিন ' + bn(PS.hard) + ')</div>';
      h += '<div class="fcard' + (PS.shown ? ' shown' : '') + '" id="fcard"><div class="psrc">' + esc(c.src) + (P().srs[c.id] ? '' : ' · <i>নতুন</i>') + '</div>';
      h += '<div class="pfront">' + (p.dir === 'de' ? de : bnHtml) + '</div>';
      if (PS.shown) h += '<div class="pback">' + (p.dir === 'de' ? prHtml + bnHtml : de + prHtml) + '</div>';
      h += '</div>';
      h += PS.shown ? '<div class="pgrade"><button type="button" class="hard" id="pHard">কঠিন<small>Schwer · শিগগির আবার</small></button><button type="button" class="easy" id="pEasy">সহজ<small>Leicht · অনেক পরে</small></button></div><p class="small center">কার্ড বাঁয়ে সরালে কঠিন, ডানে সরালে সহজ।</p>'
        : '<button type="button" class="pbtn" id="pShow">উত্তর দেখুন</button>' + (p.dir === 'de' ? '<p class="small center">জার্মান শব্দে চাপ দিলে উচ্চারণ শুনবেন।</p>' : '');
    }
    h += '<details class="psrcs"' + (pool.length ? '' : ' open') + '><summary>কোন অধ্যায়ের শব্দ? (' + bn(chs.filter(function (x) { return !p.ex[x.key]; }).length) + 'টি অধ্যায়)</summary>';
    if (!chs.length) h += '<p class="small">এখনো কোনো অধ্যায় "শেষ" চিহ্নিত নয়।</p>';
    chs.forEach(function (x) { var n = chapterPick(x).length;
      h += '<label><input type="checkbox" data-ch="' + x.key + '"' + (p.ex[x.key] ? '' : ' checked') + '> ' + x.lv.toUpperCase() + ' · ' + esc(x.c.num) + ' — ' + esc(x.c.title) + ' <small>(' + bn(n) + ')</small></label>'; });
    h += '<label><input type="checkbox" id="pSt"' + (p.st ? ' checked' : '') + '> ★ আমার শব্দ <small>(' + bn(Object.keys(S.stars).length) + ')</small></label>';
    h += '<label><input type="checkbox" id="pPhr"' + (p.phr ? ' checked' : '') + '> শব্দতালিকার সাথে বাক্য ও উদাহরণও রাখুন <small>(ব্যাকরণ ও সংলাপ অধ্যায়ের উদাহরণ)</small></label>';
    h += '<label>দিনে নতুন শব্দ: <select id="pNew">' + [10, 20, 30, 50, 100].map(function (v) { return '<option' + (v === p.newPerDay ? ' selected' : '') + ' value="' + v + '">' + bn(v) + '</option>'; }).join('') + '</select></label></details></div>';
    app.innerHTML = h; app.setAttribute('data-view', 'practice');
    wirePractice(chs);
  }
  function revealCard() {
    if (!PS || PS.shown || PS.i >= PS.q.length) return;
    PS.shown = true; drawPractice(PS.chs);
    var s = $('#fcard .say'); if (s) play(s);
  }
  function answer(easy) {
    var c = PS.q[PS.i]; if (!c || !PS.shown) return;
    grade(c, easy, PS.rnd);
    PS.n++; if (easy) PS.easy++; else { PS.hard++; var pos = Math.min(PS.q.length, PS.i + 3 + Math.floor(Math.random() * 3)); PS.q.splice(pos, 0, c); }
    PS.i++; PS.shown = false; drawPractice(PS.chs);
  }
  function wirePractice(chs) {
    PS.chs = chs;
    var p = P();
    $$('.seg button', app).forEach(function (b) { b.onclick = function () { p.dir = b.getAttribute('data-dir'); save(); PS.shown = false; drawPractice(chs); }; });
    var rebuild = function () { save(); var pool = buildPool(chs); startSession(pool, false); PS.key = poolKey(pool); drawPractice(chs); };
    $$('input[data-ch]', app).forEach(function (i) { i.onchange = function () { if (i.checked) delete p.ex[i.getAttribute('data-ch')]; else p.ex[i.getAttribute('data-ch')] = true; rebuild(); $('details.psrcs').open = true; }; });
    if ($('#pSt')) $('#pSt').onchange = function () { p.st = this.checked; rebuild(); $('details.psrcs').open = true; };
    if ($('#pPhr')) $('#pPhr').onchange = function () { p.phr = this.checked; rebuild(); $('details.psrcs').open = true; };
    if ($('#pNew')) $('#pNew').onchange = function () { p.newPerDay = +this.value; rebuild(); $('details.psrcs').open = true; };
    if ($('#pShow')) $('#pShow').onclick = revealCard;
    if ($('#pEasy')) $('#pEasy').onclick = function () { answer(true); };
    if ($('#pHard')) $('#pHard').onclick = function () { answer(false); };
    if ($('#pAgain')) $('#pAgain').onclick = function () { var k = PS.key; startSession(PS.pool, false); PS.key = k; drawPractice(chs); };
    if ($('#pRandom')) $('#pRandom').onclick = function () { var k = PS.key; startSession(PS.pool, true); PS.key = k; drawPractice(chs); };
    var card = $('#fcard'); if (!card) return;
    card.addEventListener('click', function (e) { if (!e.target.closest('.say')) revealCard(); });
    var x0 = null, y0 = null;
    card.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    card.addEventListener('touchmove', function (e) { if (x0 === null || !PS.shown) return; var dx = e.touches[0].clientX - x0; card.style.transform = 'translateX(' + dx + 'px) rotate(' + dx / 30 + 'deg)'; }, { passive: true });
    card.addEventListener('touchend', function (e) {
      if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null; card.style.transform = '';
      if (PS.shown && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) answer(dx > 0);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (location.hash !== '#/practice' || !PS || e.target.closest('input,select')) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!PS.shown) revealCard(); }
    else if (PS.shown && (e.key === '1' || e.key === 'ArrowLeft')) answer(false);
    else if (PS.shown && (e.key === '2' || e.key === 'ArrowRight')) answer(true);
  });
  function practiceTile() {
    return '<a class="praclink" href="#/practice"><b>🃏 শব্দ অনুশীলন</b><small>Wörter üben · শেষ করা অধ্যায়ের শব্দ ফ্ল্যাশকার্ডে, সহজ/কঠিন চিহ্ন দিয়ে</small></a>';
  }

  /* ---------- router ---------- */
  var firstLoad = true;
  function route() {
    closeDrawer(); persistPos();
    var hsh = location.hash.replace(/^#\/?/, ''), parts = hsh.split('/').filter(Boolean);
    if (parts[0] === 'login' || !USER) return renderLogin();
    var resume = false;
    if (firstLoad && !parts.length && S.last) { firstLoad = false; history.replaceState(null, '', '#/' + S.last.level + '/' + S.last.ch); parts = [S.last.level, S.last.ch]; resume = true; }
    else if (firstLoad && parts.length === 2) resume = true;
    firstLoad = false;
    if (route.resumeNext) { resume = true; route.resumeNext = false; }
    if (!parts.length) return renderHome();
    if (parts[0] === 'stars') return renderStars();
    if (parts[0] === 'practice') return renderPractice();
    if (parts.length === 1) return renderLevel(parts[0]);
    renderChapter(parts[0], parts[1], parts[2], resume);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-resume], .chlist a');
    if (a) route.resumeNext = true;
  }, true);
  window.addEventListener('hashchange', route);
  updateStarCount(); setRateBtn(); updateUserPill(); setSyncState(isDirty() ? 'offline' : 'idle');
  if (USER && USER.name) setTimeout(syncNow, 300);
  getLevel((S.last && S.last.level) || 'a1').then(route);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
})();
