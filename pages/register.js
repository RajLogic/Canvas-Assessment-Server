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

function PasswordStrength({ password }) {
    if (!password) return null;
    const checks = [
        { label: '8+ characters', ok: password.length >= 8 },
        { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
        { label: 'Number', ok: /\d/.test(password) },
        { label: 'Special character', ok: /[^A-Za-z0-9]/.test(password) },
    ];
    const score = checks.filter((c) => c.ok).length;
    const levels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['', '#ef4444', '#f59e0b', '#22c55e', '#10b981'];

    return (
        <div className={styles.strengthWrap}>
            <div className={styles.strengthBar}>
                {[1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className={styles.strengthSegment}
                        style={{ background: i <= score ? colors[score] : undefined }}
                    />
                ))}
            </div>
            <div className={styles.strengthMeta}>
                <span className={styles.strengthChecks}>
                    {checks.map((c) => (
                        <span key={c.label} className={c.ok ? styles.checkOk : styles.checkNo}>
                            {c.ok ? '✓' : '·'} {c.label}
                        </span>
                    ))}
                </span>
                {score > 0 && (
                    <span className={styles.strengthLabel} style={{ color: colors[score] }}>
                        {levels[score]}
                    </span>
                )}
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
            setError('Please fill in all fields.');
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

    if (checking) {
        return (
            <div className={styles.root}>
                <div className={styles.bg}><div className={styles.glow} /></div>
                <div className={styles.loadingCenter}><span className={styles.spinner} /></div>
            </div>
        );
    }

    return (
        <div className={styles.root}>
            <div className={styles.bg} aria-hidden="true">
                <div className={styles.grid} />
                <div className={styles.glow} />
            </div>

            <nav className={styles.nav}>
                <Link href="/" className={styles.navBrand}>
                    <SiteLogo size={24} />
                    <span className={styles.navTitle}>Final Reckoning</span>
                </Link>
            </nav>

            <main className={styles.main}>
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div className={styles.iconWrap}>✨</div>
                        <h1 className={styles.cardTitle}>Create your account</h1>
                        <p className={styles.cardSub}>Free forever. No credit card needed.</p>
                    </div>

                    {error && (
                        <div className={styles.errorBox}>
                            <span className={styles.errorIcon}>⚠️</span>
                            {error}
                        </div>
                    )}

                    <form className={styles.form} onSubmit={handleSubmit}>
                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="email">Email address</label>
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

                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="username">
                                Username
                                {' '}
                                <span className={styles.labelHint}>Letters, numbers, _ and -</span>
                            </label>
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

                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="password">Password</label>
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
                            <PasswordStrength password={form.password} />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="confirm">Confirm password</label>
                            <input
                                id="confirm"
                                name="confirm"
                                type="password"
                                value={form.confirm}
                                onChange={handleChange}
                                className={`${styles.input} ${form.confirm && form.confirm !== form.password ? styles.inputError : ''} ${form.confirm && form.confirm === form.password && form.password ? styles.inputSuccess : ''}`}
                                placeholder="Repeat password"
                                autoComplete="new-password"
                            />
                        </div>

                        <p className={styles.privacyNote}>
                            🔒 Your password is hashed with PBKDF2-SHA512. We never store it in plaintext.
                        </p>

                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                            {loading ? (
                                <><span className={styles.spinner} /> Creating account…</>
                            ) : (
                                <>Create account <span>→</span></>
                            )}
                        </button>
                    </form>

                    <div className={styles.switchRow}>
                        Already have an account?{' '}
                        <Link href="/login" className={styles.switchLink}>Log in</Link>
                    </div>
                </div>
            </main>
        </div>
    );
}

SiteLogo.propTypes = {
    size: PropTypes.number,
};