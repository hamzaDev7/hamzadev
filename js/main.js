document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const hasGSAP = typeof gsap !== 'undefined';
    const hasST = typeof ScrollTrigger !== 'undefined';
    const hasLenis = typeof Lenis !== 'undefined';

    if (hasGSAP && hasST) gsap.registerPlugin(ScrollTrigger);

    // ------------------------------------------------------------------
    // 1. Lenis smooth scrolling (all pages)
    // ------------------------------------------------------------------
    let lenis = null;
    if (hasLenis) {
        lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            direction: 'vertical',
            gestureDirection: 'vertical',
            smooth: true,
            smoothTouch: false,
        });

        if (hasGSAP && hasST) {
            lenis.on('scroll', ScrollTrigger.update);
            gsap.ticker.add((time) => lenis.raf(time * 1000));
            gsap.ticker.lagSmoothing(0);
        } else {
            const raf = (time) => {
                lenis.raf(time);
                requestAnimationFrame(raf);
            };
            requestAnimationFrame(raf);
        }
    }

    function scrollToY(y, opts = {}) {
        if (lenis) lenis.scrollTo(y, opts);
        else window.scrollTo({ top: typeof y === 'number' ? y : 0, behavior: 'smooth' });
    }

    // ------------------------------------------------------------------
    // 2. Mobile menu (hamburger)
    // ------------------------------------------------------------------
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobile-menu');

    function setMenu(open) {
        if (!hamburger || !mobileMenu) return;
        hamburger.classList.toggle('open', open);
        mobileMenu.classList.toggle('show', open);
        document.body.style.overflow = open && !lenis ? 'hidden' : '';
        if (lenis) open ? lenis.stop() : lenis.start();
    }

    if (hamburger && mobileMenu) {
        const toggle = () => setMenu(!mobileMenu.classList.contains('show'));
        hamburger.addEventListener('click', toggle);
        hamburger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        });
        mobileMenu.querySelectorAll('a').forEach((a) => {
            a.addEventListener('click', () => setMenu(false));
        });
    }

    // ------------------------------------------------------------------
    // 3. Anchor smooth scroll (same-page hash links)
    // ------------------------------------------------------------------
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (!href || href === '#') { e.preventDefault(); return; }
            const target = document.querySelector(href);
            if (!target) return;
            e.preventDefault();
            setMenu(false);
            scrollToY(target, { offset: -90 });
            if (hasST) setTimeout(() => ScrollTrigger.refresh(), 600);
        });
    });

    // ------------------------------------------------------------------
    // 4. Nav scrolled state + scrollspy
    // ------------------------------------------------------------------
    const nav = document.querySelector('.glass-nav');
    const onNavScroll = () => {
        if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);
    };
    onNavScroll();
    window.addEventListener('scroll', onNavScroll, { passive: true });

    const spyLinks = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
    if (spyLinks.length && hasGSAP && hasST) {
        spyLinks.forEach((link) => {
            const section = document.querySelector(link.getAttribute('href'));
            if (!section) return;
            ScrollTrigger.create({
                trigger: section,
                start: 'top center',
                end: 'bottom center',
                onToggle: (self) => {
                    if (self.isActive) {
                        spyLinks.forEach((l) => l.classList.remove('active'));
                        link.classList.add('active');
                    }
                },
            });
        });
    }

    // ------------------------------------------------------------------
    // 5. GSAP reveal + stagger animations
    // ------------------------------------------------------------------
    if (hasGSAP) {
        document.querySelectorAll('.gs-reveal').forEach((el) => {
            gsap.fromTo(el,
                { opacity: 0, y: 24 },
                {
                    opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
                    scrollTrigger: hasST ? {
                        trigger: el,
                        start: 'top 88%',
                        toggleActions: 'play none none none',
                    } : undefined,
                }
            );
        });

        document.querySelectorAll('.gs-stagger-parent').forEach((parent) => {
            const children = parent.querySelectorAll('.gs-stagger-child');
            if (!children.length) return;
            gsap.fromTo(children,
                { opacity: 0, y: 20 },
                {
                    opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out',
                    scrollTrigger: hasST ? {
                        trigger: parent,
                        start: 'top 88%',
                        toggleActions: 'play none none none',
                    } : undefined,
                }
            );
        });

        // Counters
        document.querySelectorAll('.counter').forEach((counter) => {
            const target = parseInt(counter.getAttribute('data-target') || '0', 10);
            if (isNaN(target) || target <= 0) return;
            const run = () => {
                const obj = { val: 0 };
                gsap.to(obj, {
                    val: target, duration: 1.8, ease: 'power2.out',
                    onUpdate: () => { counter.textContent = Math.floor(obj.val); },
                });
            };
            if (hasST) {
                ScrollTrigger.create({ trigger: counter, start: 'top 90%', once: true, onEnter: run });
            } else {
                run();
            }
        });
    }

    // ------------------------------------------------------------------
    // 6. Marquees — clone to an even set count covering >= 2x wrapper
    // ------------------------------------------------------------------
    function setupMarquees() {
        document.querySelectorAll('.marquee-content').forEach((marquee) => {
            const wrapper = marquee.parentElement;
            if (!wrapper || !marquee.children.length) return;

            let perSet = parseInt(marquee.dataset.perSet || '', 10);
            if (!perSet) {
                perSet = marquee.children.length;
                marquee.dataset.perSet = String(perSet);
            }

            // Strip previous clones so measurement starts from one clean set
            Array.from(marquee.children).forEach((child) => {
                if (child.getAttribute('aria-hidden') === 'true') child.remove();
            });
            if (marquee.children.length < perSet) return;

            const marginRight = parseFloat(getComputedStyle(marquee.children[0]).marginRight) || 0;
            let setWidth = 0;
            for (let i = 0; i < perSet; i++) {
                setWidth += marquee.children[i].getBoundingClientRect().width + marginRight;
            }
            if (setWidth <= 0) return;

            const needed = Math.max(2, Math.ceil((wrapper.clientWidth * 2) / setWidth));
            const sets = needed % 2 === 0 ? needed : needed + 1;

            const originals = Array.from(marquee.children).slice(0, perSet);
            for (let s = 1; s < sets; s++) {
                originals.forEach((node) => {
                    const clone = node.cloneNode(true);
                    clone.setAttribute('aria-hidden', 'true');
                    marquee.appendChild(clone);
                });
            }
            marquee.dataset.sets = String(sets);
        });
        if (hasST) ScrollTrigger.refresh();
    }
    setupMarquees();
    window.addEventListener('load', setupMarquees);

    // ------------------------------------------------------------------
    // 7. FAQ accordion — single open
    // ------------------------------------------------------------------
    document.querySelectorAll('.faq-item').forEach((item) => {
        const trigger = item.querySelector('.faq-question') || item;
        trigger.addEventListener('click', () => {
            const isOpen = item.classList.contains('active');
            document.querySelectorAll('.faq-item.active').forEach((el) => el.classList.remove('active'));
            if (!isOpen) item.classList.add('active');
            if (hasST) setTimeout(() => ScrollTrigger.refresh(), 450);
        });
    });

    // ------------------------------------------------------------------
    // 8. Scroll-to-top button
    // ------------------------------------------------------------------
    const scrollTopBtn = document.getElementById('scroll-top');
    if (scrollTopBtn) {
        const onScroll = () => scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        scrollTopBtn.addEventListener('click', () => scrollToY(0));
    }

    // ------------------------------------------------------------------
    // 9. Toast + copy email
    // ------------------------------------------------------------------
    function showToast(message) {
        const toast = document.getElementById('copy-toast');
        const toastMsg = document.getElementById('toast-message');
        if (!toast) return;
        if (toastMsg) toastMsg.textContent = message;
        toast.classList.add('show');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => toast.classList.remove('show'), 3200);
    }
    window.showToast = showToast;

    window.copyEmail = function (email = 'hamzazahooryts@gmail.com') {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(email)
                .then(() => showToast(`Copied ${email} to clipboard!`))
                .catch(() => showToast(`Email: ${email}`));
        } else {
            showToast(`Email: ${email}`);
        }
    };

    window.copyPhone = function (phone = '03348910673') {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(phone)
                .then(() => showToast(`Copied ${phone} to clipboard!`))
                .catch(() => showToast(`Phone: ${phone}`));
        } else {
            showToast(`Phone: ${phone}`);
        }
    };

    // ------------------------------------------------------------------
    // 10. Course details modal
    // ------------------------------------------------------------------
    const courseModal = document.getElementById('course-modal');
    const openCourseBtn = document.getElementById('open-course-modal');
    const closeCourseBtn = document.getElementById('close-course-modal');
    const courseAskBtn = document.getElementById('course-ask-btn');

    function setCourseModal(open) {
        if (!courseModal) return;
        courseModal.classList.toggle('show', open);
        courseModal.setAttribute('aria-hidden', String(!open));
        if (lenis) open ? lenis.stop() : lenis.start();
        document.body.style.overflow = open && !lenis ? 'hidden' : '';
    }

    if (courseModal && openCourseBtn) {
        openCourseBtn.addEventListener('click', () => setCourseModal(true));
        closeCourseBtn && closeCourseBtn.addEventListener('click', () => setCourseModal(false));
        courseModal.addEventListener('click', (e) => {
            if (e.target === courseModal) setCourseModal(false);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && courseModal.classList.contains('show')) setCourseModal(false);
        });
        courseAskBtn && courseAskBtn.addEventListener('click', () => setCourseModal(false));
    }

    // ------------------------------------------------------------------
    // 10. Contact form (submits via FormSubmit → hamzazahooryts@gmail.com)
    // ------------------------------------------------------------------
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalHTML = submitBtn ? submitBtn.innerHTML : '';

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Sending...</span><i class="ph ph-circle-notch"></i>';
            }

            try {
                const res = await fetch(contactForm.action, {
                    method: 'POST',
                    body: new FormData(contactForm),
                    headers: { 'Accept': 'application/json' }
                });
                const data = await res.json().catch(() => null);
                if (!res.ok || !data || !(data.success === true || data.success === 'true')) {
                    throw new Error((data && data.message) || 'Send failed');
                }

                if (submitBtn) {
                    submitBtn.innerHTML = '<span>Message Sent!</span><i class="ph ph-check-circle"></i>';
                }
                showToast('Thank you! Your message has been sent successfully.');
                contactForm.reset();
            } catch (err) {
                showToast('Sorry, your message could not be sent. Please email me directly at hamzazahooryts@gmail.com');
            } finally {
                setTimeout(() => {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalHTML;
                    }
                }, 4000);
            }
        });
    }

    // ------------------------------------------------------------------
    // 11. Newsletter button
    // ------------------------------------------------------------------
    const newsletterBtn = document.getElementById('newsletter-btn');
    if (newsletterBtn) {
        newsletterBtn.addEventListener('click', () => {
            const input = newsletterBtn.parentElement.querySelector('input[type="email"]');
            const value = input ? input.value.trim() : '';
            if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                showToast('Please enter a valid email address.');
                return;
            }
            showToast('Subscribed! You are on the list.');
            input.value = '';
        });
    }
});
