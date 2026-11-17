/* Interactions of the home page (_layouts/home.html). No dependencies. */
(function () {
  "use strict";

  var root = document.documentElement;
  var header = document.querySelector("[data-header]");
  var nav = document.getElementById("site-nav");
  var navToggle = document.querySelector("[data-nav-toggle]");
  var themeToggle = document.querySelector("[data-theme-toggle]");
  var sections = Array.prototype.slice.call(document.querySelectorAll("[data-section]"));

  /* ---- Color theme ---------------------------------------------------------
     The choice is kept under the same localStorage key ("theme") that the other
     pages of the site use. Without a stored choice the system setting applies;
     the initial value is set by the inline script in the page head. */

  function storedTheme() {
    try {
      return localStorage.getItem("theme");
    } catch (error) {
      return null;
    }
  }

  function applyTheme(theme) {
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("theme", next);
      } catch (error) {
        /* private browsing: the choice just does not persist */
      }
      applyTheme(next);
    });
  }

  if (window.matchMedia) {
    var systemDark = window.matchMedia("(prefers-color-scheme: dark)");
    var followSystem = function (event) {
      var stored = storedTheme();
      if (stored !== "dark" && stored !== "light") {
        applyTheme(event.matches ? "dark" : "light");
      }
    };
    if (systemDark.addEventListener) {
      systemDark.addEventListener("change", followSystem);
    }
  }

  /* ---- Section menu on small screens ------------------------------------- */

  function setMenu(open) {
    if (!nav || !navToggle) {
      return;
    }
    nav.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  if (nav && navToggle) {
    navToggle.addEventListener("click", function () {
      setMenu(!nav.classList.contains("is-open"));
    });
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        setMenu(false);
      }
    });
    document.addEventListener("click", function (event) {
      if (header && !header.contains(event.target)) {
        setMenu(false);
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        setMenu(false);
      }
    });
  }

  /* ---- Header border and current section while scrolling ------------------ */

  var links = {};
  if (nav) {
    Array.prototype.forEach.call(nav.querySelectorAll('a[href^="#"]'), function (link) {
      links[link.getAttribute("href").slice(1)] = link;
    });
  }

  /* A section becomes current at the scroll position where its link would bring it,
     i.e. with its title just below the header. The last sections cannot be scrolled
     that far up, so their positions are squeezed into the scroll range that is left,
     the last one taking over a little before the very bottom. */
  function sectionInView() {
    var scroll = window.scrollY;
    var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    var offset = (header ? header.offsetHeight : 0) + 20;
    if (!sections.length || maxScroll <= 0) {
      return null;
    }

    var starts = sections.map(function (section) {
      var title = section.querySelector("h2") || section;
      return title.getBoundingClientRect().top + scroll - offset;
    });
    var end = Math.max(maxScroll - 32, 0);
    var firstSqueezed = starts.length;
    for (var i = 0; i < starts.length; i += 1) {
      if (starts[i] > end) {
        firstSqueezed = i;
        break;
      }
    }
    if (firstSqueezed < starts.length) {
      var from = firstSqueezed > 0 ? starts[firstSqueezed - 1] : 0;
      var span = starts[starts.length - 1] - from;
      for (var j = firstSqueezed; j < starts.length; j += 1) {
        starts[j] = from + ((starts[j] - from) / span) * (end - from);
      }
    }

    var current = null;
    starts.forEach(function (start, index) {
      if (start <= scroll + 1) {
        current = sections[index];
      }
    });
    return current ? current.getAttribute("data-section") : null;
  }

  /* A link that was just clicked stays highlighted until the reader scrolls away:
     at the end of the page several sections share the same scroll position, and
     the one that was asked for is the one to show as current. */
  var pinned = null;
  var pinSettled = false;
  var pinScroll = 0;
  var pinTimer = null;

  function settlePin() {
    pinSettled = true;
    pinScroll = window.scrollY;
  }

  function pin(id) {
    pinned = id;
    pinSettled = false;
    window.clearTimeout(pinTimer);
    /* fallback for browsers without the scrollend event */
    pinTimer = window.setTimeout(settlePin, 1500);
  }

  function setActive(active) {
    Object.keys(links).forEach(function (id) {
      var isActive = id === active;
      links[id].classList.toggle("is-active", isActive);
      if (isActive) {
        links[id].setAttribute("aria-current", "true");
      } else {
        links[id].removeAttribute("aria-current");
      }
    });
  }

  var ticking = false;

  function update() {
    ticking = false;
    if (header) {
      header.classList.toggle("is-scrolled", window.scrollY > 4);
    }
    setActive(pinned || sectionInView());
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  window.addEventListener(
    "scroll",
    function () {
      if (pinned && pinSettled && Math.abs(window.scrollY - pinScroll) > 40) {
        pinned = null;
      }
      requestUpdate();
    },
    { passive: true }
  );
  window.addEventListener("scrollend", function () {
    if (pinned && !pinSettled) {
      window.clearTimeout(pinTimer);
      settlePin();
    }
  });
  window.addEventListener("resize", requestUpdate);

  document.addEventListener("click", function (event) {
    var link = event.target.closest('a[href^="#"]');
    if (!link) {
      return;
    }
    var id = link.getAttribute("href").slice(1);
    if (links[id]) {
      pin(id);
    } else {
      pinned = null;
    }
    requestUpdate();
  });

  if (links[window.location.hash.slice(1)]) {
    pin(window.location.hash.slice(1));
  }
  update();

  /* ---- Sections below the fold fade in as they are scrolled to ------------
     Only sections that start outside the viewport are hidden, and only from
     here, so the page stays fully readable if this script does not run. */

  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if ("IntersectionObserver" in window && !reducedMotion) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px" }
    );

    sections.forEach(function (section) {
      if (section.getBoundingClientRect().top > window.innerHeight * 0.9) {
        section.classList.add("reveal");
        observer.observe(section);
      }
    });
  }
})();
