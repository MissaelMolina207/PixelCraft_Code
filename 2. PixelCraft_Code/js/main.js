import { $, getJSON, wa, toast } from './utils.js';
import { store } from './store.js';
import { initCatalog } from './catalog.js';
import { initCart } from './cart.js';
import { initStudio } from './studio.js';
import { initLead } from './lead.js';

try {
    [store.site, store.products] = await Promise.all([getJSON('data/site.json'), getJSON('data/products.json')]);
} catch {
    document.body.insertAdjacentHTML('afterbegin', '<p style="padding:90px 20px">No cargaron los datos. Abre el sitio con un servidor (npm run static), no con doble clic.</p>');
    throw new Error('data');
}

const { whatsapp, slots } = store.site;
$('#waMain').href = $('#waDock').href = wa(whatsapp, 'Hola PixelCraft, quiero cotizar un proyecto.');
$('#slotsTxt').textContent = `${slots.total - slots.used} de ${slots.total} disponibles`;
$('#slotsBar').style.width = slots.used / slots.total * 100 + '%';

// Inicializar componentes del sitio
initCart(); 
initCatalog(); 
initStudio(); 
initLead();

// Inicializador del Carrusel Hero estilo Mercado Libre (Seguro y sincronizado)
function initHeroCarousel() {
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