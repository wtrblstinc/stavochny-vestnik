(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function all(selector, scope) {
    return Array.prototype.slice.call((scope || doc).querySelectorAll(selector));
  }

  function setCurrentDate() {
    var targets = all("[data-date]");
    if (!targets.length) return;

    try {
      var value = new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(new Date());
      targets.forEach(function (target) {
        target.textContent = value;
      });
    } catch (error) {
      /* The static date remains as a readable fallback. */
    }
  }

  function setupNavigation() {
    var button = doc.getElementById("navToggle");
    var nav = doc.getElementById("primaryNav");
    if (!button || !nav) return;

    function setOpen(open, restoreFocus) {
      button.setAttribute("aria-expanded", open ? "true" : "false");
      button.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
      nav.classList.toggle("is-open", open);
      doc.body.classList.toggle("nav-open", open);

      if (open) {
        var firstLink = nav.querySelector("a");
        if (firstLink) firstLink.focus({ preventScroll: true });
      } else if (restoreFocus) {
        button.focus({ preventScroll: true });
      }
    }

    button.addEventListener("click", function () {
      setOpen(button.getAttribute("aria-expanded") !== "true", false);
    });

    all("a", nav).forEach(function (link) {
      link.addEventListener("click", function () {
        setOpen(false, false);
      });
    });

    doc.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && button.getAttribute("aria-expanded") === "true") {
        setOpen(false, true);
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth >= 768 && button.getAttribute("aria-expanded") === "true") {
        setOpen(false, false);
      }
    });
  }

  function setupOfferControls() {
    var grid = doc.getElementById("offerGrid");
    var filterRoot = doc.getElementById("filterControls");
    var sortRoot = doc.getElementById("sortControls");
    var status = doc.getElementById("offerStatus");
    if (!grid || !filterRoot || !sortRoot) return;

    var cards = Array.prototype.slice.call(grid.children);
    var filterButtons = all("button[data-filter]", filterRoot);
    var sortButtons = all("button[data-sort]", sortRoot);
    var currentFilter = "all";
    var currentSort = "rank";
    var initialized = false;

    function numeric(card, attribute) {
      return Number(card.getAttribute(attribute)) || 0;
    }

    function apply() {
      var ordered = cards.slice().sort(function (a, b) {
        if (currentSort === "amount") {
          return numeric(b, "data-amount") - numeric(a, "data-amount") || numeric(a, "data-rank") - numeric(b, "data-rank");
        }
        return numeric(a, "data-rank") - numeric(b, "data-rank");
      });

      ordered.forEach(function (card) {
        grid.appendChild(card);
      });

      var visible = 0;
      ordered.forEach(function (card) {
        var show = currentFilter === "all" || card.getAttribute("data-category") === currentFilter;
        card.hidden = !show;
        card.classList.remove("coupon-anim");
        if (show) {
          if (!reduceMotion && initialized) {
            void card.offsetWidth;
            card.style.setProperty("--stagger", String(visible));
            card.classList.add("coupon-anim");
          }
          visible += 1;
        }
      });

      filterButtons.forEach(function (button) {
        button.setAttribute("aria-pressed", button.getAttribute("data-filter") === currentFilter ? "true" : "false");
      });

      sortButtons.forEach(function (button) {
        button.setAttribute("aria-pressed", button.getAttribute("data-sort") === currentSort ? "true" : "false");
      });

      if (status) {
        status.textContent = "Показано предложений: " + visible + " из 9";
      }
    }

    filterButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        currentFilter = button.getAttribute("data-filter") || "all";
        apply();
      });
    });

    sortButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        currentSort = button.getAttribute("data-sort") || "rank";
        apply();
      });
    });

    apply();
    initialized = true;
  }

  function setupCalculator() {
    var amountRange = doc.getElementById("amountRange");
    var amountInput = doc.getElementById("amountInput");
    var oddsRange = doc.getElementById("oddsRange");
    var oddsInput = doc.getElementById("oddsInput");
    var result = doc.getElementById("calcResult");
    if (!amountRange || !amountInput || !oddsRange || !oddsInput || !result) return;

    var resultValue = result.querySelector("strong");
    var resultFormula = result.querySelector("small");
    var formatter;

    try {
      formatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
    } catch (error) {
      formatter = null;
    }

    function formatNumber(value) {
      return formatter ? formatter.format(value) : String(value);
    }

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function readNumber(input, fallback) {
      var value = Number.parseFloat(input.value);
      return Number.isFinite(value) ? value : fallback;
    }

    var shownPayout = 0;
    var tweenId = null;

    function showPayout(value) {
      if (reduceMotion) {
        resultValue.textContent = formatNumber(value) + " ₽";
        shownPayout = value;
        return;
      }
      var from = shownPayout;
      var start = performance.now();
      var duration = 240;
      if (tweenId) window.cancelAnimationFrame(tweenId);
      resultValue.classList.add("bump");
      var frame = function (now) {
        var t = Math.min((now - start) / duration, 1);
        var eased = 1 - Math.pow(1 - t, 2);
        resultValue.textContent = formatNumber(Math.round(from + (value - from) * eased)) + " ₽";
        if (t < 1) tweenId = window.requestAnimationFrame(frame);
        else { tweenId = null; resultValue.classList.remove("bump"); }
      };
      tweenId = window.requestAnimationFrame(frame);
      shownPayout = value;
    }

    function calculate() {
      var amount = clamp(readNumber(amountInput, 500), 500, 30000);
      var odds = clamp(readNumber(oddsInput, 1.1), 1.1, 8);
      var checked = doc.querySelector('input[name="payout"]:checked');
      var stakeNotReturned = !checked || checked.value === "snr";
      var payout = Math.round(stakeNotReturned ? amount * (odds - 1) : amount * odds);

      showPayout(payout);
      resultFormula.textContent = stakeNotReturned
        ? formatNumber(amount) + " ₽ × (" + odds.toFixed(2) + " − 1) = " + formatNumber(payout) + " ₽"
        : formatNumber(amount) + " ₽ × " + odds.toFixed(2) + " = " + formatNumber(payout) + " ₽";
    }

    function syncPresets(value) {
      all("button[data-preset]").forEach(function (preset) {
        preset.setAttribute("aria-pressed", String(Number(preset.getAttribute("data-preset")) === Number(value)));
      });
    }

    amountRange.addEventListener("input", function () {
      amountInput.value = amountRange.value;
      syncPresets(amountInput.value);
      calculate();
    });

    amountInput.addEventListener("input", function () {
      amountRange.value = String(clamp(readNumber(amountInput, 500), 500, 30000));
      syncPresets(amountInput.value);
      calculate();
    });

    amountInput.addEventListener("change", function () {
      amountInput.value = String(clamp(readNumber(amountInput, 500), 500, 30000));
      amountRange.value = amountInput.value;
      syncPresets(amountInput.value);
      calculate();
    });

    oddsRange.addEventListener("input", function () {
      oddsInput.value = Number.parseFloat(oddsRange.value).toFixed(2);
      calculate();
    });

    oddsInput.addEventListener("input", function () {
      oddsRange.value = String(clamp(readNumber(oddsInput, 1.1), 1.1, 8));
      calculate();
    });

    oddsInput.addEventListener("change", function () {
      oddsInput.value = clamp(readNumber(oddsInput, 1.1), 1.1, 8).toFixed(2);
      oddsRange.value = oddsInput.value;
      calculate();
    });

    all('input[name="payout"]').forEach(function (radio) {
      radio.addEventListener("change", calculate);
    });

    all("button[data-preset]").forEach(function (button) {
      button.addEventListener("click", function () {
        var value = button.getAttribute("data-preset") || "10000";
        amountInput.value = value;
        amountRange.value = value;
        syncPresets(value);
        calculate();
      });
    });

    calculate();
  }

  function setupFaq() {
    var buttons = all(".faq-item button[aria-controls]");

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var item = button.closest(".faq-item");
        var willOpen = button.getAttribute("aria-expanded") !== "true";

        buttons.forEach(function (otherButton) {
          var otherItem = otherButton.closest(".faq-item");
          var otherPanel = doc.getElementById(otherButton.getAttribute("aria-controls"));
          otherButton.setAttribute("aria-expanded", "false");
          if (otherItem) otherItem.classList.remove("is-open");
          if (otherPanel) otherPanel.hidden = true;
        });

        if (item && willOpen) {
          var panel = doc.getElementById(button.getAttribute("aria-controls"));
          button.setAttribute("aria-expanded", "true");
          item.classList.add("is-open");
          if (panel) panel.hidden = false;
        }
      });
    });
  }

  function setupReveal() {
    var items = all(".reveal");
    if (!items.length) return;

    all(".offer-card").forEach(function (card, index) {
      card.style.transitionDelay = String((index % 3) * 45) + "ms";
    });

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (item) {
        item.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: "0px 0px -48px 0px"
    });

    items.forEach(function (item) {
      observer.observe(item);
    });
  }

  function setupSectionSpy() {
    if (!("IntersectionObserver" in window)) return;
    var links = all(".primary-nav a[href^='#']");
    var sections = links.map(function (link) {
      return doc.querySelector(link.getAttribute("href"));
    }).filter(Boolean);
    if (!links.length || !sections.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (link) {
          var current = link.getAttribute("href") === "#" + entry.target.id;
          link.classList.toggle("is-current", current);
          if (current) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      });
    }, {
      rootMargin: "-35% 0px -55% 0px",
      threshold: 0
    });

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  function setupCounters() {
    var counters = all("[data-count]");
    if (!counters.length || reduceMotion || !("IntersectionObserver" in window)) return;

    var formatter;
    try { formatter = new Intl.NumberFormat("ru-RU"); } catch (error) { formatter = null; }

    function runCounter(node) {
      var target = Number(node.getAttribute("data-count")) || 0;
      var suffix = node.getAttribute("data-suffix") || "";
      var start = performance.now();
      var duration = 1300;
      var frame = function (now) {
        var t = Math.min((now - start) / duration, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        var value = Math.round(target * eased);
        node.textContent = (formatter ? formatter.format(value) : String(value)) + suffix;
        if (t < 1) window.requestAnimationFrame(frame);
      };
      window.requestAnimationFrame(frame);
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        runCounter(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.6 });

    counters.forEach(function (node) { observer.observe(node); });
  }

  setCurrentDate();
  setupNavigation();
  setupOfferControls();
  setupCalculator();
  setupFaq();
  setupReveal();
  setupSectionSpy();
  setupCounters();

  root.classList.add("is-ready");
})();
