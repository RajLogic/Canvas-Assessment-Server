import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import styles from '../styles/Auth.module.css';
import { getDashboardRoute } from '../lib/dashboard-route.js';

function SiteLogo({ size = 24 }) {
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

export default function Login() {
    const router = useRouter();
    const [form, setForm] = useState({ identifier: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        fetch('/api/auth/session')
            .then((r) => r.json())
            .then((d) => { if (d.authenticated) void router.replace(getDashboardRoute(d.user?.dashboardVersion)); })
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
            setError('Please fill in all fields.');
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
                setError(data.message || 'Login failed.');
                return;
            }
            void router.push(getDashboardRoute(data.user?.dashboardVersion));
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (checking) {
        return (
            <div className={styles.root}>
                <div className={styles.bg}><div className={styles.glow} /></div>
                <div className={styles.loadingCenter}>
                    <span className={styles.spinner} />
                </div>
            </div>
        );
    }

    return (
        <div className={styles.root}>
            <div className={styles.bg} aria-hidden="true">
                <div className={styles.glow} />
            </div>

            <nav className={styles.nav}>
                <Link href="/" className={styles.navBrand}>
                    <SiteLogo size={24} />
                    <span className={styles.navTitle}>Final Reckoning</span>
                </Link>
            </nav>

            <main className={styles.main}>
                <section className={styles.hero}>
                    <span className={styles.eyebrow}>Your academic command centre</span>
                    <h1 className={styles.heroTitle}>Stay ahead of every deadline.</h1>
                    <p className={styles.heroText}>
                        Final Reckoning brings your Canvas assessments, due dates, and timetable into one calm, focused view.
                    </p>
                    <div className={styles.heroStats}>
                        <div>
                            <strong>01</strong>
                            <span>Sign in once</span>
                        </div>
                        <div>
                            <strong>02</strong>
                            <span>See what&apos;s next</span>
                        </div>
                        <div>
                            <strong>03</strong>
                            <span>Take control</span>
                        </div>
                    </div>
                </section>

                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div className={styles.iconWrap}>🔑</div>
                        <h1 className={styles.cardTitle}>Welcome back</h1>
                        <p className={styles.cardSub}>Log in to your Final Reckoning account</p>
                    </div>

                    {error && (
                        <div className={styles.errorBox}>
                            <span className={styles.errorIcon}>⚠️</span>
                            {error}
                        </div>
                    )}

                    <form className={styles.form} onSubmit={handleSubmit}>
                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="identifier">Email or Username</label>
                            <input
                                id="identifier"
                                name="identifier"
                                type="text"
                                value={form.identifier}
                                onChange={handleChange}
                                className={styles.input}
                                placeholder="you@example.com or username"
                                autoComplete="username"
                            />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="password">Password</label>
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

                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                            {loading ? (
                                <><span className={styles.spinner} /> Logging in…</>
                            ) : (
                                <>Log in <span>→</span></>
                            )}
                        </button>
                    </form>

                    <div className={styles.switchRow}>
                        Don&apos;t have an account?{' '}
                        <Link href="/register" className={styles.switchLink}>Create one free</Link>
                    </div>
                </div>
            </main>
        </div>
    );
}