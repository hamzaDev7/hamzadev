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
    // 11. Contact form (submits via FormSubmit → hamzazahooryts@gmail.com)
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
                const fd = new FormData(contactForm);
                // If "Other" is selected, send the user's own description as the project type
                const typeSel = document.getElementById('cf-type');
                const otherInput = document.getElementById('cf-other');
                if (typeSel && typeSel.value === 'other') {
                    const custom = otherInput ? otherInput.value.trim() : '';
                    fd.set('project_type', custom ? 'Other: ' + custom : 'Other (not specified)');
                }

                const res = await fetch(contactForm.action, {
                    method: 'POST',
                    body: fd,
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
    // 11b. Contact form "Other" project type → live suggestions (Google)
    // ------------------------------------------------------------------
    (function () {
        const typeSel = document.getElementById('cf-type');
        const otherWrap = document.getElementById('cf-other-wrap');
        const otherInput = document.getElementById('cf-other');
        const list = document.getElementById('cf-other-list');
        if (!typeSel || !otherWrap || !otherInput || !list) return;

        // Curated, always-available fallback suggestions (relevant to dev work)
        const curated = [
            'E-commerce store', 'Mobile app (iOS / Android)', 'WordPress / Shopify build',
            'Chrome extension', 'Browser automation / bot', 'Data dashboard / analytics',
            'Chatbot / AI assistant', 'REST / GraphQL API', 'Landing page',
            'Portfolio website', 'School / college management system', 'CRM / ERP',
            'Food delivery app', 'Real estate platform', 'Fintech app', 'Blockchain / Web3'
        ];

        let debounce = null;
        let items = [];
        let active = -1;
        let seq = 0;

        const esc = (s) => s.replace(/[&<>"']/g, (c) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

        function render(listArr) {
            items = listArr.slice(0, 8);
            if (!items.length) { hide(); return; }
            list.innerHTML = items.map((s, i) =>
                `<li class="ac-item" role="option" data-i="${i}"><i class="ph ph-magnifying-glass"></i><span>${esc(s)}</span></li>`
            ).join('');
            list.classList.add('show');
            active = -1;
        }

        function hide() {
            list.classList.remove('show');
            list.innerHTML = '';
            active = -1;
        }

        // JSONP call to Google's query-suggestion endpoint (CORS-free)
        function googleSuggest(q, cb) {
            const name = '__ggs' + (seq++);
            const script = document.createElement('script');
            let settled = false;
            const done = () => {
                if (settled) return;
                settled = true;
                try { delete window[name]; } catch (e) { window[name] = undefined; }
                script.remove();
            };
            window[name] = (data) => {
                done();
                cb(Array.isArray(data) && Array.isArray(data[1]) ? data[1] : []);
            };
            script.onerror = () => { done(); cb([]); };
            script.src = 'https://suggestqueries.google.com/complete/search?client=firefox&q=' +
                encodeURIComponent(q) + '&callback=' + name;
            document.head.appendChild(script);
            setTimeout(() => { done(); cb([]); }, 3000);
        }

        function merge(primary, secondary) {
            const seen = new Set();
            const out = [];
            for (const s of primary.concat(secondary)) {
                if (!s) continue;
                const k = s.toLowerCase();
                if (!seen.has(k)) { seen.add(k); out.push(s); }
            }
            return out;
        }

        function filterCurated(q) {
            return curated.filter((c) => c.toLowerCase().includes(q.toLowerCase()));
        }

        // Show curated immediately, then blend in live Google suggestions
        function update(q) {
            if (!q) { render(curated); return; }
            googleSuggest(q, (g) => {
                if (otherInput.value.trim().toLowerCase() !== q.toLowerCase()) return; // input changed
                render(merge(g, filterCurated(q)));
            });
            render(merge([], filterCurated(q)));
        }

        typeSel.addEventListener('change', () => {
            const on = typeSel.value === 'other';
            otherWrap.hidden = !on;
            if (on) {
                otherInput.focus();
                update('');
            } else {
                otherInput.value = '';
                hide();
            }
        });

        otherInput.addEventListener('focus', () => {
            if (!otherInput.value.trim()) render(curated);
        });

        otherInput.addEventListener('input', () => {
            const q = otherInput.value.trim();
            clearTimeout(debounce);
            render(q ? filterCurated(q) : curated);
            if (q.length >= 2) debounce = setTimeout(() => update(q), 350);
        });

        // mousedown (not click) so it fires before input blur
        list.addEventListener('mousedown', (e) => {
            const li = e.target.closest('.ac-item');
            if (!li) return;
            e.preventDefault();
            otherInput.value = items[+li.dataset.i] || li.textContent.trim();
            hide();
        });

        otherInput.addEventListener('keydown', (e) => {
            const nodeItems = list.querySelectorAll('.ac-item');
            if (!nodeItems.length) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault(); active = (active + 1) % nodeItems.length; paint(nodeItems);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault(); active = (active - 1 + nodeItems.length) % nodeItems.length; paint(nodeItems);
            } else if (e.key === 'Enter') {
                if (active > -1) { e.preventDefault(); otherInput.value = items[active]; hide(); }
            } else if (e.key === 'Escape') {
                hide();
            }
        });

        function paint(nodeItems) {
            nodeItems.forEach((n, i) => n.classList.toggle('hover', i === active));
            if (nodeItems[active]) nodeItems[active].scrollIntoView({ block: 'nearest' });
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.other-autocomplete')) hide();
        });
    })();

    // ------------------------------------------------------------------
    // 12. Newsletter button
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

    // ------------------------------------------------------------------
    // 13. Project filtering (with live count + empty state)
    // ------------------------------------------------------------------
    const filterBtns = document.querySelectorAll('.filter-btn');
    const projectCards = document.querySelectorAll('.project-card');
    const pfCount = document.getElementById('pf-count');
    const filterCount = document.getElementById('filter-count');
    const filterEmpty = document.getElementById('filter-empty');
    const feReset = document.getElementById('fe-reset');
    const totalProjects = projectCards.length;

    function applyFilter(filter) {
        let visible = 0;

        projectCards.forEach((card) => {
            const categories = card.getAttribute('data-category') || '';
            const match = filter === 'all' || categories.includes(filter);
            card.style.display = match ? '' : 'none';
            if (match) {
                visible++;
                if (hasGSAP) {
                    gsap.fromTo(card, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
                }
            }
        });

        // Update live count
        if (pfCount) pfCount.textContent = visible;
        if (filterCount) {
            filterCount.innerHTML = filter === 'all'
                ? `Showing <strong id="pf-count">${visible}</strong> of ${totalProjects} projects`
                : `Showing <strong id="pf-count">${visible}</strong> of ${totalProjects} projects`;
        }

        // Toggle empty state
        if (filterEmpty) filterEmpty.hidden = visible !== 0;
    }

    filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const filter = btn.getAttribute('data-filter');
            filterBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            applyFilter(filter);
        });
    });

    // Empty-state "Show all" reset
    if (feReset) {
        feReset.addEventListener('click', () => {
            const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
            if (allBtn) allBtn.click();
        });
    }

    // ------------------------------------------------------------------
    // 14. Locked project unlock modal + WhatsApp payment
    // ------------------------------------------------------------------
    const WHATSAPP_NUMBER = '923348910673'; // Pakistan (+92)

    function openUnlockModal(projectName, price, usdPrice) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('unlock-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'unlock-modal';
            modal.className = 'unlock-modal';
            modal.innerHTML = `
                <div class="unlock-modal-overlay"></div>
                <div class="unlock-modal-card">
                    <button class="unlock-modal-close" aria-label="Close">&times;</button>
                    <div class="unlock-modal-icon">🔒</div>
                    <h3>This Project is Locked</h3>
                    <p class="unlock-modal-desc">Want to unlock full access to <strong class="unlock-project-name"></strong>?</p>
                    <div class="unlock-price-tag">
                        <span class="unlock-price-label">Unlock Price</span>
                        <span class="unlock-price-value"></span>
                        <span class="unlock-price-usd"></span>
                    </div>
                    <p class="unlock-features">
                        <i class="ph-bold ph-check-circle"></i> Full source code access<br>
                        <i class="ph-bold ph-check-circle"></i> Complete documentation<br>
                        <i class="ph-bold ph-check-circle"></i> Deployment guide<br>
                        <i class="ph-bold ph-check-circle"></i> 30-day support
                    </p>
                    <button class="unlock-whatsapp-btn">
                        <i class="ph ph-whatsapp-logo"></i>
                        Pay via WhatsApp
                    </button>
                    <p class="unlock-note">You'll be redirected to WhatsApp to complete your payment</p>
                </div>
            `;
            document.body.appendChild(modal);

            // Close handlers
            modal.querySelector('.unlock-modal-close').addEventListener('click', closeUnlockModal);
            modal.querySelector('.unlock-modal-overlay').addEventListener('click', closeUnlockModal);
        }

        // Update content
        modal.querySelector('.unlock-project-name').textContent = projectName;
        modal.querySelector('.unlock-price-value').textContent = '₨' + Number(price).toLocaleString() + ' PKR';
        modal.querySelector('.unlock-price-usd').textContent = '(≈ $' + usdPrice + ' USD)';

        // WhatsApp button handler
        const waBtn = modal.querySelector('.unlock-whatsapp-btn');
        waBtn.onclick = () => {
            const message = encodeURIComponent(
                `Hi Hamza! I want to unlock "${projectName}" for ₨${Number(price).toLocaleString()} PKR (≈ $${usdPrice} USD).\n\nPlease share payment details.`
            );
            window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
            closeUnlockModal();
        };

        // Show modal
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function closeUnlockModal() {
        const modal = document.getElementById('unlock-modal');
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    // Bind all pay buttons
    document.querySelectorAll('.pc-pay-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const projectName = btn.getAttribute('data-name') || 'this project';
            const price = btn.getAttribute('data-price') || '0';
            const usdPrice = btn.getAttribute('data-usd') || '0';
            openUnlockModal(projectName, price, usdPrice);
        });
    });

    // ------------------------------------------------------------------
    // 15. Project detail pages — lock/unlock inline
    // ------------------------------------------------------------------
    document.querySelectorAll('.pc-unlock-inline').forEach((btn) => {
        btn.addEventListener('click', () => {
            const projectName = btn.getAttribute('data-name') || 'this project';
            const price = btn.getAttribute('data-price') || '0';
            const usdPrice = btn.getAttribute('data-usd') || '0';
            openUnlockModal(projectName, price, usdPrice);
        });
    });

    // ------------------------------------------------------------------
    // 16. Live status indicator (pulse animation for live projects)
    // ------------------------------------------------------------------
    document.querySelectorAll('.live-indicator').forEach((el) => {
        if (hasGSAP) {
            gsap.to(el.querySelector('.live-dot'), {
                opacity: 0.3,
                duration: 1,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
            });
        }
    });
});

