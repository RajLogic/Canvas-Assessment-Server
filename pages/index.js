import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '../styles/Landing.module.css';

const FEATURES = [
    {
        icon: '📋',
        title: 'All Deadlines, One View',
        desc: 'Canvas assignments from every enrolled course, sorted by urgency and grouped by term — no more tab-hopping.',
    },
    {
        icon: '📅',
        title: 'Interactive Calendar',
        desc: 'Monthly calendar view with colour-coded urgency indicators. Click any day to see exactly what\'s due.',
    },
    {
        icon: '🕐',
        title: 'Live Timetable Sync',
        desc: 'Connect your iCal subscription link and see your class schedule alongside your assessments in real time.',
    },
    {
        icon: '🔍',
        title: 'Smart Search & Filter',
        desc: 'Search by course name, assessment title, or semester. Filter by urgency — due soon, coming up, or later.',
    },
    {
        icon: '⚡',
        title: 'Server-Side Caching',
        desc: 'Assessments are cached server-side for 5 minutes, so the dashboard loads instantly every time.',
    },
    {
        icon: '🔒',
        title: 'Secure & Private',
        desc: 'Your Canvas API token and data live in your account only. Passwords are hashed with PBKDF2-SHA512.',
    },
];

const STATS = [
    { value: '100%', label: 'Free to use' },
    { value: 'Quick', label: 'Load time' },
    { value: 'All', label: 'Courses tracked' },
];

