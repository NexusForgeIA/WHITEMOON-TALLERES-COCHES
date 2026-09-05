/* =========================================================================
   Taller Ejemplo — interacciones de la web
   Sin librerías externas (antes esto eran dos ficheros de GSAP desde CDN).
   Respeta prefers-reduced-motion.
   ========================================================================= */
(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- Scroll: un solo listener, agrupado en rAF ----------
     Leer scrollY/offsetTop y escribir clases en el mismo tick provoca
     forced reflow. Aquí se lee una vez por frame y las medidas de las
     secciones van en caché: el scroll-spy no vuelve a medir el documento en
     cada evento, solo cuando cambia el tamaño de la ventana. */
  const onScroll = [];
  let ticking = false;
  const runScroll = () => {
    const y = window.scrollY;
    for (const fn of onScroll) fn(y);
    ticking = false;
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(runScroll); }
  }, { passive: true });

  /* ---------- Nav ---------- */
  const nav = $("#nav");
  if (nav) onScroll.push((y) => nav.classList.toggle("scrolled", y > 40));

  const burger = $("#burger");
  const menu = $("#mobileMenu");
  if (burger && menu) {
    const setMenu = (open) => {
      menu.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    };
    burger.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
    $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("open")) setMenu(false);
    });
  }

  /* ---------- Scroll-spy perezoso ----------
     Las posiciones se calculan una vez y se refrescan al redimensionar, no
     en cada evento de scroll. El enlace activo solo se reescribe cuando
     cambia de sección, así que el caso normal es cero escrituras en el DOM. */
  const links = $$("#navLinks a");
  if (links.length) {
    const secciones = links
      .map((a) => {
        const id = (a.getAttribute("href") || "").replace("#", "");
        const el = id ? document.getElementById(id) : null;
        return el ? { a, el, top: 0 } : null;
      })
      .filter(Boolean);

    let medido = false;
    const medir = () => {
      for (const s of secciones) s.top = s.el.getBoundingClientRect().top + window.scrollY;
      medido = true;
    };
    let activo = null;
    onScroll.push((y) => {
      if (!medido) medir();
      let actual = secciones[0] || null;
      for (const s of secciones) if (y >= s.top - 150) actual = s;
      if (actual === activo) return;
      if (activo) activo.a.classList.remove("active");
      if (actual) actual.a.classList.add("active");
      activo = actual;
    });
    window.addEventListener("resize", () => { medido = false; }, { passive: true });
    window.addEventListener("load", medir);
  }

  /* ---------- Marquee: se duplica para que el bucle no tenga costura ---------- */
  const marquee = $("#marquee");
  if (marquee) marquee.append(...Array.from(marquee.children).map((n) => n.cloneNode(true)));

  /* ---------- Palabra rotatoria del hero ----------
     No es contenido: el h1 ya dice lo importante. Con reduced-motion se
     queda con la primera palabra y no se programa ningún intervalo. */
  const rot = $("#rotWord");
  if (rot && !reduced) {
    const palabras = ["mantenimiento", "diagnosis", "frenos", "neumáticos", "aire acondicionado"];
    let i = 0;
    setInterval(() => {
      rot.classList.add("out");
      setTimeout(() => {
        i = (i + 1) % palabras.length;
        rot.textContent = palabras[i];
        rot.classList.remove("out");
      }, 420);
    }, 2600);
  }

  /* ---------- FAQ ----------
     El disparador es un <button> real con aria-expanded: se abre con Enter y
     con Espacio, y un lector de pantalla anuncia si está abierta o cerrada. */
  $$(".faq-q").forEach((q) => {
    q.addEventListener("click", () => {
      const item = q.closest(".faq-item");
      const abierta = item.classList.toggle("open");
      q.setAttribute("aria-expanded", abierta ? "true" : "false");
    });
  });

  /* ---------- Reveal al entrar en pantalla ----------
     IntersectionObserver en vez de ScrollTrigger: el observer no corre en el
     hilo del scroll y cada elemento deja de observarse en cuanto aparece. */
  const reveals = $$(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("is-in"));
  } else {
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    }, { rootMargin: "0px 0px -10% 0px" });
    reveals.forEach((el) => io.observe(el));
  }

  /* ---------- Vídeo del hero ----------
     Sin `autoplay` en el HTML a propósito: con autoplay el navegador se baja
     el vídeo aunque el CSS lo esconda en móvil, y eso es un MP4 de 720p que
     el visitante nunca llega a ver. Con preload="none" no se pide nada hasta
     que se llama a play(), y solo se llama donde el vídeo se ve de verdad. */
  const video = $(".hero-video");
  if (video && !reduced && window.matchMedia("(min-width:769px)").matches) {
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  }

  /* ---------- Año del pie ---------- */
  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