// ------------------------------------------------------------------
// 15. Custom cursor + click ripple (fine-pointer devices only)
// ------------------------------------------------------------------
(function customCursor() {
    // Only enable on devices with a real (fine) pointer — never on touch
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!fine.matches) return;

    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    const ring = document.createElement('div');
    ring.className = 'cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);
    document.body.classList.add('cursor-on');

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let raf = null;

    const lerp = (a, b, n) => a + (b - a) * n;

    function render() {
        ringX = lerp(ringX, mouseX, 0.18);
        ringY = lerp(ringY, mouseY, 0.18);
        ring.style.transform = `translate(${ringX}px, ${ringY}px)`;
        raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        // dot snaps instantly
        dot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
    }, { passive: true });

    // Enlarge the ring over interactive elements
    const interactiveSelector = 'a, button, [role="button"], input, select, textarea, .filter-btn, .project-card';
    document.addEventListener('mouseover', (e) => {
        if (e.target.closest(interactiveSelector)) ring.classList.add('hovering');
    });
    document.addEventListener('mouseout', (e) => {
        if (e.target.closest(interactiveSelector)) ring.classList.remove('hovering');
    });

    // Press feedback + ripple burst on click/tap
    window.addEventListener('mousedown', (e) => {
        dot.classList.add('pressing');
        spawnRipple(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => dot.classList.remove('pressing'));

    // Ripple on touch too (so mobile users still get the "tap runs" feedback)
    window.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        if (t) spawnRipple(t.clientX, t.clientY);
    }, { passive: true });

    function spawnRipple(x, y) {
        const r = document.createElement('div');
        r.className = 'cursor-ripple';
        r.style.transform = `translate(${x}px, ${y}px)`;
        document.body.appendChild(r);
        r.addEventListener('animationend', () => r.remove());
        // safety cleanup
        setTimeout(() => r.remove(), 700);
    }

    // Pause RAF when the tab is hidden (saves battery)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cancelAnimationFrame(raf);
            raf = null;
        } else if (!raf) {
            raf = requestAnimationFrame(render);
        }
    });
})();

// ------------------------------------------------------------------
// 16. Hero background video — hide cleanly if no source can play
// ------------------------------------------------------------------
(function heroVideoGuard() {
    const video = document.querySelector('.hero-video');
    if (!video) return;

    // Try to autoplay (some browsers need an explicit play() after muted set)
    const tryPlay = () => {
        const p = video.play();
        if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay blocked — gradient shows */ });
    };
    if (video.readyState >= 2) tryPlay();
    video.addEventListener('loadeddata', tryPlay, { once: true });

    // If nothing has buffered after a few seconds, assume all sources failed
    let settled = false;
    const hide = () => {
        if (settled) return;
        settled = true;
        video.style.display = 'none';
    };
    video.addEventListener('error', hide, true);
    setTimeout(() => {
        if (!video.videoWidth && video.readyState < 2) hide();
    }, 5000);
})();
