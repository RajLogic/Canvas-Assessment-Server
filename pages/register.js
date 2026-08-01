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

function PasswordStrength({ password }) {
    if (!password) return null;
    const checks = [
        { label: '8+ characters', ok: password.length >= 8 },
        { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
        { label: 'Number', ok: /\d/.test(password) },
        { label: 'Special character', ok: /[^A-Za-z0-9]/.test(password) },
    ];
    const score = checks.filter((c) => c.ok).length;
    const levels = ['', 'Thin', 'Fair', 'Solid', 'Ironclad'];

    return (
        <div className={styles.strength}>
            <div className={styles.strengthHoles} aria-hidden="true">
                {[1, 2, 3, 4].map((i) => (
                    <span key={i} className={`${styles.strengthHole} ${i <= score ? styles.filled : ''}`} />
                ))}
            </div>
            {score > 0 && <span className={styles.strengthLabel}>{levels[score]}</span>}
            <div className={styles.strengthChecks}>
                {checks.map((c) => (
                    <span key={c.label} className={c.ok ? styles.checkOk : styles.checkNo}>
                        {c.ok ? '●' : '○'} {c.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

PasswordStrength.propTypes = {
    password: PropTypes.string,
};

export default function Register() {
    const router = useRouter();
    const [form, setForm] = useState({ email: '', username: '', password: '', confirm: '' });
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
        if (!form.email || !form.username || !form.password || !form.confirm) {
            setError('Fill in every field to open your card.');
            return;
        }
        if (form.password !== form.confirm) {
            setError('Passwords do not match.');
            return;
        }
        if (form.password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: form.email.trim(),
                    username: form.username.trim(),
                    password: form.password,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || 'Registration failed.');
                return;
            }
            router.push(`${getDashboardRoute(data.user?.dashboardVersion)}?welcome=1`);
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

    const confirmState = !form.confirm
        ? ''
        : form.confirm === form.password
            ? styles.fieldSuccess
            : styles.fieldError;

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
                            <span className={styles.eyebrow}>Card No. 001 · New enrollment</span>
                            <h1 className={styles.title}>Open your card</h1>
                            <p className={styles.subtitle}>Free forever. No credit card needed.</p>
                        </div>
                        <span className={`${styles.badgeStamp} ${styles.gold}`} aria-hidden="true">✎</span>
                    </div>

                    {error && (
                        <div className={styles.alert} role="alert">
                            <span className={styles.alertTag}>Hold up</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form className={styles.form} onSubmit={handleSubmit}>
                        <div className={styles.field}>
                            <label className={styles.fieldLabel} htmlFor="email">Email address</label>
                            <div className={styles.inputWrap}>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    className={styles.input}
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className={styles.field}>
                            <label className={styles.fieldLabel} htmlFor="username">
                                Username
                                <span className={styles.fieldHint}>letters, numbers, _ and -</span>
                            </label>
                            <div className={styles.inputWrap}>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    value={form.username}
                                    onChange={handleChange}
                                    className={styles.input}
                                    placeholder="coolstudent42"
                                    autoComplete="username"
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
                                    placeholder="At least 8 characters"
                                    autoComplete="new-password"
                                />
                            </div>
                            <PasswordStrength password={form.password} />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.fieldLabel} htmlFor="confirm">Confirm password</label>
                            <div className={`${styles.inputWrap} ${confirmState}`}>
                                <input
                                    id="confirm"
                                    name="confirm"
                                    type="password"
                                    value={form.confirm}
                                    onChange={handleChange}
                                    className={styles.input}
                                    placeholder="Repeat password"
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>

                        <p className={styles.note}>
                            Your password is hashed with PBKDF2-SHA512 — we never keep it in plaintext.
                        </p>

                        <button type="submit" className={styles.submit} disabled={loading}>
                            {loading ? (
                                <><span className={styles.spinnerDot} /> Filing your card…</>
                            ) : (
                                <>Create account <span className={styles.submitArrow}>→</span></>
                            )}
                        </button>
                    </form>

                    <div className={styles.switchRow}>
                        Already enrolled?{' '}
                        <Link href="/login" className={styles.switchLink}>Log in</Link>
                    </div>
                </div>
            </main>
        </div>
    );
}