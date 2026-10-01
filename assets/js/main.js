/* ==========================================================================
   VeeBites — Landing page interactions
   Vanilla JS, no dependencies. Every enhancement degrades to static content.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';

  const inr = (n, d = 0) => n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

  /** Run `cb` once when `el` scrolls into view. */
  function onceVisible(el, cb, opts = { threshold: 0.2 }) {
    if (!('IntersectionObserver' in window)) { cb(); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { io.disconnect(); cb(); } });
    }, opts);
    io.observe(el);
  }

  /** Track whether `el` is on screen; used to pause loops when off screen. */
  function trackVisibility(el, threshold = 0.15) {
    const state = { visible: false };
    if (!('IntersectionObserver' in window)) { state.visible = true; return state; }
    new IntersectionObserver((entries) => {
      entries.forEach((e) => { state.visible = e.isIntersecting; });
    }, { threshold }).observe(el);
    return state;
  }

  /* ------------------------------------------------------------- Nav */
  const nav = $('[data-nav]');
  const toggle = $('[data-nav-toggle]');
  const menu = $('[data-mobile-menu]');

  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
  }
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { setMenu(false); toggle.focus(); }
  });
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  // Highlight the nav link for the section in view
  const navLinks = $$('.nav-links a');
  if ('IntersectionObserver' in window) {
    const byId = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
    const sectionIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const link = byId.get(e.target.id);
        if (!link) return;
        if (e.isIntersecting) navLinks.forEach((a) => a.classList.toggle('is-active', a === link));
        else link.classList.remove('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    byId.forEach((_, id) => { const s = document.getElementById(id); if (s) sectionIO.observe(s); });
  }

  /* ----------------------------------------------------- Scroll reveal */
  const revealEls = $$('[data-reveal]');
  revealEls.forEach((el) => {
    const siblings = Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-reveal'));
    const idx = siblings.indexOf(el);
    if (idx > 0) el.style.setProperty('--rd', `${Math.min(idx, 6) * 70}ms`);
  });
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  const flow = $('[data-flow]');
  if (flow) onceVisible(flow, () => flow.classList.add('is-visible'), { threshold: 0.3 });

  /* ------------------------------------------------------ Count-up numbers */
  function formatCount(el, v) {
    const d = Number(el.dataset.decimals || 0);
    const body = el.dataset.format === 'inr' || d ? inr(v, d) : String(Math.round(v));
    return (el.dataset.prefix || '') + body + (el.dataset.suffix || '');
  }
  function runCount(el) {
    const target = Number(el.dataset.count);
    if (reduceMotion) { el.textContent = formatCount(el, target); return; }
    const dur = 1300;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const d = Number(el.dataset.decimals || 0);
      const v = d ? target * eased : Math.round(target * eased);
      el.textContent = formatCount(el, v);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  $$('[data-count]').forEach((el) => onceVisible(el, () => runCount(el), { threshold: 0.6 }));

  /* -------------------------------------------- Mockup horizontal scroll hint */
  const scrollers = $$('[data-mock-scroll]');
  scrollers.forEach((sc) => {
    const hint = document.createElement('p');
    hint.className = 'scroll-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = '<svg class="i"><use href="#i-arrow-right"/></svg>Swipe to explore the full screen';
    sc.after(hint);
  });
  const checkScrollers = () => scrollers.forEach((sc) => {
    sc.classList.toggle('is-scrollable', sc.scrollWidth > sc.clientWidth + 2);
  });
  let resizeTimer;
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { checkScrollers(); renderFluidCharts(); }, 150);
  });

  /* ------------------------------------------------------- Tabs (generic) */
  /** Wire a tablist: click + arrow keys. `onSelect(tab)` applies the state. */
  function wireTabs(list, onSelect) {
    const tabs = $$('[role="tab"]', list);
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) tab.focus();
      onSelect(tab);
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab, false));
      tab.addEventListener('keydown', (e) => {
        const next = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (next) { e.preventDefault(); select(tabs[(i + next + tabs.length) % tabs.length], true); }
        if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
        if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
      });
    });
  }

  /* --------------------------------------------------------- Service tabs */
  const serviceTabs = $('[data-service-tabs]');
  const pos = $('[data-pos]');
  if (serviceTabs && pos) {
    const panel = $('#service-panel');
    wireTabs(serviceTabs, (tab) => {
      pos.dataset.state = tab.dataset.state;
      panel.setAttribute('aria-labelledby', tab.id);
    });
  }

  /* ------------------------------------------------------ Kitchen display */
  const kds = $('[data-kds]');
  if (kds) {
    const lists = {
      new: $('[data-col="new"] .kds-list', kds),
      prep: $('[data-col="prep"] .kds-list', kds),
      ready: $('[data-col="ready"] .kds-list', kds),
    };
    const counts = {
      new: $('[data-col="new"] [data-kds-count]', kds),
      prep: $('[data-col="prep"] [data-kds-count]', kds),
      ready: $('[data-col="ready"] [data-kds-count]', kds),
    };
    const recallEl = $('[data-kds-recall]', kds);
    const btnLabel = { new: 'Start', prep: 'Mark ready', ready: 'Bump' };
    const nextState = { new: 'prep', prep: 'ready' };
    const pool = [
      { type: 'Takeaway', station: 'Wok', icon: 'i-flame', items: [[1, 'Hakka Noodles'], [1, 'Chilli Paneer']], target: 540 },
      { type: 'Dine-in · T-11', station: 'Tandoor', icon: 'i-flame', items: [[2, 'Butter Naan'], [1, 'Dal Makhani']], target: 480 },
      { type: 'Delivery', station: 'Biryani', icon: 'i-flame', items: [[2, 'Chicken Biryani']], target: 600 },
      { type: 'Dine-in · T-02', station: 'Café', icon: 'i-coffee', items: [[2, 'Cappuccino'], [1, 'Brownie']], target: 360 },
      { type: 'Takeaway', station: 'Grill', icon: 'i-flame', items: [[1, 'Burger'], [1, 'Fries']], target: 480 },
      { type: 'Dine-in · T-06', station: 'Pizza', icon: 'i-flame', items: [[1, 'Margherita'], [2, 'Lemonade']], target: 720 },
    ];
    let poolIdx = 0;
    let nextNo = 106;
    let recall = Number(recallEl.textContent);

    const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const paint = (tk) => {
      const e = Number(tk.dataset.elapsed);
      const t = Number(tk.dataset.target);
      $('.tk-time', tk).textContent = fmt(e);
      $('.tk-bar i', tk).style.setProperty('--p', Math.min(e / t, 1).toFixed(3));
      tk.classList.toggle('is-late', e > t && tk.dataset.state !== 'ready');
    };
    const updateCounts = () => Object.keys(lists).forEach((k) => { counts[k].textContent = lists[k].children.length; });

    // FLIP: animate tickets from their old position to the new one
    const flip = (mutate) => {
      const tks = $$('.tk', kds);
      const first = new Map(tks.map((t) => [t, t.getBoundingClientRect()]));
      mutate();
      if (reduceMotion) return;
      tks.forEach((t) => {
        if (!t.isConnected) return;
        const a = first.get(t);
        const b = t.getBoundingClientRect();
        const dx = a.left - b.left;
        const dy = a.top - b.top;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          t.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
            { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)' });
        }
      });
    };

    const moveTo = (tk, state) => {
      tk.dataset.state = state;
      $('.tk-btn', tk).textContent = btnLabel[state];
      lists[state].appendChild(tk);
      paint(tk);
    };

    const bump = (tk, alsoMutate) => {
      tk.classList.add('is-leave');
      setTimeout(() => {
        flip(() => {
          tk.remove();
          recall += 1;
          recallEl.textContent = recall;
          if (alsoMutate) alsoMutate();
        });
        updateCounts();
      }, reduceMotion ? 0 : 420);
    };

    const makeTicket = () => {
      const d = pool[poolIdx++ % pool.length];
      const tk = document.createElement('article');
      tk.className = 'tk is-enter';
      tk.dataset.state = 'new';
      tk.dataset.elapsed = '0';
      tk.dataset.target = String(d.target);
      tk.innerHTML = `
        <header class="tk-h"><b class="tk-no"></b><span class="tk-time">00:00</span></header>
        <div class="tk-meta"><span></span><span class="tk-st"><svg class="i"><use href="#${d.icon}"/></svg></span></div>
        <ul class="tk-items"></ul>
        <div class="tk-bar"><i></i></div>
        <span class="tk-btn">Start</span>`;
      $('.tk-no', tk).textContent = `#${nextNo++}`;
      $('.tk-meta > span', tk).textContent = d.type;
      $('.tk-st', tk).append(d.station);
      const ul = $('.tk-items', tk);
      d.items.forEach(([q, name]) => {
        const li = document.createElement('li');
        const b = document.createElement('b');
        b.textContent = `${q} ×`;
        li.append(b, ` ${name}`);
        ul.appendChild(li);
      });
      tk.addEventListener('animationend', () => tk.classList.remove('is-enter'), { once: true });
      return tk;
    };

    const advance = (tk) => {
      const s = tk.dataset.state;
      if (s === 'ready') { bump(tk); return; }
      flip(() => moveTo(tk, nextState[s]));
      updateCounts();
    };

    // One service "beat": bump the oldest ready ticket, then everything moves up a column
    const shift = () => {
      if (lists.prep.firstElementChild) moveTo(lists.prep.firstElementChild, 'ready');
      if (lists.new.firstElementChild) moveTo(lists.new.firstElementChild, 'prep');
      if (lists.new.children.length < 3) lists.new.appendChild(makeTicket());
    };
    const beat = () => {
      if (lists.ready.children.length >= 2) {
        bump(lists.ready.firstElementChild, shift);
      } else {
        flip(shift);
        updateCounts();
      }
    };

    $$('.tk', kds).forEach(paint);
    kds.addEventListener('click', (e) => {
      const tk = e.target.closest('.tk');
      if (tk && !tk.classList.contains('is-leave')) advance(tk);
    });

    const vis = trackVisibility(kds);
    let hovering = false;
    kds.addEventListener('pointerenter', () => { hovering = true; });
    kds.addEventListener('pointerleave', () => { hovering = false; });
    setInterval(() => {
      if (!vis.visible || document.hidden) return;
      $$('.tk', kds).forEach((tk) => { tk.dataset.elapsed = Number(tk.dataset.elapsed) + 1; paint(tk); });
    }, 1000);
    if (!reduceMotion) {
      setInterval(() => { if (vis.visible && !hovering && !document.hidden) beat(); }, 4800);
    }
  }

  /* ------------------------------------------------ Customer order display */
  const cod = $('[data-cod]');
  const codControls = $('[data-cod-controls]');
  if (cod && codControls) {
    $$('[role="radiogroup"]', codControls).forEach((group) => {
      const radios = $$('[role="radio"]', group);
      const key = group.dataset.filter;
      const select = (r, focus) => {
        radios.forEach((x) => {
          x.setAttribute('aria-checked', String(x === r));
          x.tabIndex = x === r ? 0 : -1;
        });
        cod.dataset[key] = r.dataset.value;
        if (focus) r.focus();
      };
      radios.forEach((r, i) => {
        r.tabIndex = r.getAttribute('aria-checked') === 'true' ? 0 : -1;
        r.addEventListener('click', () => select(r, false));
        r.addEventListener('keydown', (e) => {
          const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
          if (d) { e.preventDefault(); select(radios[(i + d + radios.length) % radios.length], true); }
        });
      });
    });
  }

  /* ------------------------------------------------------- Offline stages */
  const off = $('[data-offline]');
  if (off) {
    if (reduceMotion) {
      off.classList.add('is-static');
    } else {
      const stages = ['online', 'local', 'sync'];
      let i = 0;
      const vis = trackVisibility(off, 0.3);
      setInterval(() => {
        if (!vis.visible || document.hidden) return;
        i = (i + 1) % stages.length;
        off.dataset.active = stages[i];
      }, 3400);
    }
  }

  /* --------------------------------------------------------------- Charts */
  const svg = (tag, attrs = {}, parent) => {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (parent) parent.appendChild(el);
    return el;
  };
  // Bars: 4px rounded data-end, square at the baseline
  const vBar = (x, y, w, h, r = 4) => {
    r = Math.max(0, Math.min(r, w / 2, h));
    return `M${x},${y + h}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h}Z`;
  };
  const hBar = (x, y, w, h, r = 4) => {
    r = Math.max(0, Math.min(r, h / 2, w));
    return `M${x},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x}Z`;
  };
  const niceStep = (range, count) => {
    const raw = range / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  };
  // Chart width in design units (16 = 1em of the mockup) so SVG text matches the mock's type scale
  const designWidth = (el, fallback) => {
    const em = parseFloat(getComputedStyle(el).fontSize) || 16;
    return el.clientWidth ? Math.round((el.clientWidth / em) * 16) : fallback;
  };
  const fmtValue = (v, f) => {
    switch (f) {
      case 'inr': return `₹${inr(v)}`;
      case 'k': return `₹${(v / 1000).toFixed(1)}K`;
      case 'L': return `₹${v.toFixed(2)}L`;
      case 'Lshort': return `₹${v.toFixed(1)}L`;
      case 'kshort': return `${v / 1000}K`;
      default: return String(v);
    }
  };

  function makeTip(container) {
    let tip = $('.chart-tip', container);
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tip';
      tip.innerHTML = '<b></b>';
      container.appendChild(tip);
    }
    return {
      show(xPct, yPct, value, rows) {
        tip.querySelector('b').textContent = value;
        $$('span', tip).forEach((s) => s.remove());
        rows.forEach(([label, color]) => {
          const s = document.createElement('span');
          const k = document.createElement('i');
          if (color) k.style.background = color;
          s.append(k, label);
          tip.appendChild(s);
        });
        tip.style.left = `${xPct}%`;
        tip.style.top = `${yPct}%`;
        tip.classList.add('on');
      },
      hide() { tip.classList.remove('on'); },
    };
  }

  /** Horizontal bars, single series, direct-labelled. */
  function hbarChart(el, data, opts = {}) {
    const W = opts.width || 360;
    const rowH = opts.rowH || 30;
    const labelW = opts.labelW || 104;
    const valW = opts.valW || 58;
    const fs = opts.fs || 11;
    const H = data.length * rowH;
    const max = Math.max(...data.map((d) => d[1]));
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.label || 'Bar chart' });
    const bw = W - labelW - valW;
    data.forEach(([label, v], i) => {
      const y = i * rowH;
      const g = svg('g', {}, s);
      const t = svg('text', { x: 0, y: y + rowH / 2 + fs * 0.36, 'font-size': fs }, g);
      t.textContent = label;
      const w = Math.max(2, (v / max) * bw);
      const fill = opts.colors ? opts.colors(i) : '#2563C9';
      const bar = svg('path', { class: 'bar', d: hBar(labelW, y + (rowH - 12) / 2, w, 12), fill }, g);
      const title = svg('title', {}, bar);
      title.textContent = `${label}: ${fmtValue(v, opts.format)}`;
      const vt = svg('text', { class: 'val', x: labelW + w + 6, y: y + rowH / 2 + fs * 0.36, 'font-size': fs }, g);
      vt.textContent = fmtValue(v, opts.format);
    });
    el.replaceChildren(s);
  }

  /** Vertical columns (single or grouped series) with gridlines + hover tooltips. */
  function columnChart(el, labels, series, opts = {}) {
    const W = opts.width || 520;
    const H = opts.height || 180;
    const fs = opts.fs || 10.5;
    const pad = { l: opts.padL || 40, r: 6, t: 18, b: 22 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const max = Math.max(...series.flatMap((s) => s.values));
    const step = niceStep(max, 3);
    const top = Math.ceil(max / step) * step;
    const sv = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.label || 'Column chart' });
    for (let v = 0; v <= top + 1e-9; v += step) {
      const y = pad.t + ih - (v / top) * ih;
      svg('line', { class: v === 0 ? 'axis' : 'grid', x1: pad.l, x2: W - pad.r, y1: y, y2: y }, sv);
      const t = svg('text', { x: pad.l - 6, y: y + fs * 0.35, 'font-size': fs, 'text-anchor': 'end' }, sv);
      t.textContent = opts.tick ? opts.tick(v) : v;
    }
    const band = iw / labels.length;
    const n = series.length;
    const gap = 2;
    const bw = Math.min(24, (band * 0.62 - gap * (n - 1)) / n);
    const groupW = bw * n + gap * (n - 1);
    let tip;
    labels.forEach((lab, i) => {
      const gx = pad.l + band * i + (band - groupW) / 2;
      const g = svg('g', {}, sv);
      series.forEach((s, si) => {
        const v = s.values[i];
        const h = (v / top) * ih;
        const color = typeof s.color === 'function' ? s.color(i) : s.color;
        svg('path', { class: 'bar', d: vBar(gx + si * (bw + gap), pad.t + ih - h, bw, h), fill: color }, g);
      });
      const t = svg('text', { x: pad.l + band * i + band / 2, y: H - 6, 'font-size': fs, 'text-anchor': 'middle' }, sv);
      t.textContent = lab;
      if (opts.labelIndex === i) {
        const v = series[0].values[i];
        const vt = svg('text', { class: 'val', x: gx + bw / 2, y: pad.t + ih - (v / top) * ih - 6, 'font-size': fs, 'text-anchor': 'middle' }, sv);
        vt.textContent = opts.fmt(v);
      }
      // Hit target spans the whole band (bigger than the mark)
      const hit = svg('rect', { class: 'hit', x: pad.l + band * i, y: pad.t, width: band, height: ih }, g);
      g.insertBefore(hit, g.firstChild);
      const show = () => {
        const v0 = Math.max(...series.map((s) => s.values[i]));
        const rows = series.map((s) => [`${s.name}: ${opts.fmt(s.values[i])}`, typeof s.color === 'function' ? s.color(i) : s.color]);
        tip.show(((pad.l + band * i + band / 2) / W) * 100, ((pad.t + ih - (v0 / top) * ih) / H) * 100,
          opts.title ? opts.title(lab) : lab, rows);
      };
      g.addEventListener('pointerenter', show);
      g.addEventListener('pointerleave', () => tip.hide());
    });
    el.replaceChildren(sv);
    tip = makeTip(el);
  }

  /** Line + area wash with a snapping crosshair tooltip. */
  function lineChart(el, labels, values, opts) {
    const W = designWidth(el, 640);
    const H = 228;
    const fs = 10.5;
    const pad = { l: 46, r: 54, t: 14, b: 24 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const step = niceStep(hi - lo, 4);
    const y0 = Math.floor(lo / step) * step;
    const y1 = Math.ceil(hi / step) * step;
    const X = (i) => pad.l + (i / (values.length - 1)) * iw;
    const Y = (v) => pad.t + ih - ((v - y0) / (y1 - y0)) * ih;
    const color = '#F0600F';
    const sv = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.label });
    for (let v = y0; v <= y1 + 1e-9; v += step) {
      svg('line', { class: v === y0 ? 'axis' : 'grid', x1: pad.l, x2: W - pad.r, y1: Y(v), y2: Y(v) }, sv);
      const t = svg('text', { x: pad.l - 8, y: Y(v) + fs * 0.35, 'font-size': fs, 'text-anchor': 'end' }, sv);
      t.textContent = opts.tick(v);
    }
    labels.forEach((lab, i) => {
      const lastIdx = labels.length - 1;
      if (i !== lastIdx && (i % 2 || i === lastIdx - 1)) return; // every other day; never crowd the last label
      const t = svg('text', { x: X(i), y: H - 6, 'font-size': fs, 'text-anchor': 'middle' }, sv);
      t.textContent = lab.replace(' Sep', '');
    });
    const pts = values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
    svg('path', { d: `M${pts.join('L')}L${X(values.length - 1)},${Y(y0)}L${X(0)},${Y(y0)}Z`, fill: color, 'fill-opacity': 0.1 }, sv);
    const line = svg('path', { d: `M${pts.join('L')}`, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, sv);
    const last = values.length - 1;
    svg('circle', { cx: X(last), cy: Y(values[last]), r: 4, fill: color, stroke: '#fff', 'stroke-width': 2 }, sv);
    const endLabel = svg('text', { class: 'val', x: X(last) + 9, y: Y(values[last]) + fs * 0.35, 'font-size': fs }, sv);
    endLabel.textContent = opts.short(values[last]);

    const xh = svg('line', { class: 'xhair', x1: 0, x2: 0, y1: pad.t, y2: pad.t + ih }, sv);
    const dot = svg('circle', { class: 'dot', r: 4, fill: color, stroke: '#fff', 'stroke-width': 2, opacity: 0 }, sv);
    const hit = svg('rect', { class: 'hit', x: pad.l, y: pad.t, width: iw, height: ih }, sv);
    let tip;
    hit.addEventListener('pointermove', (e) => {
      const r = sv.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(last, Math.round(((x - pad.l) / iw) * last)));
      xh.setAttribute('x1', X(i)); xh.setAttribute('x2', X(i)); xh.classList.add('on');
      dot.setAttribute('cx', X(i)); dot.setAttribute('cy', Y(values[i])); dot.setAttribute('opacity', 1);
      tip.show((X(i) / W) * 100, (Y(values[i]) / H) * 100, opts.full(values[i]), [[labels[i], color]]);
    });
    hit.addEventListener('pointerleave', () => { xh.classList.remove('on'); dot.setAttribute('opacity', 0); tip.hide(); });
    el.replaceChildren(sv);
    tip = makeTip(el);
    if (!reduceMotion && opts.animate !== false) {
      const len = line.getTotalLength();
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = len;
      line.getBoundingClientRect();
      line.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.2,.7,.2,1)';
      line.style.strokeDashoffset = 0;
    }
  }

  /** Sparkline into an existing <svg data-spark>. */
  function sparkline(s) {
    const vals = s.dataset.spark.split(',').map(Number);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const X = (i) => (i / (vals.length - 1)) * 120;
    const Y = (v) => 28 - ((v - lo) / (hi - lo)) * 24;
    const pts = vals.map((v, i) => `${X(i)},${Y(v)}`).join('L');
    svg('path', { d: `M${pts}L120,32L0,32Z`, fill: '#F0600F', 'fill-opacity': 0.12 }, s);
    svg('path', { d: `M${pts}`, fill: 'none', stroke: '#F0600F', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' }, s);
  }

  $$('svg[data-spark]').forEach(sparkline);

  // Charts declared in markup (redrawn when the viewport width changes)
  function renderMockCharts() {
    $$('[data-chart="hbar"]').forEach((el) => {
      const data = el.dataset.values.split(',').map((p) => { const [k, v] = p.split(':'); return [k, Number(v)]; });
      const accent = el.hasAttribute('data-first-accent');
      hbarChart(el, data, {
        width: designWidth(el, 360),
        rowH: accent ? 28 : 30,
        format: el.dataset.format,
        labelW: accent ? 104 : 84,
        colors: accent ? (i) => (i === 0 ? '#F0600F' : '#B7C2D6') : () => '#2563C9',
        label: el.closest('.app-card')?.querySelector('.ac-title')?.textContent,
      });
    });
    $$('[data-chart="columns"]').forEach((el) => {
      const labels = el.dataset.labels.split(',');
      const values = el.dataset.values.split(',').map(Number);
      const hl = Number(el.dataset.highlight);
      columnChart(el, labels, [{ name: 'Sales', values, color: (i) => (i === hl ? '#F0600F' : '#2563C9') }], {
        width: designWidth(el, 520), height: 180, tick: (v) => (v ? `₹${v / 1000}K` : '0'), fmt: (v) => `₹${inr(v)}`,
        title: (l) => `${l}:00 – ${Number(l) + 1}:00`, labelIndex: hl, label: 'Hourly sales',
      });
    });
    $$('[data-chart="groupbar"]').forEach((el) => {
      const labels = el.dataset.labels.split(',');
      const colors = ['#2563C9', '#F0600F'];
      const series = el.dataset.series.split('|').map((s, i) => {
        const [name, vals] = s.split(':');
        return { name, values: vals.split(',').map(Number), color: colors[i] };
      });
      const unit = el.dataset.unit || '';
      columnChart(el, labels, series, {
        width: designWidth(el, 420), height: 168, padL: 34,
        tick: (v) => (v ? `${v}K` : '0'), fmt: (v) => `${unit.replace('K', '')}${v}K`, label: 'Stock movement',
      });
    });
  }
  renderMockCharts();

  // Sales / order volume trend with tabs
  let redrawTrend = () => {};
  const trendEl = $('[data-trend]');
  if (trendEl) {
    const labels = trendEl.dataset.labels.split(',');
    const metrics = {
      sales: {
        values: trendEl.dataset.sales.split(',').map(Number),
        tick: (v) => `₹${(v / 100000).toFixed(1)}L`, short: (v) => `₹${(v / 100000).toFixed(2)}L`,
        full: (v) => `₹${inr(v)}`, label: 'Daily sales, last 14 days',
      },
      orders: {
        values: trendEl.dataset.orders.split(',').map(Number),
        tick: (v) => String(v), short: (v) => `${v}`, full: (v) => `${v} orders`, label: 'Daily orders, last 14 days',
      },
    };
    let metric = 'sales';
    let drawn = false;
    const draw = (m, animate = true) => { metric = m; lineChart(trendEl, labels, metrics[m].values, { ...metrics[m], animate }); };
    redrawTrend = () => { if (drawn) draw(metric, false); };
    onceVisible(trendEl, () => { drawn = true; draw('sales'); }, { threshold: 0.3 });
    const tabs = $('[data-trend-tabs]');
    if (tabs) {
      wireTabs(tabs, (tab) => {
        if (!drawn) return;
        trendEl.style.transition = 'opacity .2s';
        trendEl.style.opacity = 0;
        setTimeout(() => { draw(tab.dataset.metric); trendEl.style.opacity = 1; }, reduceMotion ? 0 : 200);
      });
    }
  }

  /* ------------------------------------------------------------ AI assistant */
  const aiAnswers = [
    {
      q: 'Which products generated the most revenue this month?',
      text: 'Chicken Biryani generated the most revenue this month — ₹4.62L, about 11% of food sales. The top five dishes together account for just over a third of food revenue.',
      chartTitle: 'Revenue by product · top 5',
      chart: { type: 'hbar', data: [['Chicken Biryani', 4.62], ['Butter Chicken', 3.48], ['Paneer Tikka', 2.91], ['Masala Dosa', 2.14], ['Veg Hakka Noodles', 1.66]], format: 'L' },
      points: ['Biryani sales peak during Friday and Saturday dinner service.', 'Paneer Tikka grew the most compared with August.'],
      source: 'Based on VeeBites sales data · 1–30 Sep',
    },
    {
      q: 'Which days had the highest sales?',
      text: 'Saturdays had the highest average sales at ₹2.08L — about 50% above the Monday-to-Thursday average. Saturday 27 September was the strongest single day of the month.',
      chartTitle: 'Average daily sales by weekday',
      chart: { type: 'columns', labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: [1.32, 1.28, 1.41, 1.52, 1.89, 2.08, 1.84], highlight: 5 },
      points: ['Dinner service drives most of the weekend uplift.', 'Tuesday is consistently the quietest day.'],
      source: 'Based on VeeBites sales data · 1–30 Sep',
    },
    {
      q: 'Which ingredients have the highest waste?',
      text: 'Tomatoes had the highest recorded waste this month (₹3.1K), followed by coriander and fresh cream. Fresh produce makes up about a third of total waste value.',
      chartTitle: 'Waste value by ingredient · top 5',
      chart: { type: 'hbar', data: [['Tomatoes', 3100], ['Coriander', 2400], ['Fresh cream', 2200], ['Paneer', 1900], ['Bread rolls', 1600]], format: 'k' },
      points: ['Most tomato waste was logged as spoilage at closing.', 'Reviewing par levels for fresh produce may reduce over-ordering.'],
      source: 'Based on VeeBites waste logs · 1–30 Sep',
    },
    {
      q: 'How did labor cost change compared with last month?',
      text: 'Labor cost rose 6.2% versus August (₹11.02L → ₹11.70L). Sales grew faster, so labor as a share of sales fell from 24.8% to 24.1%.',
      chartTitle: 'Weekly labor cost · ₹ lakh',
      chart: { type: 'group', labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'], series: [{ name: 'August', values: [2.62, 2.70, 2.68, 3.02], color: '#5A6E94' }, { name: 'September', values: [2.78, 2.86, 2.91, 3.15], color: '#F0600F' }] },
      points: ['Sales grew 9.4% over the same period.', 'Week 4 overtime accounts for most of the increase.'],
      source: 'Based on VeeBites payroll and sales data · Aug–Sep',
    },
  ];
  const aiChartEl = $('[data-ai-chart]');
  let aiCurrent = 0;

  function renderAiChart(a) {
    if (!aiChartEl) return;
    const W = Math.max(300, Math.round(aiChartEl.clientWidth || 520));
    const legend = $('[data-ai-legend]');
    legend.hidden = true;
    legend.replaceChildren();
    $('[data-ai-chart-title]').textContent = a.chartTitle;
    const c = a.chart;
    if (c.type === 'hbar') {
      hbarChart(aiChartEl, c.data, {
        width: W, rowH: 28, fs: 12, labelW: W < 420 ? 118 : 136, valW: 64, format: c.format,
        colors: (i) => (i === 0 ? '#F0600F' : '#4A5F86'), label: a.chartTitle,
      });
    } else if (c.type === 'columns') {
      columnChart(aiChartEl, c.labels, [{ name: 'Avg sales', values: c.values, color: (i) => (i === c.highlight ? '#F0600F' : '#4A5F86') }], {
        width: W, height: 170, fs: 12, tick: (v) => (v ? `₹${v.toFixed(1)}L` : '0'), fmt: (v) => `₹${v.toFixed(2)}L`,
        labelIndex: c.highlight, label: a.chartTitle,
      });
    } else {
      legend.hidden = false;
      c.series.forEach((s) => {
        const span = document.createElement('span');
        const i = document.createElement('i');
        i.style.background = s.color;
        span.append(i, s.name);
        legend.appendChild(span);
      });
      columnChart(aiChartEl, c.labels, c.series, {
        width: W, height: 170, fs: 12, padL: 44, tick: (v) => (v ? `₹${v.toFixed(1)}L` : '0'), fmt: (v) => `₹${v.toFixed(2)}L`,
        label: a.chartTitle,
      });
    }
  }

  let typeTimer;
  function typeText(el, text) {
    clearInterval(typeTimer);
    if (reduceMotion) { el.textContent = text; return; }
    const words = text.split(' ');
    let n = 0;
    el.textContent = '';
    el.classList.add('is-typing');
    typeTimer = setInterval(() => {
      n += 1;
      el.textContent = words.slice(0, n).join(' ');
      if (n >= words.length) { clearInterval(typeTimer); el.classList.remove('is-typing'); }
    }, 38);
  }

  function showAnswer(idx, animate) {
    const a = aiAnswers[idx];
    aiCurrent = idx;
    const answer = $('[data-ai-answer]');
    const apply = () => {
      $('[data-ai-question]').textContent = a.q;
      const pts = $('[data-ai-points]');
      pts.replaceChildren(...a.points.map((p) => { const li = document.createElement('li'); li.textContent = p; return li; }));
      $('[data-ai-source]').textContent = a.source;
      renderAiChart(a);
      const textEl = $('[data-ai-text]');
      if (animate) typeText(textEl, a.text); else textEl.textContent = a.text;
      answer.classList.remove('is-swapping');
    };
    if (animate && !reduceMotion) {
      answer.classList.add('is-swapping');
      setTimeout(apply, 260);
    } else {
      apply();
    }
  }

  const aiTabs = $('[data-ai-tabs]');
  if (aiTabs && aiChartEl) {
    showAnswer(0, false);
    wireTabs(aiTabs, (tab) => showAnswer(Number(tab.dataset.q), true));
  }

  function renderFluidCharts() {
    renderMockCharts();
    redrawTrend();
    if (aiChartEl) renderAiChart(aiAnswers[aiCurrent]);
  }

  /* ---------------------------------------------------- Integration health */
  const health = $('[data-health]');
  if (health && !reduceMotion) {
    const status = $('[data-health-status]', health);
    const meta = $('[data-health-meta]', health);
    const queued = $('[data-q-queued]', health);
    const proc = $('[data-q-proc]', health);
    const steps = [
      ['proc', 'Processing', 'Batch 3 of 5', 8, 2],
      ['proc', 'Processing', 'Batch 4 of 5', 6, 2],
      ['proc', 'Processing', 'Batch 5 of 5', 4, 1],
      ['ok', 'Healthy', 'Last sync just now', 3, 0],
      ['ok', 'Healthy', 'Last sync 1m ago', 5, 1],
      ['proc', 'Processing', 'Batch 1 of 5', 9, 2],
      ['proc', 'Processing', 'Batch 2 of 5', 8, 2],
    ];
    let k = 0;
    const vis = trackVisibility(health);
    setInterval(() => {
      if (!vis.visible || document.hidden) return;
      k = (k + 1) % steps.length;
      const [cls, label, m, q, p] = steps[k];
      status.className = `st st--${cls}`;
      status.textContent = label;
      meta.textContent = m;
      queued.textContent = q;
      proc.textContent = p;
    }, 2600);
  }

  /* ------------------------------------------------------------ Demo dialog */
  const dialog = $('[data-demo-dialog]');
  const form = $('[data-demo-form]');
  const formWrap = $('[data-demo-form-wrap]');
  const done = $('[data-demo-done]');
  const errorEl = $('[data-demo-error]');
  let lastTrigger = null;

  function openDemo(trigger) {
    if (!dialog || typeof dialog.showModal !== 'function') return false;
    lastTrigger = trigger;
    setMenu(false);
    formWrap.hidden = false;
    done.hidden = true;
    dialog.showModal();
    $('#dd-name').focus();
    return true;
  }
  function closeDemo() {
    dialog.close();
  }
  $$('[data-demo]').forEach((a) => a.addEventListener('click', (e) => {
    if (openDemo(a)) e.preventDefault();
  }));
  if (dialog) {
    dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDemo(); });
    $$('[data-demo-close]', dialog).forEach((b) => b.addEventListener('click', closeDemo));
    dialog.addEventListener('close', () => { if (lastTrigger) lastTrigger.focus(); });
  }
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      let firstBad = null;
      $$('input[required]', form).forEach((inp) => {
        const bad = !inp.value.trim() || (inp.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value));
        inp.setAttribute('aria-invalid', String(bad));
        if (bad && !firstBad) firstBad = inp;
      });
      if (firstBad) {
        errorEl.textContent = 'Please add your name, a valid work email, and your restaurant name.';
        errorEl.hidden = false;
        firstBad.focus();
        return;
      }
      const endpoint = form.dataset.endpoint;
      const btn = $('button[type="submit"]', form);
      if (endpoint) {
        btn.disabled = true;
        btn.textContent = 'Sending…';
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(new FormData(form))),
          });
          if (!res.ok) throw new Error(String(res.status));
        } catch (err) {
          errorEl.textContent = 'Something went wrong sending your request. Please try again.';
          errorEl.hidden = false;
          btn.disabled = false;
          btn.textContent = 'Request demo';
          return;
        }
        btn.disabled = false;
        btn.textContent = 'Request demo';
      } else {
        console.info('[VeeBites] Demo form has no data-endpoint configured; submission not sent.');
      }
      form.reset();
      formWrap.hidden = true;
      done.hidden = false;
      $('[data-demo-close]', done).focus();
    });
  }

  /* -------------------------------------------------------- Mobile sticky CTA */
  const mobileCta = $('[data-mobile-cta]');
  const hero = $('.hero');
  const finalCta = $('.final');
  if (mobileCta && hero && finalCta && 'IntersectionObserver' in window) {
    const seen = new Map([[hero, true], [finalCta, false]]);
    const update = () => {
      const show = !seen.get(hero) && !seen.get(finalCta);
      mobileCta.classList.toggle('is-visible', show);
      mobileCta.setAttribute('aria-hidden', String(!show));
      $('a', mobileCta).tabIndex = show ? 0 : -1;
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target, e.isIntersecting));
      update();
    }, { threshold: 0 });
    io.observe(hero);
    io.observe(finalCta);
  }

  /* ------------------------------------------------------------------ Misc */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  checkScrollers();
  window.addEventListener('load', checkScrollers);
})();
