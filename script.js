/* =========================================================
   JAN, CINEMATIC PORTFOLIO · script.js
   ========================================================= */

const intro = document.getElementById("intro");
const portfolio = document.getElementById("portfolio");
const enterBtn = document.getElementById("enterBtn");
const skipBtn = document.getElementById("skipBtn");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const THREE_BASE = "https://cdn.jsdelivr.net/npm/three@0.180.0";

let introFinished = false;
let renderer = null;
let camera = null;
let animationId = null;
let startExit = null; // set by the 3D intro so the title can fade out

// Pointer position normalised to -0.5 … 0.5 (drives the 3D title tilt)
let pointerX = 0;
let pointerY = 0;

const introTimer = window.setTimeout(enterPortfolio, 6000);

enterBtn.addEventListener("click", enterPortfolio);
skipBtn.addEventListener("click", enterPortfolio);

window.addEventListener(
  "pointermove",
  (e) => {
    pointerX = e.clientX / window.innerWidth - 0.5;
    pointerY = e.clientY / window.innerHeight - 0.5;
  },
  { passive: true }
);

function enterPortfolio() {
  if (introFinished) return;
  introFinished = true;
  window.clearTimeout(introTimer);
  window.removeEventListener("resize", resizeScene);

  // The 3D title fades out first; its renderer disposes itself when done
  if (startExit) startExit();

  intro.classList.add("exit");
  intro.setAttribute("aria-hidden", "true");
  portfolio.classList.remove("hidden");
  portfolio.classList.add("show");

  window.setTimeout(() => {
    intro.style.display = "none";
  }, 1000);
}

function resizeScene() {
  if (!renderer || !camera || introFinished) return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/* ===== 3D INTRO (Three.js) ===== */

async function create3DIntro() {
  // Reduced-motion visitors keep the static CSS title
  if (reduceMotion) return;

  try {
    const THREE = await import(`${THREE_BASE}/build/three.module.js`);
    const { FontLoader } = await import(`${THREE_BASE}/examples/jsm/loaders/FontLoader.js`);
    const { TextGeometry } = await import(`${THREE_BASE}/examples/jsm/geometries/TextGeometry.js`);

    if (introFinished) return;

    // 1. Scene and camera
    const scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.z = 15;

    // 2. Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.className = "three-canvas";
    intro.appendChild(renderer.domElement);

    // 3. Lights
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));

    const goldLight = new THREE.DirectionalLight(0xffd89b, 4);
    goldLight.position.set(-4, 5, 8);
    scene.add(goldLight);

    const redLight = new THREE.PointLight(0xff2020, 35, 30);
    redLight.position.set(5, 1, 4);
    scene.add(redLight);

    const rimLight = new THREE.PointLight(0x6688ff, 18, 25);
    rimLight.position.set(-5, -2, -3);
    scene.add(rimLight);

    // 4. Font (loaded from the three.js examples)
    const font = await new FontLoader().loadAsync(
      `${THREE_BASE}/examples/fonts/helvetiker_bold.typeface.json`
    );

    if (introFinished) {
      renderer?.dispose();
      renderer = null;
      return;
    }

    // 5. Material and text
    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8c88d,
      metalness: 0.8,
      roughness: 0.24,
      emissive: 0x301006,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0
    });

    const titleGroup = new THREE.Group();
    scene.add(titleGroup);

    // Smaller lettering on narrow screens so it still fits
    const textSize = window.innerWidth < 700 ? 0.95 : 1.65;

    function makeText(text, y) {
      const geometry = new TextGeometry(text, {
        font,
        size: textSize,
        depth: 0.55,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 0.06,
        bevelSize: 0.035,
        bevelSegments: 3
      });

      geometry.computeBoundingBox();
      geometry.center();

      const mesh = new THREE.Mesh(geometry, goldMaterial);
      mesh.position.y = y;
      titleGroup.add(mesh);
    }

    makeText("JAN", 1.05);
    makeText("CREATES", -1.05);

    // Hide the CSS title only once the 3D title exists
    intro.classList.add("three-ready");

    // 6. Animation loop
    const clock = new THREE.Clock();

    let exitStart = null;

    startExit = () => {
      exitStart = performance.now();
    };

    function animate() {
      if (!renderer) return;
      animationId = requestAnimationFrame(animate);

      const t = clock.getElapsedTime();

      // Exit: fade the gold title out and push it toward the camera
      if (exitStart !== null) {
        const k = Math.max(0, 1 - (performance.now() - exitStart) / 800);
        goldMaterial.opacity = k;
        titleGroup.scale.setScalar(1 + (1 - k) * 0.2);
        renderer.render(scene, camera);

        if (k === 0) {
          cancelAnimationFrame(animationId);
          renderer.dispose();
          renderer.domElement.remove();
          renderer = null;
        }
        return;
      }

      // Entrance: fade and grow the title in as the camera settles
      const fadeIn = Math.min(t / 1.4, 1);
      goldMaterial.opacity = fadeIn;
      titleGroup.scale.setScalar(0.9 + 0.1 * fadeIn);

      const progress = Math.min(t / 2.5, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      const targetY = -0.85 * (1 - ease) + Math.sin(t * 0.7) * 0.035 + pointerX * 0.35 * ease;
      const targetX = 0.18 * (1 - ease) + pointerY * 0.2 * ease;

      titleGroup.rotation.y += (targetY - titleGroup.rotation.y) * 0.08;
      titleGroup.rotation.x += (targetX - titleGroup.rotation.x) * 0.08;

      camera.position.z = 15 - 3.5 * ease;
      redLight.position.x = 5 + Math.sin(t) * 1.5;

      renderer.render(scene, camera);
    }

    animate();
    window.addEventListener("resize", resizeScene);
  } catch (error) {
    console.error("3D intro could not load. Using the CSS fallback.", error);

    if (renderer) {
      renderer.dispose();
      renderer.domElement.remove();
      renderer = null;
    }
  }
}

