import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import styles from '../styles/Landing.module.css';
import { getDashboardRoute } from '../lib/dashboard-route.js';


function SiteLogo({ size = 28 }) {
    return (
        <Image
            src="/hell.png"
            alt="Final Reckoning"
            width={size}
            height={size}
            style={{ borderRadius: 6, objectFit: 'cover', display: 'block' }}
            priority
        />
    );
}

SiteLogo.propTypes = {
    size: PropTypes.number,
};

export default function Landing() {
    const router = useRouter();
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        fetch('/api/auth/session')
            .then((r) => r.json())
            .then((data) => {
                if (data.authenticated) router.replace(getDashboardRoute(data.user?.dashboardVersion));
            })
            .catch(() => { });
    }, [router]);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 30);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <div className={styles.root}>
            <div className={styles.bg} aria-hidden="true">
                <div className={styles.glow1} />
                <div className={styles.glow2} />
                <div className={styles.glow3} />
            </div>

            <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
                <div className={styles.navInner}>
                    <div className={styles.navBrand}>
                        <SiteLogo size={28} />
                        <span className={styles.navTitle}>Final Reckoning<span>.</span></span>
                    </div>
                    <div className={styles.navLinks}>
                        <Link href="/login" className={styles.navLink}>Log in</Link>
                        <Link href="/register" className={styles.navCta}>Start for free</Link>
                    </div>
                </div>
            </nav>

            <main>
                <section className={styles.hero}>
                    <div className={styles.heroCopy}>
                        <div className={styles.heroBadge}>
                            <span className={styles.heroBadgeDot} />
                            Built by students, for students
                        </div>
                        <h1 className={styles.heroTitle}>
                            Your semester,
                            <span className={styles.heroAccent}> under control.</span>
                        </h1>
                        <p className={styles.heroSub}>
                            One calm, clear place for every assessment, class, and deadline. Sync Canvas and spend less time searching, more time getting things done.
                        </p>
                        <div className={styles.heroCtas}>
                            <Link href="/register" className={styles.ctaPrimary}>
                                Create free account
                            </Link>
                        </div>
                        <div className={styles.heroNote}>
                            <span className={styles.avatarStack} aria-hidden="true"><i /><i /><i /></span>
                            <span>Made for the busy bits of uni life.</span>
                        </div>
                    </div>

                    <div className={styles.previewWrap} aria-label="Preview of the assessment dashboard">
                        <div className={styles.previewGlow} />
                        <div className={styles.dashboard}>
                            <div className={styles.dashboardTop}>
                                <span className={styles.dashboardLogo}>FR</span>
                                <div><strong>Good morning, Alex</strong><small>Tuesday, 12 August</small></div>
                                <span className={styles.dashboardMenu}>•••</span>
                            </div>
                            <div className={styles.dashboardStats}>
                                <div><span>THIS WEEK</span><strong>4 <small>tasks</small></strong></div>
                                <div><span>UP NEXT</span><strong>2 <small>days</small></strong></div>
                            </div>
                            <div className={styles.dashboardHeading}><strong>Upcoming</strong><span>View all →</span></div>
                            <div className={styles.task}>
                                <span className={styles.taskDate}>14<br /><small>AUG</small></span>
                                <span className={styles.taskInfo}><strong>Research proposal</strong><small>EDUC2001 · 11:59 PM</small></span>
                                <span className={styles.taskPill}>Due soon</span>
                            </div>
                            <div className={styles.task}>
                                <span className={styles.taskDate}>16<br /><small>AUG</small></span>
                                <span className={styles.taskInfo}><strong>Problem set 03</strong><small>MATH1020 · 5:00 PM</small></span>
                                <span className={styles.taskCheck}>○</span>
                            </div>
                            <div className={styles.task}>
                                <span className={styles.taskDate}>19<br /><small>AUG</small></span>
                                <span className={styles.taskInfo}><strong>Studio presentation</strong><small>DESN1100 · 9:00 AM</small></span>
                                <span className={styles.taskCheck}>○</span>
                            </div>
                            <div className={styles.dashboardProgress}><span /><small>3 of 7 tasks completed</small></div>
                        </div>
                    </div>
                </section>

                <section className={styles.trustBar} aria-label="Product benefits">
                    <span>Everything you need to stay ahead</span>
                    <div><b>01</b> All your deadlines</div>
                    <div><b>02</b> Less mental load</div>
                    <div><b>03</b> More time to focus</div>
                </section>
                <br></br>
            </main>

            <footer className={styles.footer}>
                <div className={styles.footerInner}>
                    <div className={styles.footerBrand}>
                        <SiteLogo size={22} />
                        <span className={styles.footerBrandName}>final reckoning<span>.</span></span>
                    </div>
                    <div className={styles.footerLinks}>
                        <Link href="/login" className={styles.footerLink}>Login</Link>
                        <Link href="/register" className={styles.footerLink}>Register</Link>
                        <a href="https://github.com/RajLogic/canvasHelp" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>GitHub</a>
                    </div>
                    <p className={styles.footerCopy}>© {new Date().getFullYear()} Final Reckoning · RajLogic</p>
                </div>
            </footer>
        </div>
    );
}
