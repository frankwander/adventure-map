/* Adventure Map — shared logic for the three pages. No build step, no server. */
(function () {
  "use strict";
  var PLACES = (window.PLACES || []).slice();
  var BY_ID = {};
  PLACES.forEach(function (p) { BY_ID[p.id] = p; });
  // (hood labels are filled in once distM exists, below)

  // Neighbourhood starting points (approximate centres) for people who don't share location.
  var PRESETS = [
    { id: "camberwell", label: "Camberwell", lat: 51.4741, lon: -0.0930 },
    { id: "peckham", label: "Peckham", lat: 51.4734, lon: -0.0690 },
    { id: "walworth", label: "Walworth", lat: 51.4880, lon: -0.0930 },
    { id: "bermondsey", label: "Bermondsey", lat: 51.4980, lon: -0.0640 },
    { id: "east-dulwich", label: "East Dulwich", lat: 51.4590, lon: -0.0720 },
    { id: "borough", label: "Borough", lat: 51.5010, lon: -0.0930 },
    { id: "rotherhithe", label: "Rotherhithe", lat: 51.4990, lon: -0.0500 },
    { id: "nunhead", label: "Nunhead", lat: 51.4660, lon: -0.0560 }
  ];
  // Neighbourhood centres used to label places ("Sumner Park Playground · Peckham").
  var HOODS = PRESETS.map(function (p) { return { label: p.label, lat: p.lat, lon: p.lon }; }).concat([
    { label: "Elephant & Castle", lat: 51.4946, lon: -0.1001 },
    { label: "Dulwich", lat: 51.4450, lon: -0.0860 },
    { label: "Honor Oak", lat: 51.4500, lon: -0.0450 },
    { label: "Canada Water", lat: 51.4980, lon: -0.0500 },
    { label: "Old Kent Road", lat: 51.4830, lon: -0.0700 },
    { label: "Bankside", lat: 51.5070, lon: -0.1010 },
    { label: "Herne Hill", lat: 51.4530, lon: -0.1020 },
    { label: "Kennington", lat: 51.4840, lon: -0.1080 },
    { label: "Surrey Quays", lat: 51.4930, lon: -0.0470 },
    { label: "Crystal Palace", lat: 51.4250, lon: -0.0760 }
  ]);
  function nearestHood(pt) {
    var best = null, bd = Infinity;
    HOODS.forEach(function (h) { var d = distM(pt, h); if (d < bd) { bd = d; best = h; } });
    return best ? best.label : "";
  }
  var AGE_BANDS = {
    any: null,
    "0-2": [0, 2], "3-5": [3, 5], "6-8": [6, 8], "9-12": [9, 12]
  };

  // ---------- storage (per browser) ----------
  var KEY = "adventure-map.v1";
  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { s = null; }
    s = s || {};
    s.visited = s.visited || {};
    s.skipped = s.skipped || [];
    s.notes = s.notes || {};
    if (!Array.isArray(s.ages)) s.ages = (s.age && s.age !== "any") ? [s.age] : [];
    delete s.age;
    s.target = s.target || 4;
    return s;
  }
  var state = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: keep in memory */ } }

  // ---------- geometry ----------
  function distM(a, b) {
    var R = 6371000, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  // Walking estimate: streets add ~30% to the straight line; 80 m a minute.
  function walkMin(m) { return Math.max(1, Math.round(m * 1.3 / 80)); }
  function howFar(m) {
    var w = walkMin(m);
    if (w <= 30) return w + " min walk";
    if (m < 25000) return (m / 1000).toFixed(1) + " km · bus, train or bike";
    return Math.round(m / 1000) + " km away";
  }

  PLACES.forEach(function (p) { if (p.scope !== "far") p.hood = nearestHood(p); });

  var TYPE_LABEL = { playground: "Playground", park: "Park", nature: "Nature", farm: "City farm", museum: "Museum", water: "Splash & swim", landmark: "Landmark", activity: "Activity", library: "Library" };
  function isFar(p) { return p.scope === "far"; }
  function isOurs(p) { return !!p.review; }
  // One number to rank by: the AI Adventure Score, else our stars doubled, else a neutral 5.
  function scoreOf(p) { return p.ai ? p.ai.score : (p.review ? p.review.stars * 2 : null); }
  function rankScore(p) { var s = scoreOf(p); return s == null ? 5 : s; }

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function niceDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? (+m[3]) + " " + MONTHS[+m[2] - 1] : ""; }
  function directions(p) { return "https://www.google.com/maps/dir/?api=1&destination=" + p.lat + "," + p.lon + "&travelmode=" + (p._d && walkMin(p._d) > 30 ? "transit" : "walking"); }
  function view(p) {
    // Merge our review with this browser's own notes (notes win for empty fields).
    var n = state.notes[p.id] || {};
    return {
      age: p.age || (p.ai && p.ai.age) || n.age || null,
      standout: p.standout || (p.ai && p.ai.standout) || n.standout || null,
      extras: p.extras || (p.ai && p.ai.extras) || n.extras || null,
      mine: !!(n.age || n.standout || n.extras),
      reviewed: !!p.review
    };
  }
  // Age range for a place: from the data, else parsed from this browser's note ("3-7", "2–8", "under 5").
  function rangeOf(p) {
    if (p.ages) return p.ages;
    if (p.ai && p.ai.ages) return p.ai.ages;
    var n = (state.notes[p.id] || {}).age || "";
    var m = n.match(/(\d+)\s*[-–to]+\s*(\d+)/); if (m) return [+m[1], +m[2]];
    m = n.match(/under\s*(\d+)/i); if (m) return [0, +m[1] - 1];
    m = n.match(/(\d+)\s*\+/); if (m) return [+m[1], 14];
    return null;
  }
  // A place fits when its range covers every child's age band. Unknown ranges are kept, marked "ages unknown".
  function ageFit(p) {
    if (!state.ages.length) return "any";
    var r = rangeOf(p); if (!r) return "unknown";
    return state.ages.every(function (k) { var b = AGE_BANDS[k]; return r[0] <= b[1] && r[1] >= b[0]; }) ? "yes" : "no";
  }
  function kindLabel(p) {
    var t = TYPE_LABEL[p.type] || "Adventure";
    if (isFar(p)) return "Further afield · " + p.area;
    return (isOurs(p) ? "Our pick · " : t + " · ") + (p.hood || p.area);
  }
  var toastTimer = null;
  function toast(msg, undo) {
    var t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); document.body.appendChild(t); }
    t.innerHTML = "<span>" + esc(msg) + "</span>" + (undo ? '<button class="btn small" type="button">Undo</button>' : "");
    t.hidden = false;
    if (undo) t.querySelector("button").onclick = function () { t.hidden = true; undo(); };
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 6000);
  }
  function originLabel() { return state.origin ? state.origin.label : null; }
  function originStatus(prefix) { var o = state.origin; return o.gps ? prefix + " your location (" + o.label + ")." : prefix + " " + o.label + "."; }
  function setOrigin(o) { state.origin = o; state.skipped = []; save(); }

  function locate(statusEl, done) {
    if (!("geolocation" in navigator)) { statusEl.textContent = "This browser can't share your location. Pick a neighbourhood instead."; return; }
    statusEl.textContent = "Finding where you are…";
    navigator.geolocation.getCurrentPosition(function (pos) {
      var o = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      o.label = "near " + nearestHood(o); o.gps = true;
      setOrigin(o);
      statusEl.textContent = "Starting from your location (" + o.label + "). It stays on this device.";
      done();
    }, function () {
      statusEl.textContent = "Couldn't get your location. Pick a neighbourhood instead.";
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }
  function presetSelect(sel) {
    sel.innerHTML = '<option value="">Choose a neighbourhood…</option>' + PRESETS.map(function (p) { return '<option value="' + p.id + '">' + esc(p.label) + "</option>"; }).join("");
    var cur = state.origin && PRESETS.filter(function (p) { return p.label === state.origin.label; })[0];
    if (cur) sel.value = cur.id;
  }
  function presetById(id) { return PRESETS.filter(function (p) { return p.id === id; })[0]; }

  function withDistances(list) {
    var o = state.origin;
    return list.map(function (p) { var q = Object.assign({}, p); q._d = o ? distM(o, p) : null; return q; });
  }

  function monthCount() {
    var m = todayISO().slice(0, 7), n = 0;
    Object.keys(state.visited).forEach(function (id) { if ((state.visited[id] || "").slice(0, 7) === m) n++; });
    return n;
  }

  // ---------- Next 10 ----------
  function buildNext10() {
    var pool = withDistances(PLACES).filter(function (p) {
      return !isFar(p) && !state.visited[p.id] && state.skipped.indexOf(p.id) < 0 && ageFit(p) !== "no" && p._d <= 15000;
    });
    // Close to home: within a 30-minute walk; better-rated places get a head start worth ~150 m per score point.
    // Worth a trip: further away, best-rated first. With ages chosen, places known to fit come first.
    var fit = function (p) { return ageFit(p) === "yes" ? 1 : 0; };
    var nearKey = function (p) { return p._d - 150 * (rankScore(p) - 5); };
    var walkable = pool.filter(function (p) { return walkMin(p._d) <= 30; }).sort(function (a, b) { return fit(b) - fit(a) || nearKey(a) - nearKey(b); });
    var further = pool.filter(function (p) { return walkMin(p._d) > 30 && scoreOf(p) != null; }).sort(function (a, b) { return fit(b) - fit(a) || rankScore(b) - rankScore(a) || a._d - b._d; });
    var near = walkable.slice(0, 6);
    var away = further.slice(0, 4);
    var rest = walkable.slice(6);
    while (near.length + away.length < 10 && rest.length) near.push(rest.shift());
    return { near: near, away: away };
  }

  function cardHTML(p, i, compact) {
    var v = view(p), done = !!state.visited[p.id];
    var cls = "card " + (isOurs(p) ? "trip" : "park") + (done ? " is-done" : "");
    var facts = "";
    facts += "<dt>How far</dt><dd>" + (p._d != null ? esc(howFar(p._d)) : "Set a starting point") + "</dd>";
    var fit = ageFit(p);
    if (v.age) facts += "<dt>Ages</dt><dd>" + esc(v.age) + (p.ageFromName ? ' <span class="muted small">(from the council name)</span>' : "") + (fit === "yes" ? ' <span class="fit">fits your kids</span>' : "") + "</dd>";
    else facts += '<dt>Ages</dt><dd class="muted">Unknown</dd>';
    if (scoreOf(p) != null) facts += '<dt>Score</dt><dd><span class="score">' + scoreOf(p) + '/10</span> <span class="muted small">' + (p.ai ? "AI review" : "our stars") + "</span></dd>";
    if (v.standout) facts += "<dt>Standout</dt><dd>" + esc(v.standout) + "</dd>";
    if (v.extras) facts += "<dt>Extras</dt><dd>" + esc(v.extras) + "</dd>";
    var body = "";
    if (p.review && p.review.text) body += '<p class="quote">“' + esc(p.review.text) + '” <span class="small">— our review, ' + esc(p.review.stars) + "★</span></p>";
    if (p.ai) body += aiHTML(p);
    if (!p.review && !p.ai && !v.standout) body += '<p class="unreviewed">Not reviewed yet. ' + (compact ? "Be the first to try it." : "Go, then add a note on what made it good.") + '</p>';
    if (v.mine) body += '<p class="small muted">Includes your own notes.</p>';
    return '<li class="' + cls + '" data-id="' + p.id + '" data-n="' + i + '">' +
      '<div class="top-line"><span class="badge" aria-hidden="true">' + (done ? "✓" : i) + '</span>' +
      '<div><span class="kind">' + esc(kindLabel(p)) + "</span><h3>" + esc(p.name) + "</h3></div></div>" +
      '<dl class="facts">' + facts + "</dl>" + body +
      '<div class="actions">' +
        '<a class="btn small" href="' + directions(p) + '" target="_blank" rel="noopener">Directions</a>' +
        '<button class="btn small" type="button" data-act="went" aria-pressed="' + done + '">' + (done ? "Went " + esc(niceDate(state.visited[p.id])) + " · Undo" : "We went") + "</button>" +
        (done || compact ? "" : '<button class="btn small" type="button" data-act="swap" title="Swap for another place">Swap</button>') +
        (compact ? "" : '<button class="btn small" type="button" data-act="note" aria-expanded="false">' + (v.mine ? "Edit notes" : "Add notes") + '</button>') +
      "</div></li>";
  }

  function aiHTML(p) {
    var a = p.ai, li = function (x) { return "<li>" + esc(x) + "</li>"; };
    var more = "";
    if (a.highlights && a.highlights.length) more += "<p class=\"small\"><strong>Good</strong></p><ul>" + a.highlights.map(li).join("") + "</ul>";
    if (a.cautions && a.cautions.length) more += "<p class=\"small\"><strong>Watch out</strong></p><ul>" + a.cautions.map(li).join("") + "</ul>";
    more += "<p class=\"small\"><strong>Sources</strong></p><ul>" + (a.sources || []).map(function (s) { return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title || s.url) + "</a></li>"; }).join("") + "</ul>";
    return '<div class="ai"><p class="ai-head">AI review · ' + esc(niceDate(a.reviewedAt)) + " " + esc((a.reviewedAt || "").slice(0, 4)) + " · from " + (a.sources || []).length + " web sources, not a visit</p>" +
      "<p>" + esc(a.summary) + "</p><details><summary>Details and sources</summary>" + more + "</details></div>";
  }

  function notesFormHTML(p) {
    var n = state.notes[p.id] || {};
    var uid = "n-" + p.id;
    return '<form class="notes-form" data-id="' + p.id + '">' +
      '<div class="field"><label for="' + uid + '-age">Ages it suits</label><input id="' + uid + '-age" name="age" type="text" placeholder="e.g. 2–8" value="' + esc(n.age) + '"></div>' +
      '<div class="field"><label for="' + uid + '-st">The one standout thing</label><input id="' + uid + '-st" name="standout" type="text" placeholder="e.g. huge sandpit, zip wire" value="' + esc(n.standout) + '"></div>' +
      '<div class="field"><label for="' + uid + '-ex">Extras</label><input id="' + uid + '-ex" name="extras" type="text" placeholder="e.g. café, toilets, fenced" value="' + esc(n.extras) + '"></div>' +
      '<div class="row"><button class="btn small primary" type="submit">Save notes</button><button class="btn small" type="button" data-act="cancel">Cancel</button></div>' +
      '<p class="small muted">Saved in this browser. Export them from “All places”.</p></form>';
  }

  function initNext10() {
    var sel = $("#preset"), status = $("#loc-status"), target = $("#target");
    presetSelect(sel);
    var chips = document.querySelectorAll('#ages input[type=checkbox]');
    Array.prototype.forEach.call(chips, function (c) {
      c.checked = state.ages.indexOf(c.value) >= 0;
      c.addEventListener("change", function () {
        state.ages = Array.prototype.filter.call(chips, function (x) { return x.checked; }).map(function (x) { return x.value; });
        state.skipped = []; save(); render();
      });
    });
    target.value = state.target;
    $("#use-location").addEventListener("click", function () { locate(status, render); });
    sel.addEventListener("change", function () { var p = presetById(sel.value); if (p) { setOrigin({ lat: p.lat, lon: p.lon, label: p.label }); status.textContent = "Starting from " + p.label + "."; render(); } });
    target.addEventListener("change", function () {
      var t = Math.round(parseFloat(target.value)); if (!(t >= 1)) t = 1; if (t > 31) t = 31;
      state.target = t; target.value = t; save(); renderStats();
    });
    document.addEventListener("click", function (e) { if (e.target.closest("#reset-skips")) { state.skipped = []; save(); render(); } });
    $("#copy-list").addEventListener("click", copyList);
    var shareBtn = $("#share-list");
    if (navigator.share) shareBtn.hidden = false;
    shareBtn.addEventListener("click", function () { navigator.share({ title: "Our next 10 adventures", text: listText() }).catch(function () {}); });
    $("#print-list").addEventListener("click", function () { window.print(); });

    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      var li = b.closest("[data-id]"); var id = li && li.getAttribute("data-id"); if (!id) return;
      var act = b.getAttribute("data-act");
      if (act === "went") {
        // A fast double tap counts once: ignore a second toggle on the same card within 600 ms.
        var now = Date.now(); if (lastTap[id] && now - lastTap[id] < 600) return; lastTap[id] = now;
        // Update the card where it is, so a second tap can't land on the next card.
        if (state.visited[id]) delete state.visited[id]; else state.visited[id] = todayISO();
        save(); renderStats();
        var c = b.closest(".card"), d = !!state.visited[id];
        c.classList.toggle("is-done", d);
        c.querySelector(".badge").textContent = d ? "✓" : (c.getAttribute("data-n") || "");
        b.setAttribute("aria-pressed", String(d));
        b.textContent = d ? "Went " + niceDate(state.visited[id]) + " · Undo" : "We went";
        var sw = c.querySelector('[data-act="swap"]'); if (sw) sw.hidden = d;
        toast(d ? "Ticked off " + BY_ID[id].name + ". Nice!" : "Unticked " + BY_ID[id].name + ".");
      }
      if (act === "swap") {
        state.skipped.push(id); save(); render();
        toast("Swapped out " + BY_ID[id].name + ".", function () { state.skipped = state.skipped.filter(function (x) { return x !== id; }); save(); render(); });
      }
      if (act === "note") {
        var card = b.closest(".card"), f = card.querySelector(".notes-form");
        if (f) { f.remove(); b.setAttribute("aria-expanded", "false"); return; }
        card.insertAdjacentHTML("beforeend", notesFormHTML(BY_ID[id])); b.setAttribute("aria-expanded", "true");
        card.querySelector(".notes-form input").focus();
      }
      if (act === "cancel") { var form = b.closest(".notes-form"); form.parentNode.querySelector('[data-act="note"]').setAttribute("aria-expanded", "false"); form.remove(); }
    });
    document.addEventListener("submit", function (e) {
      var f = e.target.closest(".notes-form"); if (!f) return; e.preventDefault();
      var id = f.getAttribute("data-id");
      var n = { age: f.age.value.trim(), standout: f.standout.value.trim(), extras: f.extras.value.trim() };
      if (n.age || n.standout || n.extras) state.notes[id] = n; else delete state.notes[id];
      save(); render();
    });
    if (state.origin) status.textContent = originStatus("Starting from");
    render();
  }

  var current = { near: [], away: [] };
  var lastTap = {};
  function render() {
    renderStats();
    var out = $("#list-out");
    if (!state.origin) {
      out.innerHTML = '<p class="empty">Choose where you\'re starting from, using your location or a neighbourhood, and your next 10 adventures appear here.</p>';
      $("#list-tools").hidden = true;
      return;
    }
    current = buildNext10();
    var i = 1, html = "";
    var label = state.origin.gps ? "you" : state.origin.label;
    if (state.skipped.length) html += '<p class="row small no-print"><span class="muted">' + state.skipped.length + ' place' + (state.skipped.length === 1 ? "" : "s") + ' swapped out.</span><button class="btn small" type="button" id="reset-skips">Bring them back</button></p>';
    html += '<section class="group" aria-labelledby="g-near"><div class="group-head"><h2 id="g-near">Close to home</h2><span class="small muted">Within a 30-minute walk of ' + esc(label) + ', best and nearest first</span></div>';
    html += current.near.length ? '<ol class="cards">' + current.near.map(function (p) { return cardHTML(p, i++); }).join("") + "</ol>" : '<p class="empty">No unvisited places within a 30-minute walk. Try another starting point, or clear swaps.</p>';
    html += "</section>";
    html += '<section class="group" aria-labelledby="g-away"><div class="group-head"><h2 id="g-away">Worth a trip</h2><span class="small muted">The best-rated places a bus, train or bike ride away</span></div>';
    html += current.away.length ? '<ol class="cards" start="' + i + '">' + current.away.map(function (p) { return cardHTML(p, i++); }).join("") + "</ol>" : '<p class="empty">No rated places further out fit these ages yet. Ask Claude to scout for more.</p>';
    html += "</section>";
    var visited = Object.keys(state.visited).filter(function (id) { return BY_ID[id]; }).map(function (id) { var p = withDistances([BY_ID[id]])[0]; return p; });
    if (visited.length) {
      visited.sort(function (a, b) { return state.visited[b.id] < state.visited[a.id] ? -1 : 1; });
      html += '<section class="group no-print" aria-labelledby="g-done"><div class="group-head"><h2 id="g-done">Been there</h2><span class="small muted">' + visited.length + ' place' + (visited.length === 1 ? "" : "s") + ' ticked off</span></div><ol class="cards">' + visited.map(function (p) { return cardHTML(p, "✓"); }).join("") + "</ol></section>";
    }
    out.innerHTML = html;
    $("#list-tools").hidden = false;
    var pt = $(".print-title"); if (pt) pt.textContent = "Our next 10 adventures — " + (state.origin.gps ? "" : "from ") + state.origin.label + " · " + todayISO();
  }

  function renderStats() {
    var el = $("#stats"); if (!el) return;
    var m = monthCount(), t = state.target, all = Object.keys(state.visited).length;
    el.innerHTML = '<span class="stat"><b>' + m + '</b> new place' + (m === 1 ? "" : "s") + ' this month</span>' +
      '<span class="meter" role="progressbar" aria-label="Progress to monthly target" aria-valuemin="0" aria-valuemax="' + t + '" aria-valuenow="' + Math.min(m, t) + '"><span style="width:' + Math.min(100, Math.round(m / t * 100)) + '%"></span></span>' +
      '<span class="small muted">target ' + t + ' · ' + all + ' all time</span>';
  }

  function listText() {
    var lines = ["Our next 10 adventures (starting " + (state.origin.gps ? originLabel() : "from " + originLabel()) + ")", ""], i = 1;
    current.near.concat(current.away).forEach(function (p) {
      var v = view(p);
      lines.push(i++ + ". " + p.name + " (" + (p.hood || p.area) + ") — " + howFar(p._d) + (v.age ? " · ages " + v.age : "") + (v.standout ? " · " + v.standout : ""));
      lines.push("   " + directions(p));
    });
    lines.push("", "Made with Adventure Map: " + location.href.split("#")[0]);
    return lines.join("\n");
  }
  function copyList() {
    var s = $("#copy-status");
    if (!state.origin) { s.textContent = "Choose a starting point first."; return; }
    var t = listText();
    function fallback() { var ta = $("#copy-fallback"); ta.hidden = false; ta.value = t; ta.select(); s.textContent = "Select-all is done. Press Ctrl/⌘+C to copy."; }
    try { navigator.clipboard.writeText(t).then(function () { s.textContent = "List copied. Paste it into a message to friends."; }, fallback); } catch (e) { fallback(); }
  }

  // ---------- Near me (map) ----------
  function initNear() {
    var sel = $("#preset"), status = $("#loc-status");
    presetSelect(sel);
    var map = null, layer = null, here = null, numbered = null;
    function drawDots() {
      if (!layer) return; layer.clearLayers();
      PLACES.filter(function (p) { return !isFar(p); }).forEach(function (p) {
        var c = isOurs(p) ? getVar("--trip") : getVar("--park");
        L.circleMarker([p.lat, p.lon], { radius: p.ai || isOurs(p) ? 8 : 6, color: c, weight: 2, fillColor: state.visited[p.id] ? getVar("--surface") : c, fillOpacity: 0.85 })
          .bindPopup(popupHTML(p)).addTo(layer);
      });
    }
    if (window.L) {
      map = L.map("map", { scrollWheelZoom: false }).setView([51.475, -0.075], 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
      layer = L.layerGroup().addTo(map);
      numbered = L.layerGroup().addTo(map);
      drawDots();
    } else {
      $("#map").innerHTML = '<p class="empty">The map couldn\'t load. The list still works.</p>';
    }
    function go() {
      var o = state.origin; if (!o) return;
      var near = withDistances(PLACES).filter(function (p) { return !isFar(p); }).sort(function (a, b) { return a._d - b._d; }).slice(0, 5);
      $("#near-out").innerHTML = '<h2 class="sr-only">Five nearest</h2><ol class="near-list">' + near.map(function (p, i) { return cardHTML(p, i + 1, true); }).join("") + "</ol>";
      if (map) {
        if (here) map.removeLayer(here);
        here = L.circleMarker([o.lat, o.lon], { radius: 8, color: getVar("--fg"), weight: 3, fillColor: getVar("--surface"), fillOpacity: 1 }).bindTooltip("Start: " + o.label).addTo(map);
        drawDots(); numbered.clearLayers();
        near.forEach(function (p, i) {
          L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "num-pin" + (isOurs(p) ? " trip" : "") + (state.visited[p.id] ? " done" : ""), html: String(i + 1), iconSize: [28, 28], iconAnchor: [14, 14] }), title: (i + 1) + ". " + p.name })
            .bindPopup(popupHTML(p)).addTo(numbered);
        });
        var pts = near.map(function (p) { return [p.lat, p.lon]; }); pts.push([o.lat, o.lon]);
        map.fitBounds(pts, { padding: [30, 30], maxZoom: 16 });
      }
    }
    $("#use-location").addEventListener("click", function () { locate(status, go); });
    sel.addEventListener("change", function () { var p = presetById(sel.value); if (p) { setOrigin({ lat: p.lat, lon: p.lon, label: p.label }); status.textContent = "Starting from " + p.label + "."; go(); } });
    document.addEventListener("click", function (e) {
      var b = e.target.closest('[data-act="went"]'); if (!b) return;
      var id = b.closest("[data-id]").getAttribute("data-id");
      if (state.visited[id]) delete state.visited[id]; else state.visited[id] = todayISO(); save(); go();
    });
    if (state.origin) { status.textContent = originStatus("Starting from"); go(); }
    else $("#near-out").innerHTML = '<p class="empty">Tap “Find playgrounds near me” or pick a neighbourhood to see the five closest.</p>';
  }
  function popupHTML(p) {
    var v = view(p);
    var fit = ageFit(p);
    return "<strong>" + esc(p.name) + "</strong><br><span>" + esc(kindLabel(p)) + "</span>" +
      "<br>Ages: " + (v.age ? esc(v.age) : "unknown") + (fit === "yes" ? " · fits your kids" : "") +
      (scoreOf(p) != null ? "<br>Score " + scoreOf(p) + "/10" + (p.ai ? " (AI)" : "") : "") +
      (v.standout ? "<br>" + esc(v.standout) : "") + (state.visited[p.id] ? "<br>✓ Went " + esc(niceDate(state.visited[p.id])) : "") +
      '<br><a href="' + directions(p) + '" target="_blank" rel="noopener">Directions</a>';
  }
  function getVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#2f6b45"; }

  // ---------- All places (table) ----------
  function initList() {
    var q = $("#q"), kind = $("#kind"), sort = $("#sort"), sel = $("#preset"), status = $("#loc-status");
    presetSelect(sel);
    function draw() {
      var rows = withDistances(PLACES);
      var term = q.value.trim().toLowerCase();
      if (term) rows = rows.filter(function (p) { var n = state.notes[p.id] || {}; return [p.name, p.area, p.hood, TYPE_LABEL[p.type], p.standout, p.extras, p.age, (p.review || {}).text, p.ai && p.ai.summary, p.ai && p.ai.standout, n.age, n.standout, n.extras].join(" ").toLowerCase().indexOf(term) >= 0; });
      var k = kind.value;
      if (k === "london") rows = rows.filter(function (p) { return !isFar(p); });
      else if (k === "far") rows = rows.filter(isFar);
      else if (k === "ours") rows = rows.filter(isOurs);
      else if (k === "unreviewed") rows = rows.filter(function (p) { return !isFar(p) && !p.ai && !p.review; });
      else if (k) rows = rows.filter(function (p) { return !isFar(p) && p.type === k; });
      var band = AGE_BANDS[$("#agef").value];
      if (band) rows = rows.filter(function (p) { var r = rangeOf(p); return r && r[0] <= band[1] && r[1] >= band[0]; });
      var s = sort.value;
      if (s === "distance" && !state.origin) s = "name";
      rows.sort(function (a, b) {
        if (s === "distance") return a._d - b._d;
        if (s === "reviewed") return (b.review ? 1 : 0) - (a.review ? 1 : 0) || a.name.localeCompare(b.name);
        if (s === "score") return rankScore(b) - rankScore(a) || (scoreOf(b) != null) - (scoreOf(a) != null) || a.name.localeCompare(b.name);
        return a.name.localeCompare(b.name);
      });
      $("#count").textContent = rows.length + " of " + PLACES.length + " places" + (kind.value === "london" ? " within 5 miles of Peckham" : "");
      $("#tbody").innerHTML = rows.map(function (p) {
        var v = view(p), pill = isFar(p) ? " far" : (isOurs(p) ? " trip" : "");
        var review = p.review ? esc(p.review.stars) + "★ “" + esc(p.review.text) + "”"
          : p.ai ? '<span class="score">' + p.ai.score + '/10</span> ' + esc(p.ai.summary) + ' <span class="muted small">(AI review)</span>'
          : (v.standout ? esc(v.standout) + (v.mine ? ' <span class="muted small">(your note)</span>' : "") : '<span class="muted">Not reviewed yet</span>');
        return "<tr><td data-l=\"Place\"><strong>" + esc(p.name) + "</strong><br><span class=\"small muted\">" + esc(p.hood ? p.hood + ", " + p.area : p.area) + "</span></td>" +
          '<td data-l="Type"><span class="pill' + pill + '">' + (isFar(p) ? "Further afield" : isOurs(p) ? "Our pick" : esc(TYPE_LABEL[p.type] || "Adventure")) + "</span></td>" +
          '<td data-l="Ages">' + (v.age ? esc(v.age) : '<span class="muted">Unknown</span>') + "</td>" +
          '<td data-l="Review" class="rev">' + review + "</td>" +
          '<td data-l="How far" class="num">' + (p._d != null ? esc(howFar(p._d)) : "—") + "</td>" +
          '<td data-l="Visited" class="vis">' + (state.visited[p.id] ? "✓ " + esc(niceDate(state.visited[p.id])) : '<span class="muted">Not yet</span>') + "</td>" +
          '<td class="dir"><a class="btn small" href="' + directions(p) + '" target="_blank" rel="noopener">Directions</a></td></tr>';
      }).join("") || '<tr><td colspan="7" class="none">Nothing matches. <button class="btn small" type="button" id="clear-filters">Clear search and filters</button></td></tr>';
    }
    document.addEventListener("click", function (e) { if (e.target.closest("#clear-filters")) { q.value = ""; kind.value = "london"; $("#agef").value = "any"; draw(); } });
    // The search box redraws as you type only: a redraw on blur would remove a button mid-click.
    q.addEventListener("input", draw);
    [kind, sort, $("#agef")].forEach(function (el) { el.addEventListener("change", draw); });
    $("#use-location").addEventListener("click", function () { locate(status, function () { sort.value = "distance"; draw(); }); });
    sel.addEventListener("change", function () { var p = presetById(sel.value); if (p) { setOrigin({ lat: p.lat, lon: p.lon, label: p.label }); status.textContent = "Distances from " + p.label + "."; sort.value = "distance"; draw(); } });
    if (state.origin) { status.textContent = originStatus("Distances from"); sort.value = "distance"; }
    $("#export").addEventListener("click", function () {
      var out = Object.keys(state.notes).map(function (id) { var p = BY_ID[id]; return p ? Object.assign({ id: id, name: p.name }, state.notes[id]) : null; }).filter(Boolean);
      var ta = $("#export-out"); ta.hidden = false;
      ta.value = JSON.stringify({ notes: out, visited: state.visited }, null, 2);
      ta.select();
      $("#export-status").textContent = out.length ? out.length + " note(s) ready. Copy them to keep or to add to the site." : "No notes yet. Add notes from the Next 10 page after a visit.";
    });
    draw();
  }

  window.AM = { initNext10: initNext10, initNear: initNear, initList: initList, initAdd: function () { if (window.AMAdd) window.AMAdd({ places: PLACES, types: TYPE_LABEL, presets: PRESETS, esc: esc, distM: distM }); }, _distM: distM, _buildNext10: buildNext10 };
})();