create3DIntro();

/* ===== PORTFOLIO MOTION ===== */

// Scroll progress, navbar state, active link, hero parallax
function initNav() {
  const navbar = document.querySelector(".navbar");
  const progress = document.querySelector(".scroll-progress");
  const giant = document.querySelector(".giant-word");
  const links = document.querySelectorAll(".nav-links a");
  const sections = document.querySelectorAll("main section[id]");

  let ticking = false;

  const update = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;

    if (progress) {
      progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    }

    navbar.classList.toggle("scrolled", y > 40);

    if (giant && !reduceMotion) {
      giant.style.transform = `translate3d(${-y * 0.2}px, 0, 0)`;
    }

    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );

  update();

  if ("IntersectionObserver" in window) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          links.forEach((link) => {
            link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`);
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );

    sections.forEach((section) => navObserver.observe(section));
  }
}

// Fade and slide elements in as they enter the viewport
function initReveal() {
  const items = document.querySelectorAll("[data-reveal], .skills");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("in"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        obs.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );

  items.forEach((el) => observer.observe(el));
}

// Give each skill chip an index so they cascade in one after another
function initSkillStagger() {
  document.querySelectorAll(".skills").forEach((group) => {
    [...group.children].forEach((child, i) => {
      child.style.setProperty("--i", i);
    });
  });
}

// 3D tilt on project cards, with a spotlight that follows the cursor
function initTilt() {
  if (!finePointer || reduceMotion) return;

  document.querySelectorAll("[data-tilt]").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;

      card.style.transform =
        `perspective(900px) rotateX(${(0.5 - py) * 10}deg) ` +
        `rotateY(${(px - 0.5) * 10}deg) translateY(-6px)`;

      card.style.setProperty("--mx", `${px * 100}%`);
      card.style.setProperty("--my", `${py * 100}%`);
    });

    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });
}

// Soft red light that trails the cursor on desktop
function initCursorGlow() {
  const glow = document.querySelector(".cursor-glow");
  if (!glow || !finePointer || reduceMotion) return;

  let x = 0;
  let y = 0;
  let cx = 0;
  let cy = 0;

  window.addEventListener(
    "pointermove",
    (e) => {
      x = e.clientX;
      y = e.clientY;
      glow.classList.add("on");
    },
    { passive: true }
  );

  const loop = () => {
    cx += (x - cx) * 0.12;
    cy += (y - cy) * 0.12;
    glow.style.transform = `translate3d(${cx - 260}px, ${cy - 260}px, 0)`;
    requestAnimationFrame(loop);
  };

  loop();
}

// Buttons that pull slightly toward the cursor
function initMagnetic() {
  if (!finePointer || reduceMotion) return;

  document.querySelectorAll("[data-magnetic]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - (rect.left + rect.width / 2);
      const y = e.clientY - (rect.top + rect.height / 2);
      el.style.transform = `translate3d(${x * 0.3}px, ${y * 0.4}px, 0)`;
    });

    el.addEventListener("pointerleave", () => {
      el.style.transform = "";
    });
  });
}

// Contact form: validates, then opens the visitor's mail app with the message filled in
function initContactForm() {
  const form = document.getElementById("contactForm");
  const status = document.getElementById("formStatus");
  if (!form) return;

  const MY_EMAIL = "jegan171104@gmail.com";

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const name = String(data.get("name")).trim();
    const email = String(data.get("email")).trim();
    const reason = String(data.get("reason"));
    const message = String(data.get("message")).trim();

    const subject = `Portfolio Contact: ${reason}`;
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Topic: ${reason}`,
      "",
      "Message:",
      message
    ].join("\n");

    if (status) status.textContent = "Opening your mail app...";

    window.location.href =
      `mailto:${MY_EMAIL}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
  });
}

initSkillStagger();
initNav();
initReveal();
initTilt();
initCursorGlow();
initContactForm();
initMagnetic();
