// js/main.js — Arranque del sitio público.
// Cada módulo corre dentro de safe(): si uno falla (p. ej. el Estudio IA), los demás siguen vivos.
import { $, getJSON, wa } from './utils.js';
import { store } from './store.js';
import { initTheme } from './theme.js';
import { hydrateIcons } from './icons.js';
import { initSiteHeader } from './site-header.js';
import { initCatalog } from './catalog.js';
import { initCart } from './cart.js';
import { initStudio } from './studio.js';
import { initFloat } from './float.js';
import { initLead } from './lead.js';
import { initHelp } from './help.js';
import { loadSite, renderSite } from './content.js';

const safe = (name, fn) => { try { fn(); } catch (e) { console.error(`[${name}]`, e); } };

// 1) Tema, iconos y header primero: no dependen de la red y evitan parpadeos.
safe('theme', initTheme);
safe('icons', hydrateIcons);
safe('header', initSiteHeader);

// 2) Datos. Catálogo: /api/products (editable en /admin). Sin API (npm run static) o si falla → data/products.json.
try {
    const loadProducts = () => getJSON('/api/products').catch(() => getJSON('data/products.json'));
    [store.site, store.products] = await Promise.all([getJSON('data/site.json'), loadProducts()]);
} catch {
    document.body.insertAdjacentHTML('afterbegin', '<p style="padding:90px 20px">No cargaron los datos. Abre el sitio con un servidor (npm run static), no con doble clic.</p>');
    throw new Error('data');
}

// 3) Enlaces de WhatsApp (un solo número, en data/site.json)
const { whatsapp } = store.site;
const quote = wa(whatsapp, 'Hola PixelCraft, quiero cotizar un proyecto.');
for (const sel of ['#waMain', '#waDrawer']) { const n = $(sel); if (n) n.href = quote; }
if ($('#waFab')) $('#waFab').href = wa(whatsapp, 'Hola PixelCraft, tengo una duda.');

// 4) Módulos
safe('cart', initCart);
safe('catalog', initCatalog);
safe('studio', initStudio);
safe('float', initFloat);
safe('lead', initLead);
safe('help', () => initHelp().catch(e => console.error('[help]', e)));

// 5) Contenido dinámico (botones, insignias, CUPOS REALES, valor, proceso, mensajes de la burbuja). No bloquea lo anterior.
loadSite().then(renderSite).catch(e => console.error('[site]', e));

// Inicializador del Carrusel Hero estilo Mercado Libre (Seguro y sincronizado)
function initHeroCarousel() {
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches; // quien pide menos movimiento no recibe carrusel automático
    const carouselContainer = document.getElementById("mlHeroCarousel");
    const track = document.getElementById("mlTrack");
    if (!track || !carouselContainer) return;

    const slides = Array.from(track.children);
    const nextButton = document.getElementById("mlNext");
    const prevButton = document.getElementById("mlPrev");
    const dotsContainer = document.getElementById("mlDots");
    const dots = Array.from(dotsContainer.children);
    
    let currentIndex = 0;
    const slideCount = slides.length;
    const intervalTime = 10000;
    let slideInterval;

    function updateSlide(index) {
        track.style.transform = `translateX(-${index * 100}%)`;
        dots.forEach((dot, i) => {
            dot.classList.toggle("active", i === index);
        });
        currentIndex = index;
    }

    function startTimer() {
        if (calm) return;
        slideInterval = setInterval(() => {
            let nextIndex = (currentIndex + 1) % slideCount;
            updateSlide(nextIndex);
        }, intervalTime);
    }

    function resetTimer() {
        clearInterval(slideInterval);
        startTimer();
    }

    if (nextButton) {
        nextButton.addEventListener("click", () => {
            let nextIndex = (currentIndex + 1) % slideCount;
            updateSlide(nextIndex);
            resetTimer();
        });
    }

    if (prevButton) {
        prevButton.addEventListener("click", () => {
            let prevIndex = (currentIndex - 1 + slideCount) % slideCount;
            updateSlide(prevIndex);
            resetTimer();
        });
    }

    dots.forEach(dot => {
        dot.addEventListener("click", (e) => {
            const targetIndex = parseInt(e.target.getAttribute("data-index"));
            updateSlide(targetIndex);
            resetTimer();
        });
    });

    // Pausa al colocar el cursor encima (Hover)
    carouselContainer.addEventListener("mouseenter", () => {
        clearInterval(slideInterval);
    });

    carouselContainer.addEventListener("mouseleave", () => {
        startTimer();
    });

    // Soporte para gestos táctiles (Swipe en móviles)
    let touchStartX = 0;
    let touchEndX = 0;

    carouselContainer.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
        clearInterval(slideInterval);
    }, { passive: true });

    carouselContainer.addEventListener("touchend", (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
        startTimer();
    }, { passive: true });

    function handleSwipe() {
        const threshold = 50;
        if (touchEndX < touchStartX - threshold) {
            let nextIndex = (currentIndex + 1) % slideCount;
            updateSlide(nextIndex);
        }
        if (touchEndX > touchStartX + threshold) {
            let prevIndex = (currentIndex - 1 + slideCount) % slideCount;
            updateSlide(prevIndex);
        }
    }

    // Iniciar temporizador automático
    startTimer();
}

// Ejecutar el carrusel de manera segura una vez que el DOM y los módulos están listos
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initHeroCarousel);
} else {
    initHeroCarousel();
}