/* Add & ask page: builds pre-filled GitHub issues. Adding is handled by a GitHub Action;
   scouting and reviewing are picked up by the scheduled Claude run. Nothing is sent from this page itself. */
(function () {
  "use strict";
  var REPO = "frankwander/adventure-map";
  var PECKHAM = { lat: 51.4734, lon: -0.0690 }, RADIUS_M = 8050;

  window.AMAdd = function (ctx) {
    var $ = function (s) { return document.querySelector(s); };
    var esc = ctx.esc, places = ctx.places;

    // ---- tabs ----
    var tabs = document.querySelectorAll('[role="tab"]');
    function show(id) {
      Array.prototype.forEach.call(tabs, function (t) {
        var on = t.getAttribute("aria-controls") === id;
        t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      if (id === "p-add" && map) setTimeout(function () { map.invalidateSize(); }, 50);
      try { history.replaceState(null, "", "#" + id.slice(2)); } catch (e) {}
    }
    Array.prototype.forEach.call(tabs, function (t) { t.addEventListener("click", function () { show(t.getAttribute("aria-controls")); }); });
    var start = (location.hash || "").slice(1);
    show(["add", "scout", "review"].indexOf(start) >= 0 ? "p-" + start : "p-add");

    function issueURL(template, title, fields) {
      var q = "template=" + encodeURIComponent(template) + "&title=" + encodeURIComponent(title);
      Object.keys(fields).forEach(function (k) { if (fields[k] !== "" && fields[k] != null) q += "&" + k + "=" + encodeURIComponent(fields[k]); });
      return "https://github.com/" + REPO + "/issues/new?" + q;
    }
    function go(url, statusEl, msg) {
      var a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
      statusEl.innerHTML = esc(msg) + ' If nothing opened, <a href="' + esc(url) + '" target="_blank" rel="noopener">open the request on GitHub</a>.';
    }

    // ---- add: type list ----
    var typeSel = $("#a-type");
    typeSel.innerHTML = Object.keys(ctx.types).map(function (k) { return '<option value="' + k + '">' + esc(ctx.types[k]) + "</option>"; }).join("");

    // ---- add: map picker ----
    var map = null, pin = null;
    var lat = $("#a-lat"), lon = $("#a-lon"), locStatus = $("#a-loc-status");
    function setPin(la, lo, why) {
      lat.value = (+la).toFixed(5); lon.value = (+lo).toFixed(5);
      if (map) { if (pin) pin.setLatLng([la, lo]); else pin = L.marker([la, lo]).addTo(map); }
      var d = ctx.distM(PECKHAM, { lat: +la, lon: +lo });
      locStatus.textContent = (why ? why + " " : "") + (d > RADIUS_M ? "This is " + (d / 1609).toFixed(1) + " miles from Peckham, outside the map's 5-mile area. It will be added as “further afield”." : "Location set, " + (d / 1609).toFixed(1) + " miles from Peckham.");
      checkDupes();
    }
    if (window.L) {
      map = L.map("pick-map", { scrollWheelZoom: false }).setView([PECKHAM.lat, PECKHAM.lon], 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
      map.on("click", function (e) { setPin(e.latlng.lat, e.latlng.lng, "Pinned on the map."); });
    } else {
      $("#pick-map").innerHTML = '<p class="empty">The map couldn\'t load. Use your location or type the address instead.</p>';
    }
    $("#a-here").addEventListener("click", function () {
      if (!("geolocation" in navigator)) { locStatus.textContent = "This browser can't share location. Tap the map instead."; return; }
      locStatus.textContent = "Finding where you are…";
      navigator.geolocation.getCurrentPosition(function (p) {
        setPin(p.coords.latitude, p.coords.longitude, "Using where you are now.");
        if (map) map.setView([p.coords.latitude, p.coords.longitude], 16);
      }, function () { locStatus.textContent = "Couldn't get your location. Tap the map instead."; });
    });
    [lat, lon].forEach(function (el) { el.addEventListener("change", function () { if (+lat.value && +lon.value) setPin(lat.value, lon.value, ""); }); });

    // ---- add: duplicate hint ----
    var dupe = $("#a-dupe"), nameEl = $("#a-name");
    function norm(s) { return String(s || "").toLowerCase().replace(/\b(the|playground|play area|park|gardens?)\b/g, "").replace(/[^a-z0-9]/g, ""); }
    function checkDupes() {
      var n = norm(nameEl.value), hits = [];
      places.forEach(function (p) {
        var close = (+lat.value && +lon.value) ? ctx.distM({ lat: +lat.value, lon: +lon.value }, p) < 120 : false;
        if ((n.length > 3 && norm(p.name) === n) || close) hits.push(p.name);
      });
      dupe.hidden = !hits.length;
      dupe.textContent = hits.length ? "Already on the map nearby: " + hits.slice(0, 3).join(", ") + ". You can still add it if it's different." : "";
    }
    nameEl.addEventListener("input", checkDupes);

    $("#add-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var st = $("#a-status");
      if (!nameEl.value.trim()) { st.textContent = "Give it a name first."; nameEl.focus(); return; }
      if (!lat.value || !lon.value) { if (!$("#a-where").value.trim()) { st.textContent = "Tap the map, use your location, or type where it is."; return; } }
      var f = {
        name: nameEl.value.trim(), type: ctx.types[typeSel.value], what: $("#a-what").value.trim(), ages: $("#a-ages").value.trim(),
        where: $("#a-where").value.trim(), lat: lat.value, lon: lon.value, link: $("#a-link").value.trim()
      };
      go(issueURL("add.yml", "[Add] " + f.name, f), st, "GitHub opened with your adventure filled in. Tap “Create” there and it appears on the map in about a minute.");
    });

    // ---- scout ----
    Array.prototype.forEach.call(document.querySelectorAll("[data-idea]"), function (b) {
      b.addEventListener("click", function () { var t = $("#s-focus"); t.value = (t.value ? t.value.trim() + "\n" : "") + b.getAttribute("data-idea"); t.focus(); });
    });
    $("#scout-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var focus = $("#s-focus").value.trim() || "Anything great for kids that isn't on the map yet";
      go(issueURL("scout.yml", "[Scout] " + focus.split("\n")[0].slice(0, 60), { focus: focus, area: $("#s-area").value.trim(), count: $("#s-count").value }),
        $("#s-status"), "GitHub opened with your scouting request. Tap “Create”; Claude picks it up on its next run.");
    });

    // ---- review ----
    var rsel = $("#r-place");
    var local = places.filter(function (p) { return p.scope !== "far"; });
    var unrev = local.filter(function (p) { return !p.ai; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    var rev = local.filter(function (p) { return p.ai; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    rsel.innerHTML = '<option value="__all">All ' + unrev.length + " places without an AI review</option>" +
      '<optgroup label="Not reviewed yet">' + unrev.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + "</option>"; }).join("") + "</optgroup>" +
      (rev.length ? '<optgroup label="Review again (refresh)">' + rev.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + " (" + p.ai.score + "/10)</option>"; }).join("") + "</optgroup>" : "");
    $("#r-count").textContent = rev.length + " of " + local.length + " local places " + (rev.length === 1 ? "has" : "have") + " an AI review.";
    $("#review-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var id = rsel.value, p = places.filter(function (x) { return x.id === id; })[0];
      var what = id === "__all" ? "All places without an AI review" : p.name + " (" + p.id + ")";
      go(issueURL("review.yml", "[Review] " + (id === "__all" ? "all unreviewed places" : p.name), { places: what, notes: $("#r-notes").value.trim() }),
        $("#r-status"), "GitHub opened with your review request. Tap “Create”; Claude picks it up on its next run.");
    });
  };
})();
