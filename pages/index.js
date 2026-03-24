import React, { useState, useEffect, useCallback } from 'react';
import styles from '../styles/Home.module.css';

const LOCAL_CACHE_KEY = 'canvasDueDataCache:v1';
const LOCAL_CACHE_TTL_MS = 5 * 60 * 1000;

function getUrgency(dueTimestamp) {
    const now = Date.now();
    const diff = dueTimestamp - now;
    const days = diff / (1000 * 60 * 60 * 24);
    if (days <= 5) return 'urgent';
    if (days <= 14) return 'warning';
    return 'safe';
}

function formatAge(ms) {
    if (typeof ms !== 'number' || ms < 0) return 'just now';
    if (ms < 60 * 1000) return 'just now';
    const minutes = Math.floor(ms / (60 * 1000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
}

function UrgencyBadge({ dueTimestamp }) {
    const urgency = getUrgency(dueTimestamp);
    const now = Date.now();
    const diff = dueTimestamp - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const label = days === 1 ? '1 day' : `${days} days`;

    return (
        <span className={`${styles.badge} ${styles[`badge_${urgency}`]}`}>
            {urgency === 'urgent' ? '🔴' : urgency === 'warning' ? '🟡' : '🟢'} {label}
        </span>
    );
}

function AssessmentCard({ assessment }) {
    const urgency = getUrgency(assessment.dueTimestamp);

    const formatDueDate = (dateString) =>
        new Date(dateString).toLocaleString('en-AU', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });

    return (
        <li className={`${styles.assessmentItem} ${styles[`item_${urgency}`]}`}>
            <div className={styles.assessmentLeft}>
                <div className={styles.urgencyStripe} data-urgency={urgency} />
                <div className={styles.assessmentContent}>
                    <a
                        href={assessment.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.assessmentName}
                    >
                        {assessment.name}
                    </a>
                    <div className={styles.assessmentMeta}>
                        <span className={styles.dueDate}>
                            📅 {formatDueDate(assessment.dueAt)}
                        </span>
                        {assessment.pointsPossible != null && (
                            <span className={styles.points}>⭐ {assessment.pointsPossible} pts</span>
                        )}
                    </div>
                </div>
            </div>
            <UrgencyBadge dueTimestamp={assessment.dueTimestamp} />
        </li>
    );
}

function UrgencyLegend({ urgencyFilter, setUrgencyFilter }) {
    const filters = [
        { key: 'all', label: 'All', icon: '📋' },
        { key: 'urgent', label: '≤5 days', icon: '🔴' },
        { key: 'warning', label: '≤2 weeks', icon: '🟡' },
        { key: 'safe', label: '>2 weeks', icon: '🟢' },
    ];

    return (
        <div className={styles.legendRow}>
            {filters.map((f) => (
                <button
                    key={f.key}
                    className={`${styles.filterChip} ${urgencyFilter === f.key ? styles.filterChipActive : ''}`}
                    onClick={() => setUrgencyFilter(f.key)}
                >
                    {f.icon} {f.label}
                </button>
            ))}
        </div>
    );
}

export default function Home() {
    const [dueData, setDueData] = useState({ terms: [], totalAssessments: 0 });
    const [urgencyFilter, setUrgencyFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [cacheSource, setCacheSource] = useState('network');
    const [cacheAgeMs, setCacheAgeMs] = useState(0);

    const persistLocalCache = useCallback((data, savedAt) => {
        try {
            localStorage.setItem(
                LOCAL_CACHE_KEY,
                JSON.stringify({ savedAt, data })
            );
        } catch {
            // Ignore cache write failures.
        }
    }, []);

    const loadLocalCache = useCallback(() => {
        try {
            const raw = localStorage.getItem(LOCAL_CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.data) return null;
            if (Date.now() - parsed.savedAt > LOCAL_CACHE_TTL_MS) return null;
            return parsed;
        } catch {
            return null;
        }
    }, []);

    const fetchDueAssessments = useCallback(async ({ forceSync = false, showLoader = true } = {}) => {
        if (showLoader) setLoading(true);
        setError(null);

        try {
            const url = forceSync ? '/api/assessments/due?sync=true' : '/api/assessments/due';
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Error ${response.status}: Failed to fetch`);

            const data = await response.json();
            const fetchedAt = Date.now();

            setDueData(data);
            setLastUpdated(new Date(fetchedAt));
            setCacheSource(data?._cache?.source === 'server-memory' ? 'server-memory' : 'network');
            setCacheAgeMs(data?._cache?.ageMs || 0);
            persistLocalCache(data, fetchedAt);
        } catch (err) {
            setError(err.message);
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [persistLocalCache]);

    useEffect(() => {
        const localCache = loadLocalCache();

        if (localCache) {
            setDueData(localCache.data);
            setLastUpdated(new Date(localCache.savedAt));
            setCacheSource('local');
            setCacheAgeMs(Date.now() - localCache.savedAt);
            setLoading(false);
        }

        fetchDueAssessments({ forceSync: false, showLoader: !localCache });
    }, [fetchDueAssessments, loadLocalCache]);

    // Apply urgency filter to terms
    const filteredTerms = dueData.terms.map((term) => ({
        ...term,
        courses: term.courses.map((course) => ({
            ...course,
            assessments: course.assessments.filter((a) =>
                urgencyFilter === 'all' ? true : getUrgency(a.dueTimestamp) === urgencyFilter
            ),
        })).filter((c) => c.assessments.length > 0),
    })).filter((t) => t.courses.length > 0);

    const filteredTotal = filteredTerms.reduce(
        (sum, t) => sum + t.courses.reduce((s, c) => s + c.assessments.length, 0),
        0
    );

    // Stats for legend
    const urgentCount = dueData.terms.flatMap((t) => t.courses.flatMap((c) => c.assessments)).filter((a) => getUrgency(a.dueTimestamp) === 'urgent').length;
    const warningCount = dueData.terms.flatMap((t) => t.courses.flatMap((c) => c.assessments)).filter((a) => getUrgency(a.dueTimestamp) === 'warning').length;
    const safeCount = dueData.terms.flatMap((t) => t.courses.flatMap((c) => c.assessments)).filter((a) => getUrgency(a.dueTimestamp) === 'safe').length;

    const cacheStatus = loading
        ? 'Syncing...'
        : cacheSource === 'local'
            ? `Showing cached data (${formatAge(cacheAgeMs)})`
            : cacheSource === 'server-memory'
                ? `Using server cache (${formatAge(cacheAgeMs)})`
                : 'Using live data';

    return (
        <div className={styles.root}>
            <div className={styles.bgDecor} aria-hidden="true">
                <div className={styles.blob1} />
                <div className={styles.blob2} />
                <div className={styles.blob3} />
            </div>

            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <div className={styles.logoRow}>
                        <span className={styles.logoIcon}>🎓</span>
                        <div>
                            <h1 className={styles.siteTitle}>Canvas Tracker</h1>
                            <p className={styles.siteSub}>Upcoming assessments at a glance</p>
                        </div>
                    </div>
                    {lastUpdated && (
                        <span className={styles.lastUpdated}>
                            Updated {lastUpdated.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>
            </header>

            <main className={styles.main}>
                <section className={styles.controlPanel}>
                    <div className={styles.controlActions}>
                        <button
                            type="button"
                            onClick={() => fetchDueAssessments({ forceSync: true, showLoader: true })}
                            disabled={loading}
                            className={styles.btnSecondary}
                        >
                            {loading ? (
                                <><span className={styles.spinner} /> Syncing...</>
                            ) : 'Sync now'}
                        </button>
                        <span className={styles.cacheMeta}>{cacheStatus}</span>
                    </div>

                    {dueData.totalAssessments > 0 && (
                        <div className={styles.statsRow}>
                            <div className={`${styles.statCard} ${styles.statUrgent}`}>
                                <span className={styles.statNum}>{urgentCount}</span>
                                <span className={styles.statLabel}>🔴 Due soon</span>
                            </div>
                            <div className={`${styles.statCard} ${styles.statWarning}`}>
                                <span className={styles.statNum}>{warningCount}</span>
                                <span className={styles.statLabel}>🟡 Coming up</span>
                            </div>
                            <div className={`${styles.statCard} ${styles.statSafe}`}>
                                <span className={styles.statNum}>{safeCount}</span>
                                <span className={styles.statLabel}>🟢 Later</span>
                            </div>
                            <div className={`${styles.statCard} ${styles.statTotal}`}>
                                <span className={styles.statNum}>{dueData.totalAssessments}</span>
                                <span className={styles.statLabel}>📋 Total</span>
                            </div>
                        </div>
                    )}

                    {dueData.totalAssessments > 0 && (
                        <UrgencyLegend urgencyFilter={urgencyFilter} setUrgencyFilter={setUrgencyFilter} />
                    )}
                </section>

                {error && (
                    <div className={styles.errorBanner}>
                        <span>⚠️ {error}</span>
                        <button onClick={() => fetchDueAssessments({ forceSync: true, showLoader: true })} className={styles.retryBtn}>
                            Retry
                        </button>
                    </div>
                )}

                {!loading && !error && filteredTerms.length === 0 && (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>📭</div>
                        <p className={styles.emptyTitle}>No assessments found</p>
                        <p className={styles.emptySub}>
                            {urgencyFilter !== 'all'
                                ? 'Try selecting a different urgency filter.'
                                : 'No upcoming assessments right now. Check back later.'}
                        </p>
                    </div>
                )}

                {filteredTerms.length > 0 && (
                    <div className={styles.results}>
                        <div className={styles.resultsHeader}>
                            <h2 className={styles.resultsTitle}>
                                {filteredTotal} assessment{filteredTotal !== 1 ? 's' : ''}
                                {urgencyFilter !== 'all' && (
                                    <span className={styles.filterTag}>
                                        {urgencyFilter === 'urgent' ? '🔴 Due soon' : urgencyFilter === 'warning' ? '🟡 Coming up' : '🟢 Later'}
                                    </span>
                                )}
                            </h2>
                        </div>

                        {filteredTerms.map((term) => (
                            <section key={term.termName} className={styles.termSection}>
                                <div className={styles.termHeader}>
                                    <h3 className={styles.termName}>{term.termName}</h3>
                                    <span className={styles.termCount}>
                                        {term.courses.reduce((s, c) => s + c.assessments.length, 0)} items
                                    </span>
                                </div>

                                <div className={styles.courseGrid}>
                                    {term.courses.map((course) => (
                                        <div key={course.courseId} className={styles.courseCard}>
                                            <div className={styles.courseHeader}>
                                                <h4 className={styles.courseName}>{course.courseName}</h4>
                                                <span className={styles.courseCount}>{course.assessments.length}</span>
                                            </div>
                                            <ul className={styles.assessmentList}>
                                                {course.assessments.map((assessment) => (
                                                    <AssessmentCard key={assessment.id} assessment={assessment} />
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>

            <footer className={styles.footer}>
                <p>Canvas Assessment Tracker • RajLogic</p>
            </footer>
        </div>
    );
}
