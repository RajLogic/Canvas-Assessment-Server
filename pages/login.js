import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Link from 'next/link';
import Image from 'next/image';
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '../styles/Auth.module.css';
import { getDashboardRoute } from '../lib/dashboard-route.js';

function SiteLogo({ size = 22 }) {
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

export default function Login() {
    const router = useRouter();
    const [form, setForm] = useState({ identifier: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        fetch('/api/auth/session')
            .then((r) => r.json())
            .then((d) => { if (d.authenticated) router.replace(getDashboardRoute(d.user?.dashboardVersion)); })
            .catch(() => { })
            .finally(() => setChecking(false));
    }, [router]);

    const handleChange = (e) => {
        setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.identifier.trim() || !form.password) {
            setError('Fill in both fields before logging in.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: form.identifier.trim(), password: form.password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || 'That card doesn\'t match our records.');
                return;
            }
            router.push(getDashboardRoute(data.user?.dashboardVersion));
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const HeadTags = () => (
        <Head>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </Head>
    );

    if (checking) {
        return (
            <div className={styles.page}>
                <HeadTags />
                <div className={styles.backdrop}><div className={styles.hatch} /></div>
                <div className={styles.loadingStage}>
                    <span className={styles.stampSpinner}>Checking your card</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <HeadTags />
            <div className={styles.backdrop} aria-hidden="true">
                <div className={styles.hatch} />
                <div className={styles.watermark}>FR</div>
            </div>

            <nav className={styles.topbar}>
                <Link href="/" className={styles.brand}>
                    <span className={styles.brandMark}><SiteLogo size={22} /></span>
                    <span className={styles.brandName}>Final Reckoning</span>
                </Link>
            </nav>

            <main className={styles.stage}>
                <div className={styles.card}>
                    <span className={styles.punch} aria-hidden="true" />

                    <div className={styles.cardHeader}>
                        <div className={styles.eyebrowGroup}>
                            <span className={styles.eyebrow}>Card No. 002 · Sign in</span>
                            <h1 className={styles.title}>Welcome back</h1>
                            <p className={styles.subtitle}>Pull up your record to see what&apos;s due.</p>
                        </div>
                        <span className={styles.badgeStamp} aria-hidden="true">🔑</span>
                    </div>

                    {error && (
                        <div className={styles.alert} role="alert">
                            <span className={styles.alertTag}>Denied</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form className={styles.form} onSubmit={handleSubmit}>
                        <div className={styles.field}>
                            <label className={styles.fieldLabel} htmlFor="identifier">Email or Username</label>
                            <div className={styles.inputWrap}>
                                <input
                                    id="identifier"
                                    name="identifier"
                                    type="text"
                                    value={form.identifier}
                                    onChange={handleChange}
                                    className={styles.input}
                                    placeholder="you@example.com or username"
                                    autoComplete="username"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className={styles.field}>
                            <label className={styles.fieldLabel} htmlFor="password">Password</label>
                            <div className={styles.inputWrap}>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    className={styles.input}
                                    placeholder="Your password"
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>

                        <button type="submit" className={styles.submit} disabled={loading}>
                            {loading ? (
                                <><span className={styles.spinnerDot} /> Stamping you in…</>
                            ) : (
                                <>Log in <span className={styles.submitArrow}>→</span></>
                            )}
                        </button>
                    </form>

                    <div className={styles.switchRow}>
                        New here?{' '}
                        <Link href="/register" className={styles.switchLink}>Open a free card</Link>
                    </div>
                </div>
            </main>
        </div>
    );
}