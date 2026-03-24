import React, { useState, useEffect, useCallback } from 'react';
import styles from '../styles/Home.module.css';

function getUrgency(dueTimestamp) {
    const now = Date.now();
    const diff = dueTimestamp - now;
    const days = diff / (1000 * 60 * 60 * 24);
    if (days <= 5) return 'urgent';
    if (days <= 14) return 'warning';
    return 'safe';
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
    const [termFilter, setTermFilter] = useState('First semester 2026');
    const [urgencyFilter, setUrgencyFilter] = useState('all');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    const fetchDueAssessments = useCallback(async (term = termFilter) => {
        setLoading(true);
        setError(null);
        try {
            const query = term.trim() ? `?term=${encodeURIComponent(term.trim())}` : '';
            const response = await fetch(`/api/assessments/due${query}`);
            if (!response.ok) throw new Error(`Error ${response.status}: Failed to fetch`);
            const data = await response.json();
            setDueData(data);
            setLastUpdated(new Date());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [termFilter]);

    useEffect(() => {
        fetchDueAssessments(termFilter);
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        fetchDueAssessments(termFilter);
    };

    const handleClearFilter = () => {
        setTermFilter('');
        fetchDueAssessments('');
    };

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
    const urgentCount = dueData.terms.flatMap(t => t.courses.flatMap(c => c.assessments)).filter(a => getUrgency(a.dueTimestamp) === 'urgent').length;
    const warningCount = dueData.terms.flatMap(t => t.courses.flatMap(c => c.assessments)).filter(a => getUrgency(a.dueTimestamp) === 'warning').length;
    const safeCount = dueData.terms.flatMap(t => t.courses.flatMap(c => c.assessments)).filter(a => getUrgency(a.dueTimestamp) === 'safe').length;

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
                {/* Control panel */}
                <section className={styles.controlPanel}>
                    <form className={styles.searchForm} onSubmit={handleSubmit}>
                        <div className={styles.inputWrapper}>
                            <span className={styles.inputIcon}>🔍</span>
                            <input
                                type="text"
                                value={termFilter}
                                onChange={(e) => setTermFilter(e.target.value)}
                                placeholder="Filter by semester (e.g. First semester 2026)"
                                className={styles.searchInput}
                            />
                        </div>
                        <div className={styles.btnGroup}>
                            <button type="submit" disabled={loading} className={styles.btnPrimary}>
                                {loading ? (
                                    <><span className={styles.spinner} /> Loading…</>
                                ) : 'Search'}
                            </button>
                            <button
                                type="button"
                                onClick={handleClearFilter}
                                disabled={loading}
                                className={styles.btnSecondary}
                            >
                                Show All
                            </button>
                        </div>
                    </form>

                    {/* Stats row */}
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

                    {/* Urgency filter chips */}
                    {dueData.totalAssessments > 0 && (
                        <UrgencyLegend urgencyFilter={urgencyFilter} setUrgencyFilter={setUrgencyFilter} />
                    )}
                </section>

                {/* Error */}
                {error && (
                    <div className={styles.errorBanner}>
                        <span>⚠️ {error}</span>
                        <button onClick={() => fetchDueAssessments(termFilter)} className={styles.retryBtn}>
                            Retry
                        </button>
                    </div>
                )}

                {/* Empty state */}
                {!loading && !error && filteredTerms.length === 0 && (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>📭</div>
                        <p className={styles.emptyTitle}>No assessments found</p>
                        <p className={styles.emptySub}>
                            {urgencyFilter !== 'all'
                                ? 'Try selecting a different urgency filter.'
                                : 'Try a different semester or check back later.'}
                        </p>
                    </div>
                )}

                {/* Results */}
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
                <p>Canvas Assessment Tracker • RMIT University</p>
            </footer>
        </div>
    );
}