export default function Landing() {
    const router = useRouter();
    const [scrolled, setScrolled] = useState(false);
    const heroRef = useRef(null);

    useEffect(() => {
        // Check if already logged in — redirect to dashboard
        fetch('/api/auth/session')
            .then((r) => r.json())
            .then((data) => {
                if (data.authenticated) router.replace('/dashboard');
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
            {/* Animated background */}
            <div className={styles.bg} aria-hidden="true">
                <div className={styles.grid} />
                <div className={styles.glow1} />
                <div className={styles.glow2} />
                <div className={styles.glow3} />
            </div>

            {/* Nav */}
            <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
                <div className={styles.navInner}>
                    <div className={styles.navBrand}>
                        <span className={styles.navIcon}>🎓</span>
                        <span className={styles.navTitle}>Canvas Tracker</span>
                    </div>
                    <div className={styles.navLinks}>
                        <Link href="/login" className={styles.navLink}>Log in</Link>
                        <Link href="/register" className={styles.navCta}>Get started</Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className={styles.hero} ref={heroRef}>
                <div className={styles.heroBadge}>
                    <span className={styles.heroBadgeDot} />
                    Built for students By Students
                </div>

                <h1 className={styles.heroTitle}>
                    Never miss a
                    <span className={styles.heroAccent}> deadline</span>
                    <br />again.
                </h1>

                <p className={styles.heroSub}>
                    Canvas Tracker pulls every assessment from all your enrolled courses, sorts them by urgency,
                    and puts them in one clean dashboard — alongside your class timetable.
                </p>

                <div className={styles.heroCtas}>
                    <Link href="/register" className={styles.ctaPrimary}>
                        Create free account
                        <span className={styles.ctaArrow}>→</span>
                    </Link>
                    <Link href="/login" className={styles.ctaSecondary}>
                        Log in
                    </Link>
                </div>

                <div className={styles.heroStats}>
                    {STATS.map((s) => (
                        <div key={s.label} className={styles.heroStat}>
                            <span className={styles.heroStatVal}>{s.value}</span>
                            <span className={styles.heroStatLabel}>{s.label}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Dashboard Preview */}
            <section className={styles.previewSection}>
                <div className={styles.previewFrame}>
                    <div className={styles.previewBar}>
                        <span className={styles.dot} style={{ background: '#ef4444' }} />
                        <span className={styles.dot} style={{ background: '#f59e0b' }} />
                        <span className={styles.dot} style={{ background: '#22c55e' }} />
                        <span className={styles.previewUrl}>canvas-tracker.vercel.app/dashboard</span>
                    </div>
                    <div className={styles.previewContent}>
                        <MockDashboard />
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className={styles.features}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Everything you need, nothing you don&apos;t</h2>
                    <p className={styles.sectionSub}>Built specifically for Canvas LMS, not a generic tool.</p>
                </div>
                <div className={styles.featureGrid}>
                    {FEATURES.map((f) => (
                        <div key={f.title} className={styles.featureCard}>
                            <div className={styles.featureIcon}>{f.icon}</div>
                            <h3 className={styles.featureTitle}>{f.title}</h3>
                            <p className={styles.featureDesc}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* How it works */}
            <section className={styles.howItWorks}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Up and running in 3 steps</h2>
                </div>
                <div className={styles.steps}>
                    {[
                        { n: '01', title: 'Create your account', desc: 'Register with email and a password. Takes 10 seconds.' },
                        { n: '02', title: 'Add your Canvas token', desc: 'Paste your Canvas API token from Account → Settings. It stays encrypted in your profile.' },
                        { n: '03', title: 'See all your deadlines', desc: 'Your dashboard loads every upcoming assessment, sorted by urgency and grouped by course.' },
                    ].map((step) => (
                        <div key={step.n} className={styles.step}>
                            <div className={styles.stepNum}>{step.n}</div>
                            <div className={styles.stepBody}>
                                <h3 className={styles.stepTitle}>{step.title}</h3>
                                <p className={styles.stepDesc}>{step.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA Banner */}
            <section className={styles.ctaBanner}>
                <div className={styles.ctaBannerInner}>
                    <h2 className={styles.ctaBannerTitle}>Ready to stop stressing about deadlines?</h2>
                    <p className={styles.ctaBannerSub}>Free forever. No credit card. Just your Canvas token.</p>
                    <Link href="/register" className={styles.ctaPrimary}>
                        Get started free
                        <span className={styles.ctaArrow}>→</span>
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className={styles.footer}>
                <div className={styles.footerInner}>
                    <div className={styles.footerBrand}>
                        <span>🎓</span>
                        <span className={styles.footerBrandName}>Canvas Tracker</span>
                    </div>
                    <div className={styles.footerLinks}>
                        <Link href="/login" className={styles.footerLink}>Login</Link>
                        <Link href="/register" className={styles.footerLink}>Register</Link>
                        <a href="https://rmit.instructure.com/" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>Canvas</a>
                        <a href="https://github.com/RajLogic/Canvas-Assessment-Server" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>GitHub</a>
                    </div>
                    <p className={styles.footerCopy}>© {new Date().getFullYear()} Canvas Tracker · RajLogic</p>
                </div>
            </footer>
        </div>
    );
}

// ─── Mock Dashboard Preview ───────────────────────────────────────────────────

function MockDashboard() {
    const mockItems = [
        { name: 'Lab Report 3 — Gas Chromatography', course: 'CHEM1041 Chemistry', urgency: 'urgent', days: '2 days left', pts: 25 },
        { name: 'Assignment 2: System Design Document', course: 'ISYS2120 Databases', urgency: 'urgent', days: '4 days left', pts: 30 },
        { name: 'Quiz 4 — Linked Lists & Trees', course: 'COSC2531 Programming', urgency: 'warning', days: '9 days left', pts: 10 },
        { name: 'Reflective Journal Week 8', course: 'BUSM4199 Management', urgency: 'warning', days: '12 days left', pts: 15 },
        { name: 'Final Exam Preparation', course: 'MATH1302 Statistics', urgency: 'safe', days: '21 days left', pts: 50 },
    ];

    return (
        <div className={styles.mockDash}>
            <div className={styles.mockHeader}>
                <div className={styles.mockTitle}>📋 Upcoming Assessments</div>
                <div className={styles.mockStats}>
                    <span className={styles.mockStatU}>🔴 2</span>
                    <span className={styles.mockStatW}>🟡 2</span>
                    <span className={styles.mockStatS}>🟢 1</span>
                </div>
            </div>
            <div className={styles.mockList}>
                {mockItems.map((item, i) => (
                    <div key={i} className={`${styles.mockItem} ${styles[`mock_${item.urgency}`]}`}>
                        <div className={`${styles.mockStripe} ${styles[`stripe_${item.urgency}`]}`} />
                        <div className={styles.mockItemContent}>
                            <div className={styles.mockItemName}>{item.name}</div>
                            <div className={styles.mockItemMeta}>{item.course} · ⭐ {item.pts} pts</div>
                        </div>
                        <span className={`${styles.mockBadge} ${styles[`mockBadge_${item.urgency}`]}`}>
                            {item.urgency === 'urgent' ? '🔴' : item.urgency === 'warning' ? '🟡' : '🟢'} {item.days}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}