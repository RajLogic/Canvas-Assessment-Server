import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Link from 'next/link';
import Image from 'next/image';
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '../styles/Landing.module.css';
import { getDashboardRoute } from '../lib/dashboard-route.js';

const FEATURES = [
    {
        icon: '📋',
        title: 'All Deadlines, One Drawer',
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

const STEPS = [
    { n: 'Card 01', title: 'Create your account', desc: 'Register with email and a password. Takes 10 seconds.' },
    { n: 'Card 02', title: 'Add your Canvas token', desc: 'Paste your Canvas API token from Account → Settings. It stays encrypted in your profile.' },
    { n: 'Card 03', title: 'See all your deadlines', desc: 'Your dashboard loads every upcoming assessment, sorted by urgency and grouped by course.' },
];

function SiteLogo({ size = 26 }) {
    return (
        <Image
            src="/hell.png"
            alt="Final Reckoning"
            width={size}
            height={size}
            style={{ borderRadius: 5, objectFit: 'cover', display: 'block' }}
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
        <div className={styles.page}>
            <Head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
            </Head>

            {/* Ledger backdrop */}
            <div className={styles.backdrop} aria-hidden="true">
                <div className={styles.hatch} />
                <div className={styles.watermark}>FR</div>
                <div className={styles.watermark2} />
            </div>

            {/* Nav */}
            <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
                <div className={styles.navInner}>
                    <div className={styles.navBrand}>
                        <span className={styles.navMark}><SiteLogo size={26} /></span>
                        <span className={styles.navTitle}>Final Reckoning</span>
                    </div>
                    <div className={styles.navLinks}>
                        <Link href="/login" className={styles.navLink}>Log in</Link>
                        <Link href="/register" className={styles.navCta}>Get started</Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className={styles.hero}>
                <div className={styles.heroEyebrow}>
                    <span className={styles.heroEyebrowDot} />
                    Card catalog for your Canvas deadlines
                </div>

                <h1 className={styles.heroTitle}>
                    Never miss a
                    {' '}
                    <span className={styles.heroAccent}>deadline</span>
                    {' '}
                    again.
                </h1>

                <p className={styles.heroSub}>
                    Final Reckoning pulls every assessment from all your enrolled courses, stamps each one
                    by urgency, and files it in one clean drawer — alongside your class timetable.
                </p>

                <div className={styles.heroCtas}>
                    <Link href="/register" className={styles.ctaPrimary}>
                        Create free account
                        {' '}
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

            {/* Fanned index-card stack preview */}
            <section className={styles.stackSection}>
                <CardStack />
            </section>

            {/* Features */}
            <section className={styles.features}>
                <div className={styles.sectionHead}>
                    <p className={styles.sectionEyebrow}>What&apos;s in the drawer</p>
                    <h2 className={styles.sectionTitle}>Everything you need, nothing you don&apos;t</h2>
                    <p className={styles.sectionSub}>Built specifically for Canvas LMS, not a generic tool.</p>
                </div>
                <div className={styles.featureGrid}>
                    {FEATURES.map((f) => (
                        <div key={f.title} className={styles.featureCard}>
                            <span className={styles.featurePunch} aria-hidden="true" />
                            <div className={styles.featureStamp}>{f.icon}</div>
                            <h3 className={styles.featureTitle}>{f.title}</h3>
                            <p className={styles.featureDesc}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* How it works */}
            <section className={styles.howItWorks}>
                <div className={styles.sectionHead}>
                    <p className={styles.sectionEyebrow}>Filing procedure</p>
                    <h2 className={styles.sectionTitle}>Up and running in 3 cards</h2>
                </div>
                <div className={styles.tickets}>
                    {STEPS.map((step) => (
                        <div key={step.n} className={styles.ticket}>
                            <div className={styles.ticketNum}>{step.n}</div>
                            <div className={styles.ticketBody}>
                                <h3 className={styles.ticketTitle}>{step.title}</h3>
                                <p className={styles.ticketDesc}>{step.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA Banner */}
            <section className={styles.ctaBanner}>
                <div className={styles.ticketBig}>
                    <h2 className={styles.ticketBigTitle}>Your reckoning is due.</h2>
                    <p className={styles.ticketBigSub}>Free forever. No credit card. Just your Canvas token.</p>
                    <Link href="/register" className={styles.ctaPrimary}>
                        Get started free
                        {' '}
                        <span className={styles.ctaArrow}>→</span>
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className={styles.footer}>
                <div className={styles.footerInner}>
                    <div className={styles.footerBrand}>
                        <SiteLogo size={20} />
                        <span className={styles.footerBrandName}>Final Reckoning</span>
                    </div>
                    <div className={styles.footerLinks}>
                        <Link href="/login" className={styles.footerLink}>Login</Link>
                        <Link href="/register" className={styles.footerLink}>Register</Link>
                        <a href="https://github.com/RajLogic/canvasHelp" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>GitHub</a>
                    </div>
                    <p className={styles.footerCopy}>© {new Date().getFullYear()} FINAL RECKONING · RAJLOGIC</p>
                </div>
            </footer>
        </div>
    );
}

// ─── Fanned index-card stack (replaces the old browser-frame mock) ────────────

function CardStack() {
    const cards = [
        { name: 'Lab Report 3 — Gas Chromatography', course: 'CHEM1041', urgency: 'urgent', due: '2 DAYS LEFT', pts: 25 },
        { name: 'System Design Document', course: 'ISYS2120', urgency: 'warning', due: '9 DAYS LEFT', pts: 30 },
        { name: 'Final Exam Preparation', course: 'MATH1302', urgency: 'safe', due: '21 DAYS LEFT', pts: 50 },
    ];

    return (
        <div className={styles.stack}>
            {cards.map((c) => (
                <div key={c.name} className={styles.stackCard}>
                    <span className={styles.stackPunch} aria-hidden="true" />
                    <div className={styles.stackTop}>
                        <div>
                            <p className={styles.stackCourse}>{c.course}</p>
                            <p className={styles.stackName}>{c.name}</p>
                        </div>
                        <span className={`${styles.stackStamp} ${styles[c.urgency]}`}>
                            {c.urgency === 'urgent' ? 'Urgent' : c.urgency === 'warning' ? 'Due soon' : 'On track'}
                        </span>
                    </div>
                    <div className={styles.stackMeta}>
                        <span className={styles.stackDue}>{c.due}</span>
                        <span className={styles.stackPts}>⭐ {c.pts} pts</span>
                    </div>
                </div>
            ))}
        </div>
    );
}