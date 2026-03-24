import React, { useState, useEffect, useCallback } from 'react';
import styles from '../styles/Home.module.css';

// ─── Helpers ───────────────────────────────────────────────────────────────

function getUrgency(dueTimestamp) {
    const diff = dueTimestamp - Date.now();
    const days = diff / (1000 * 60 * 60 * 24);
    if (days <= 5) return 'urgent';
    if (days <= 14) return 'warning';
    return 'safe';
}

function formatShortDate(dateString) {
    return new Date(dateString).toLocaleString('en-AU', {
        weekday: 'short', day: '2-digit', month: 'short',
        year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString('en-AU', {
        hour: '2-digit', minute: '2-digit',
    });
}

// ─── Shared sub-components ─────────────────────────────────────────────────

function UrgencyBadge({ dueTimestamp }) {
    const urgency = getUrgency(dueTimestamp);
    const days = Math.ceil((dueTimestamp - Date.now()) / (1000 * 60 * 60 * 24));
    const label = days === 1 ? '1 day' : `${days} days`;
    return (
        <span className={`${styles.badge} ${styles[`badge_${urgency}`]}`}>
            {urgency === 'urgent' ? '🔴' : urgency === 'warning' ? '🟡' : '🟢'} {label}
        </span>
    );
}

// ─── LIST VIEW ─────────────────────────────────────────────────────────────

function AssessmentCard({ assessment }) {
    const urgency = getUrgency(assessment.dueTimestamp);
    return (
        <li className={`${styles.assessmentItem} ${styles[`item_${urgency}`]}`}>
            <div className={styles.assessmentLeft}>
                <div className={styles.urgencyStripe} data-urgency={urgency} />
                <div className={styles.assessmentContent}>
                    <a href={assessment.htmlUrl} target="_blank" rel="noopener noreferrer"
                        className={styles.assessmentName}>
                        {assessment.name}
                    </a>
                    <div className={styles.assessmentMeta}>
                        <span className={styles.dueDate}>📅 {formatShortDate(assessment.dueAt)}</span>
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
                <button key={f.key}
                    className={`${styles.filterChip} ${urgencyFilter === f.key ? styles.filterChipActive : ''}`}
                    onClick={() => setUrgencyFilter(f.key)}>
                    {f.icon} {f.label}
                </button>
            ))}
        </div>
    );
}

function ListView({ dueData, urgencyFilter, setUrgencyFilter }) {
    const allAssessments = dueData.terms.flatMap(t => t.courses.flatMap(c => c.assessments));
    const urgentCount = allAssessments.filter(a => getUrgency(a.dueTimestamp) === 'urgent').length;
    const warningCount = allAssessments.filter(a => getUrgency(a.dueTimestamp) === 'warning').length;
    const safeCount = allAssessments.filter(a => getUrgency(a.dueTimestamp) === 'safe').length;

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
        (sum, t) => sum + t.courses.reduce((s, c) => s + c.assessments.length, 0), 0
    );

    return (
        <>
            {dueData.totalAssessments > 0 && (
                <>
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
                    <UrgencyLegend urgencyFilter={urgencyFilter} setUrgencyFilter={setUrgencyFilter} />
                </>
            )}

            {filteredTerms.length === 0 ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📭</div>
                    <p className={styles.emptyTitle}>No assessments found</p>
                    <p className={styles.emptySub}>
                        {urgencyFilter !== 'all' ? 'Try a different urgency filter.' : 'Try a different semester or check back later.'}
                    </p>
                </div>
            ) : (
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
                                            {course.assessments.map((a) => (
                                                <AssessmentCard key={a.id} assessment={a} />
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </>
    );
}

// ─── CALENDAR VIEW ─────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

function CalendarView({ dueData }) {
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [selectedDay, setSelectedDay] = useState(null);

    // Build date → assessments map
    const assessmentsByDate = {};
    dueData.terms.forEach((term) => {
        term.courses.forEach((course) => {
            course.assessments.forEach((a) => {
                const d = new Date(a.dueAt);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                if (!assessmentsByDate[key]) assessmentsByDate[key] = [];
                assessmentsByDate[key].push(a);
            });
        });
    });

    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const prevMonth = () => {
        setSelectedDay(null);
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        setSelectedDay(null);
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };
    const goToday = () => {
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
        setSelectedDay(null);
    };

    // Build grid cells
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const handleDayClick = (day) => {
        if (!day) return;
        const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        setSelectedDay(prev => prev && prev.key === key ? null : { key, day, assessments: assessmentsByDate[key] || [] });
    };

    return (
        <div className={styles.calendarWrap}>
            {/* Navigation */}
            <div className={styles.calNav}>
                <button className={styles.calNavBtn} onClick={prevMonth} aria-label="Previous month">‹</button>
                <div className={styles.calNavCenter}>
                    <span className={styles.calMonthLabel}>{MONTHS[viewMonth]} {viewYear}</span>
                    <button className={styles.calTodayBtn} onClick={goToday}>Today</button>
                </div>
                <button className={styles.calNavBtn} onClick={nextMonth} aria-label="Next month">›</button>
            </div>

            {/* Colour legend */}
            <div className={styles.calLegend}>
                <span className={styles.calLegendItem}><span className={`${styles.calLegendDot} ${styles.dotToday}`} />Today</span>
                <span className={styles.calLegendItem}><span className={`${styles.calLegendDot} ${styles.dotUrgent}`} />≤5 days</span>
                <span className={styles.calLegendItem}><span className={`${styles.calLegendDot} ${styles.dotWarning}`} />≤2 weeks</span>
                <span className={styles.calLegendItem}><span className={`${styles.calLegendDot} ${styles.dotSafe}`} />&gt;2 weeks</span>
            </div>

            {/* Day headers + cells */}
            <div className={styles.calGrid}>
                {DAYS.map((d) => (
                    <div key={d} className={styles.calDayHeader}>{d}</div>
                ))}

                {cells.map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`} className={styles.calEmptyCell} />;

                    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isToday = key === todayStr;
                    const dayItems = assessmentsByDate[key] || [];
                    const isSelected = selectedDay && selectedDay.key === key;

                    let dotUrgency = null;
                    if (dayItems.length > 0) {
                        if (dayItems.some(a => getUrgency(a.dueTimestamp) === 'urgent')) dotUrgency = 'urgent';
                        else if (dayItems.some(a => getUrgency(a.dueTimestamp) === 'warning')) dotUrgency = 'warning';
                        else dotUrgency = 'safe';
                    }

                    return (
                        <div
                            key={key}
                            className={[
                                styles.calCell,
                                isToday ? styles.calCellToday : '',
                                isSelected ? styles.calCellSelected : '',
                                dayItems.length > 0 ? styles.calCellHasItems : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => handleDayClick(day)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && handleDayClick(day)}
                        >
                            <span className={styles.calDayNum}>{day}</span>

                            <div className={styles.calPills}>
                                {dayItems.slice(0, 2).map((a) => (
                                    <div key={a.id} className={`${styles.calPill} ${styles[`calPill_${getUrgency(a.dueTimestamp)}`]}`}>
                                        {formatTime(a.dueAt)} {a.name}
                                    </div>
                                ))}
                                {dayItems.length > 2 && (
                                    <div className={styles.calPillMore}>+{dayItems.length - 2} more</div>
                                )}
                            </div>

                            {dotUrgency && <span className={`${styles.calDot} ${styles[`dot_${dotUrgency}`]}`} />}
                        </div>
                    );
                })}
            </div>

            {/* Selected day detail panel */}
            {selectedDay && (
                <div className={styles.calDetail}>
                    <div className={styles.calDetailHeader}>
                        <h3 className={styles.calDetailTitle}>
                            {selectedDay.day} {MONTHS[viewMonth]} {viewYear}
                        </h3>
                        <button className={styles.calDetailClose} onClick={() => setSelectedDay(null)}>✕</button>
                    </div>

                    {selectedDay.assessments.length === 0 ? (
                        <p className={styles.calDetailEmpty}>No assessments due this day.</p>
                    ) : (
                        <ul className={styles.calDetailList}>
                            {selectedDay.assessments.map((a) => {
                                const urg = getUrgency(a.dueTimestamp);
                                return (
                                    <li key={a.id} className={`${styles.calDetailItem} ${styles[`calDetailItem_${urg}`]}`}>
                                        <div className={styles.calDetailStripe} data-urgency={urg} />
                                        <div className={styles.calDetailContent}>
                                            <a href={a.htmlUrl} target="_blank" rel="noopener noreferrer"
                                                className={styles.calDetailName}>{a.name}</a>
                                            <div className={styles.calDetailMeta}>
                                                <span className={styles.calDetailCourse}>{a.courseName}</span>
                                                <span className={styles.calDetailTime}>🕐 {formatShortDate(a.dueAt)}</span>
                                                {a.pointsPossible != null && (
                                                    <span className={styles.calDetailPts}>⭐ {a.pointsPossible} pts</span>
                                                )}
                                            </div>
                                        </div>
                                        <UrgencyBadge dueTimestamp={a.dueTimestamp} />
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function Home() {
    const [dueData, setDueData] = useState({ terms: [], totalAssessments: 0 });
    const [searchText, setSearchText] = useState('');
    const [urgencyFilter, setUrgencyFilter] = useState('all');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [activeTab, setActiveTab] = useState('list');

    const fetchDueAssessments = useCallback(async (queryText = searchText) => {
        setLoading(true);
        setError(null);
        try {
            const query = queryText.trim() ? `?search=${encodeURIComponent(queryText.trim())}` : '';
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
    }, [searchText]);

    useEffect(() => { fetchDueAssessments(searchText); }, []);

    const handleSubmit = (e) => { e.preventDefault(); fetchDueAssessments(searchText); };
    const handleClearFilter = () => { setSearchText(''); fetchDueAssessments(''); };

    return (
        <div className={styles.root}>
            <div className={styles.bgDecor} aria-hidden="true">
                <div className={styles.blob1} />
                <div className={styles.blob2} />
                <div className={styles.blob3} />
            </div>

            {/* Header */}
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
                {/* Search panel */}
                <section className={styles.controlPanel}>
                    <form className={styles.searchForm} onSubmit={handleSubmit}>
                        <div className={styles.inputWrapper}>
                            <span className={styles.inputIcon}>🔍</span>
                            <input
                                type="text"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder="Search classes, quizzes, or semester"
                                className={styles.searchInput}
                            />
                        </div>
                        <div className={styles.btnGroup}>
                            <button type="submit" disabled={loading} className={styles.btnPrimary}>
                                {loading ? <><span className={styles.spinner} /> Loading…</> : 'Search'}
                            </button>
                            <button type="button" onClick={handleClearFilter} disabled={loading} className={styles.btnSecondary}>
                                Show All
                            </button>
                        </div>
                    </form>
                </section>

                {/* Tabs */}
                <div className={styles.tabRow}>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'list' ? styles.tabBtnActive : ''}`}
                        onClick={() => setActiveTab('list')}
                    >
                        📋 List
                    </button>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'calendar' ? styles.tabBtnActive : ''}`}
                        onClick={() => setActiveTab('calendar')}
                    >
                        📅 Calendar
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className={styles.errorBanner}>
                        <span>⚠️ {error}</span>
                        <button onClick={() => fetchDueAssessments(searchText)} className={styles.retryBtn}>Retry</button>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className={styles.loadingWrap}>
                        <span className={styles.spinnerLarge} />
                        <p className={styles.loadingText}>Fetching assessments…</p>
                    </div>
                )}

                {/* Tab content */}
                {!loading && !error && (
                    activeTab === 'list'
                        ? <ListView dueData={dueData} urgencyFilter={urgencyFilter} setUrgencyFilter={setUrgencyFilter} />
                        : <CalendarView dueData={dueData} />
                )}
            </main>

            <footer className={styles.footer}>
                <p>Canvas Assessment Tracker • RMIT University</p>
            </footer>
        </div>
    );
}