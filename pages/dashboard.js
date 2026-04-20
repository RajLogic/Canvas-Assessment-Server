import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';
import dashStyles from '../styles/Dashboard.module.css';
import sidebarStyles from '../styles/FilterSidebar.module.css';
import Image from 'next/image';

// ─── Helpers ───────────────────────────────────────────────────────────────
function SiteLogo({ size = 32 }) {
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

function getUrgency(dueTimestamp) {
    const diff = dueTimestamp - Date.now();
    const days = diff / (1000 * 60 * 60 * 24);
    if (days <= 5) return 'urgent';
    if (days <= 14) return 'warning';
    return 'safe';
}

function getDaysLeftLabel(dueTimestamp) {
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysLeft = Math.ceil((dueTimestamp - Date.now()) / msPerDay);
    if (daysLeft < 0) {
        const overdueDays = Math.abs(daysLeft);
        return `${overdueDays} day${overdueDays !== 1 ? 's' : ''} overdue`;
    }
    if (daysLeft === 0) return 'Due today';
    return `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
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

// ─── Hidden assessments storage ────────────────────────────────────────────
const HIDDEN_KEY = 'fr_hidden_assessments';

function loadHidden() {
    try {
        const raw = localStorage.getItem(HIDDEN_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
}

function saveHidden(set) {
    try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set]));
    } catch { /* ignore */ }
}

// ─── Filter / Sort logic ───────────────────────────────────────────────────
function applyFiltersAndSort(dueData, filters, hiddenIds, showHidden) {
    const allTerms = dueData.terms;

    const filtered = allTerms.map(term => {
        const courses = term.courses.map(course => {
            let assessments = course.assessments.filter(a => {
                const isHidden = hiddenIds.has(String(a.id));
                if (showHidden) return isHidden;
                return !isHidden;
            });

            // Year filter
            if (filters.years?.length > 0) {
                assessments = assessments.filter(a =>
                    filters.years.includes(new Date(a.dueAt).getFullYear())
                );
            }

            // Term filter
            if (filters.terms?.length > 0) {
                if (!filters.terms.includes(term.termName)) return { ...course, assessments: [] };
            }

            // Course ID filter
            if (filters.courseIds?.length > 0) {
                if (!filters.courseIds.includes(course.courseId)) return { ...course, assessments: [] };
            }

            // Course code filter
            if (filters.courseCodes?.length > 0) {
                const codeMatch = course.courseName.match(/^([A-Z]{2,6}\d{3,5}[A-Z]?)/);
                const code = codeMatch ? codeMatch[1] : null;
                if (!code || !filters.courseCodes.includes(code)) return { ...course, assessments: [] };
            }

            // Sort
            const sortBy = filters.sortBy || 'dueDate';
            const sortDir = filters.sortDir || 'asc';
            assessments = [...assessments].sort((a, b) => {
                let av, bv;
                if (sortBy === 'dueDate') { av = a.dueTimestamp; bv = b.dueTimestamp; }
                else if (sortBy === 'courseName') { av = a.courseName; bv = b.courseName; }
                else if (sortBy === 'points') { av = a.pointsPossible ?? -1; bv = b.pointsPossible ?? -1; }
                else if (sortBy === 'name') { av = a.name; bv = b.name; }
                if (av < bv) return sortDir === 'asc' ? -1 : 1;
                if (av > bv) return sortDir === 'asc' ? 1 : -1;
                return 0;
            });

            return { ...course, assessments };
        }).filter(c => c.assessments.length > 0);

        return { ...term, courses };
    }).filter(t => t.courses.length > 0);

    return filtered;
}

// ─── Shared sub-components ─────────────────────────────────────────────────

const UrgencyBadge = memo(function UrgencyBadge({ dueTimestamp }) {
    const urgency = getUrgency(dueTimestamp);
    const label = getDaysLeftLabel(dueTimestamp);
    return (
        <span className={`${styles.badge} ${styles[`badge_${urgency}`]}`}>
            {urgency === 'urgent' ? '🔴' : urgency === 'warning' ? '🟡' : '🟢'} {label}
        </span>
    );
});

// ─── Assessment Card with hide button ─────────────────────────────────────

const AssessmentCard = memo(function AssessmentCard({ assessment, onHide, onUnhide, isHidden }) {
    const urgency = getUrgency(assessment.dueTimestamp);
    return (
        <li className={`${styles.assessmentItem} ${styles[`item_${isHidden ? 'safe' : urgency}`]} ${isHidden ? dashStyles.hiddenItem : ''}`}>
            <div className={styles.assessmentLeft}>
                <div className={styles.urgencyStripe} data-urgency={isHidden ? 'safe' : urgency} />
                <div className={styles.assessmentContent}>
                    <a href={assessment.htmlUrl} target="_blank" rel="noopener noreferrer" className={styles.assessmentName}>
                        {assessment.name}
                    </a>
                    <div className={styles.assessmentMeta}>
                        <span className={styles.dueDate}>📅 {formatShortDate(assessment.dueAt)}</span>
                        {assessment.pointsPossible != null && (
                            <span className={styles.points}>⭐ {assessment.pointsPossible} pts</span>
                        )}
                        {isHidden && <span className={dashStyles.hiddenTag}>Hidden</span>}
                    </div>
                </div>
            </div>
            <div className={dashStyles.cardActions}>
                {!isHidden && <UrgencyBadge dueTimestamp={assessment.dueTimestamp} />}
                <button
                    className={isHidden ? dashStyles.unhideBtn : dashStyles.hideBtn}
                    onClick={() => isHidden ? onUnhide(assessment.id) : onHide(assessment.id)}
                    title={isHidden ? 'Restore assessment' : 'Hide assessment'}
                    aria-label={isHidden ? `Restore ${assessment.name}` : `Hide ${assessment.name}`}
                >
                    {isHidden ? '↩ Restore' : '✕ Hide'}
                </button>
            </div>
        </li>
    );
});

const UrgencyLegend = memo(function UrgencyLegend({ urgencyFilter, setUrgencyFilter }) {
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
});

// ─── Filter Sidebar (inline, no separate file import) ─────────────────────

const FilterSidebar = memo(function FilterSidebar({ dueData, filters, onFiltersChange, isOpen, onClose }) {
    const allAssessments = dueData.terms.flatMap(t => t.courses.flatMap(c => c.assessments));

    const years = [...new Set(allAssessments.map(a => new Date(a.dueAt).getFullYear()))].sort((a, b) => b - a);
    const terms = [...new Set(dueData.terms.map(t => t.termName))].sort();
    const courses = [...new Map(allAssessments.map(a => [a.courseId, { id: a.courseId, name: a.courseName }])).values()]
        .sort((a, b) => a.name.localeCompare(b.name));
    const courseCodes = [...new Set(
        courses.map(c => { const m = c.name.match(/^([A-Z]{2,6}\d{3,5}[A-Z]?)/); return m ? m[1] : null; }).filter(Boolean)
    )].sort();

    const toggle = (key, value) => {
        const current = filters[key] || [];
        const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
        onFiltersChange({ ...filters, [key]: next });
    };

    const clearAll = () => onFiltersChange({ years: [], terms: [], courseIds: [], courseCodes: [], sortBy: 'dueDate', sortDir: 'asc' });

    const activeCount = (filters.years?.length || 0) + (filters.terms?.length || 0) +
        (filters.courseIds?.length || 0) + (filters.courseCodes?.length || 0);

    return (
        <>
            {isOpen && <div className={sidebarStyles.backdrop} onClick={onClose} />}
            <aside className={`${sidebarStyles.sidebar} ${isOpen ? sidebarStyles.sidebarOpen : ''}`}>
                <div className={sidebarStyles.sidebarHeader}>
                    <span className={sidebarStyles.sidebarTitle}>Filters &amp; Sort</span>
                    {activeCount > 0 && (
                        <button className={sidebarStyles.clearBtn} onClick={clearAll}>Clear all ({activeCount})</button>
                    )}
                    <button className={sidebarStyles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
                </div>

                <div className={sidebarStyles.sidebarBody}>
                    <section className={sidebarStyles.section}>
                        <h3 className={sidebarStyles.sectionTitle}>Sort by</h3>
                        <div className={sidebarStyles.sortRow}>
                            <select
                                className={sidebarStyles.select}
                                value={filters.sortBy || 'dueDate'}
                                onChange={e => onFiltersChange({ ...filters, sortBy: e.target.value })}
                            >
                                <option value="dueDate">Due date</option>
                                <option value="courseName">Course name</option>
                                <option value="points">Points</option>
                                <option value="name">Assessment name</option>
                            </select>
                            <button
                                className={sidebarStyles.dirBtn}
                                onClick={() => onFiltersChange({ ...filters, sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' })}
                            >
                                {filters.sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
                            </button>
                        </div>
                    </section>

                    {years.length > 0 && (
                        <section className={sidebarStyles.section}>
                            <h3 className={sidebarStyles.sectionTitle}>
                                Year
                                {filters.years?.length > 0 && <span className={sidebarStyles.activeCount}>{filters.years.length}</span>}
                            </h3>
                            <div className={sidebarStyles.chipGroup}>
                                {years.map(y => (
                                    <button key={y}
                                        className={`${sidebarStyles.chip} ${filters.years?.includes(y) ? sidebarStyles.chipActive : ''}`}
                                        onClick={() => toggle('years', y)}>{y}</button>
                                ))}
                            </div>
                        </section>
                    )}

                    {terms.length > 0 && (
                        <section className={sidebarStyles.section}>
                            <h3 className={sidebarStyles.sectionTitle}>
                                Semester
                                {filters.terms?.length > 0 && <span className={sidebarStyles.activeCount}>{filters.terms.length}</span>}
                            </h3>
                            <div className={sidebarStyles.chipGroup}>
                                {terms.map(t => (
                                    <button key={t}
                                        className={`${sidebarStyles.chip} ${filters.terms?.includes(t) ? sidebarStyles.chipActive : ''}`}
                                        onClick={() => toggle('terms', t)}>{t}</button>
                                ))}
                            </div>
                        </section>
                    )}

                    {courseCodes.length > 0 && (
                        <section className={sidebarStyles.section}>
                            <h3 className={sidebarStyles.sectionTitle}>
                                Course code
                                {filters.courseCodes?.length > 0 && <span className={sidebarStyles.activeCount}>{filters.courseCodes.length}</span>}
                            </h3>
                            <div className={sidebarStyles.chipGroup}>
                                {courseCodes.map(code => (
                                    <button key={code}
                                        className={`${sidebarStyles.chip} ${filters.courseCodes?.includes(code) ? sidebarStyles.chipActive : ''}`}
                                        onClick={() => toggle('courseCodes', code)}>{code}</button>
                                ))}
                            </div>
                        </section>
                    )}

                    {courses.length > 0 && (
                        <section className={sidebarStyles.section}>
                            <h3 className={sidebarStyles.sectionTitle}>
                                Course
                                {filters.courseIds?.length > 0 && <span className={sidebarStyles.activeCount}>{filters.courseIds.length}</span>}
                            </h3>
                            <div className={sidebarStyles.courseList}>
                                {courses.map(c => (
                                    <label key={c.id} className={sidebarStyles.courseRow}>
                                        <input type="checkbox" className={sidebarStyles.checkbox}
                                            checked={filters.courseIds?.includes(c.id) || false}
                                            onChange={() => toggle('courseIds', c.id)} />
                                        <span className={sidebarStyles.courseLabel}>{c.name}</span>
                                    </label>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </aside>
        </>
    );
});

// ─── LIST VIEW ─────────────────────────────────────────────────────────────

const ListView = memo(function ListView({
    dueData, urgencyFilter, setUrgencyFilter, filters, hiddenIds, onHide, onUnhide, showHidden
}) {
    const filteredTerms = useMemo(() => {
        const base = applyFiltersAndSort(dueData, filters, hiddenIds, showHidden);
        return base.map(term => ({
            ...term,
            courses: term.courses.map(course => ({
                ...course,
                assessments: course.assessments.filter(a =>
                    urgencyFilter === 'all' || getUrgency(a.dueTimestamp) === urgencyFilter
                ),
            })).filter(c => c.assessments.length > 0),
        })).filter(t => t.courses.length > 0);
    }, [dueData, filters, hiddenIds, urgencyFilter, showHidden]);

    const allVisible = filteredTerms.flatMap(t => t.courses.flatMap(c => c.assessments));
    const allRaw = useMemo(() => applyFiltersAndSort(dueData, { ...filters, sortBy: 'dueDate', sortDir: 'asc' }, hiddenIds, showHidden)
        .flatMap(t => t.courses.flatMap(c => c.assessments)), [dueData, filters, hiddenIds, showHidden]);

    const urgentCount = allRaw.filter(a => getUrgency(a.dueTimestamp) === 'urgent').length;
    const warningCount = allRaw.filter(a => getUrgency(a.dueTimestamp) === 'warning').length;
    const safeCount = allRaw.filter(a => getUrgency(a.dueTimestamp) === 'safe').length;

    if (showHidden && hiddenIds.size === 0) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>👁</div>
                <p className={styles.emptyTitle}>No hidden assessments</p>
                <p className={styles.emptySub}>Assessments you hide will appear here. Click ✕ Hide on any item to hide it.</p>
            </div>
        );
    }

    return (
        <>
            {!showHidden && allRaw.length > 0 && (
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
                            <span className={styles.statNum}>{allRaw.length}</span>
                            <span className={styles.statLabel}>📋 Total</span>
                        </div>
                    </div>
                    <UrgencyLegend urgencyFilter={urgencyFilter} setUrgencyFilter={setUrgencyFilter} />
                </>
            )}

            {showHidden && (
                <div className={dashStyles.hiddenBanner}>
                    <span>👁 Showing {hiddenIds.size} hidden assessment{hiddenIds.size !== 1 ? 's' : ''}. Click ↩ Restore to bring them back.</span>
                </div>
            )}

            {filteredTerms.length === 0 ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📭</div>
                    <p className={styles.emptyTitle}>No assessments found</p>
                    <p className={styles.emptySub}>
                        {urgencyFilter !== 'all' ? 'Try a different urgency filter.' : 'Try adjusting the filters in the sidebar.'}
                    </p>
                </div>
            ) : (
                <div className={styles.results}>
                    <div className={styles.resultsHeader}>
                        <h2 className={styles.resultsTitle}>
                            {allVisible.length} assessment{allVisible.length !== 1 ? 's' : ''}
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
                                                <AssessmentCard
                                                    key={a.id}
                                                    assessment={a}
                                                    isHidden={showHidden}
                                                    onHide={onHide}
                                                    onUnhide={onUnhide}
                                                />
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
});

// ─── CALENDAR VIEW ─────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];



const UNIVERSITY_CONFIG = [
    {
        label: 'RMIT University',
        url: 'https://rmit.instructure.com/api/v1/',
        links: [
            { label: 'Canvas', href: 'https://rmit.instructure.com/' },
            { label: 'Timetable', href: 'https://mytimetable.rmit.edu.au/even/student' },
            { label: 'Student Hub', href: 'https://www.rmit.edu.au/students' },
        ],
    },
    {
        label: 'Swinburne University',
        url: 'https://swinburne.instructure.com/api/v1/',
        links: [
            { label: 'Canvas', href: 'https://swinburne.instructure.com/' },
            { label: 'Timetable', href: 'https://www.swinburne.edu.au/current-students/student-services/timetables/' },
            { label: 'Student Portal', href: 'https://www.swinburne.edu.au/current-students/' },
        ],
    },
];

const GITHUB_LINK = { label: 'GitHub', href: 'https://github.com/RajLogic/canvasHelp' };
const DEFAULT_QUICK_LINKS = [
    { label: 'Canvas', href: 'https://rmit.instructure.com/' },
    { label: 'GitHub', href: 'https://github.com/RajLogic/canvasHelp' },
];

function getQuickLinks(canvasBaseUrl) {
    if (!canvasBaseUrl) return DEFAULT_QUICK_LINKS;
    const normalised = canvasBaseUrl.toLowerCase().replace(/\/$/, '');
    const match = UNIVERSITY_CONFIG.find(u => u.url.toLowerCase().replace(/\/$/, '') === normalised);
    if (match) return [...match.links, GITHUB_LINK];
    try {
        const parsed = new URL(canvasBaseUrl);
        return [{ label: 'Canvas', href: `${parsed.protocol}//${parsed.hostname}/` }, GITHUB_LINK];
    } catch {
        return DEFAULT_QUICK_LINKS;
    }
}



const CalendarView = memo(function CalendarView({ dueData, hiddenIds, onHide, onUnhide }) {
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [selectedDay, setSelectedDay] = useState(null);

    const assessmentsByDate = {};
    dueData.terms.forEach((term) => {
        term.courses.forEach((course) => {
            course.assessments.forEach((a) => {
                if (hiddenIds.has(String(a.id))) return;
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

    const prevMonth = () => { setSelectedDay(null); if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
    const nextMonth = () => { setSelectedDay(null); if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
    const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDay(null); };

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
            <div className={styles.calNav}>
                <button className={styles.calNavBtn} onClick={prevMonth} aria-label="Previous month">‹</button>
                <div className={styles.calNavCenter}>
                    <span className={styles.calMonthLabel}>{MONTHS[viewMonth]} {viewYear}</span>
                    <button className={styles.calTodayBtn} onClick={goToday}>Today</button>
                </div>
                <button className={styles.calNavBtn} onClick={nextMonth} aria-label="Next month">›</button>
            </div>

            <div className={styles.calLegend}>
                <span className={styles.calLegendItem}><span className={`${styles.calLegendDot} ${styles.dotToday}`} />Today</span>
                <span className={styles.calLegendItem}><span className={`${styles.calLegendDot} ${styles.dotUrgent}`} />≤5 days</span>
                <span className={styles.calLegendItem}><span className={`${styles.calLegendDot} ${styles.dotWarning}`} />≤2 weeks</span>
                <span className={styles.calLegendItem}><span className={`${styles.calLegendDot} ${styles.dotSafe}`} />&gt;2 weeks</span>
            </div>

            <div className={styles.calGrid}>
                {DAYS.map((d) => (<div key={d} className={styles.calDayHeader}>{d}</div>))}
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
                        <div key={key}
                            className={[styles.calCell, isToday ? styles.calCellToday : '', isSelected ? styles.calCellSelected : '', dayItems.length > 0 ? styles.calCellHasItems : ''].filter(Boolean).join(' ')}
                            onClick={() => handleDayClick(day)} role="button" tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && handleDayClick(day)}>
                            <span className={styles.calDayNum}>{day}</span>
                            <div className={styles.calPills}>
                                {dayItems.slice(0, 2).map((a) => (
                                    <div key={a.id} className={`${styles.calPill} ${styles[`calPill_${getUrgency(a.dueTimestamp)}`]}`}>
                                        {formatTime(a.dueAt)} {a.name}
                                    </div>
                                ))}
                                {dayItems.length > 2 && (<div className={styles.calPillMore}>+{dayItems.length - 2} more</div>)}
                            </div>
                            {dotUrgency && <span className={`${styles.calDot} ${styles[`dot_${dotUrgency}`]}`} />}
                        </div>
                    );
                })}
            </div>

            {selectedDay && (
                <div className={styles.calDetail}>
                    <div className={styles.calDetailHeader}>
                        <h3 className={styles.calDetailTitle}>{selectedDay.day} {MONTHS[viewMonth]} {viewYear}</h3>
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
                                            <a href={a.htmlUrl} target="_blank" rel="noopener noreferrer" className={styles.calDetailName}>{a.name}</a>
                                            <div className={styles.calDetailMeta}>
                                                <span className={styles.calDetailCourse}>{a.courseName}</span>
                                                <span className={styles.calDetailTime}>🕐 {formatShortDate(a.dueAt)}</span>
                                                {a.pointsPossible != null && (<span className={styles.calDetailPts}>⭐ {a.pointsPossible} pts</span>)}
                                            </div>
                                        </div>
                                        <div className={dashStyles.cardActions}>
                                            <UrgencyBadge dueTimestamp={a.dueTimestamp} />
                                            <button className={dashStyles.hideBtn} onClick={() => onHide(a.id)} title="Hide">✕</button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
});

// ─── TIMETABLE VIEW ───────────────────────────────────────────────────────────

const TimetableView = memo(function TimetableView({ timetableEvents, timetableLoading, timetableError, onFetchTimetable }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDateKey, setSelectedDateKey] = useState(null);

    const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const formatDateLabel = (date) => date.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const groupEventsByDate = () => {
        const grouped = {};
        timetableEvents.sort((a, b) => new Date(a.start) - new Date(b.start)).forEach((event) => {
            const date = new Date(event.start);
            const dateKey = toDateKey(date);
            if (!grouped[dateKey]) grouped[dateKey] = { label: formatDateLabel(date), events: [] };
            grouped[dateKey].events.push(event);
        });
        return grouped;
    };

    const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

    const handlePrevMonth = () => { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)); setSelectedDateKey(null); };
    const handleNextMonth = () => { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)); setSelectedDateKey(null); };
    const handleToday = () => { const t = new Date(); setCurrentMonth(t); setSelectedDateKey(toDateKey(t)); };

    const renderCalendarGrid = (groupedEvents) => {
        const daysInMonth = getDaysInMonth(currentMonth);
        const firstDay = getFirstDayOfMonth(currentMonth);
        const days = [];
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === currentMonth.getFullYear() && today.getMonth() === currentMonth.getMonth();
        const todayDate = isCurrentMonth ? today.getDate() : -1;
        for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className={styles.calEmptyDay}></div>);
        for (let day = 1; day <= daysInMonth; day++) {
            const isToday = day === todayDate;
            const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
            const dayKey = toDateKey(dayDate);
            const isSelected = selectedDateKey === dayKey;
            const hasEvents = Boolean(groupedEvents[dayKey]?.events?.length);
            days.push(
                <button key={day} type="button" onClick={() => setSelectedDateKey((prev) => (prev === dayKey ? null : dayKey))}
                    className={`${styles.calDay} ${isToday ? styles.calDayToday : ''} ${isSelected ? styles.calDaySelected : ''} ${hasEvents ? styles.calDayHasEvents : ''}`}
                    title={formatDateLabel(dayDate)}>
                    {day}
                </button>
            );
        }
        return days;
    };

    const groupedEvents = groupEventsByDate();
    const visibleDateEntries = selectedDateKey
        ? [[selectedDateKey, groupedEvents[selectedDateKey] || {
            label: formatDateLabel(new Date(Number(selectedDateKey.slice(0, 4)), Number(selectedDateKey.slice(5, 7)) - 1, Number(selectedDateKey.slice(8, 10)))),
            events: [],
        }]]
        : Object.entries(groupedEvents);

    return (
        <div className={styles.timetableWrap}>
            <div className={styles.syncButtonWrap}>
                <button onClick={onFetchTimetable} disabled={timetableLoading} className={styles.btnSync}>
                    {timetableLoading ? 'Syncing...' : '🔄 Sync Timetable'}
                </button>
            </div>
            {timetableError && (<div className={styles.errorBanner}><span>⚠️ {timetableError}</span></div>)}
            {timetableLoading && (<div className={styles.loadingWrap}><span className={styles.spinnerLarge} /><p className={styles.loadingText}>Syncing timetable…</p></div>)}
            {!timetableLoading && timetableEvents.length > 0 && (
                <>
                    <div className={styles.calendarHeaderWrap}>
                        <div className={styles.calMonthNav}>
                            <button onClick={handlePrevMonth} className={styles.calNavBtn}>❮</button>
                            <div className={styles.calMonthLabel}>{currentMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</div>
                            <button onClick={handleNextMonth} className={styles.calNavBtn}>❯</button>
                            <button onClick={handleToday} className={styles.calTodayBtn}>Today</button>
                        </div>
                        <div className={styles.miniCalendar}>
                            <div className={styles.calDayHeaders}>
                                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (<div key={day} className={styles.calHeaderDay}>{day}</div>))}
                            </div>
                            <div className={styles.calDaysGrid}>{renderCalendarGrid(groupedEvents)}</div>
                        </div>
                    </div>
                    <div className={styles.eventsListWrapper}>
                        {selectedDateKey && (<p className={styles.selectedDayHint}>Showing classes for {visibleDateEntries[0][1].label}</p>)}
                        {visibleDateEntries.map(([dateKey, dayGroup]) => (
                            <div key={dateKey} className={styles.dateGroup}>
                                <h3 className={styles.dateGroupTitle}>{dayGroup.label}</h3>
                                <div className={styles.eventsList}>
                                    {dayGroup.events.map((event, idx) => {
                                        const startTime = new Date(event.start);
                                        const endTime = new Date(event.end);
                                        const durationHours = Math.round((endTime - startTime) / (1000 * 60 * 60) * 10) / 10;
                                        return (
                                            <div key={idx} className={styles.eventCard}>
                                                <div className={styles.eventTimeSection}>
                                                    <div className={styles.eventStartTime}>{startTime.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
                                                    <div className={styles.eventDuration}>{durationHours} hr</div>
                                                </div>
                                                <div className={styles.eventDetailsSection}>
                                                    <div className={styles.eventName}>{event.summary}</div>
                                                    <div className={styles.eventMeta}>{event.location || <span>-</span>}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {dayGroup.events.length === 0 && (<div className={styles.eventEmptyState}>No classes running on this day.</div>)}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
            {!timetableLoading && timetableEvents.length === 0 && !timetableError && (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📚</div>
                    <p className={styles.emptyTitle}>No upcoming classes</p>
                    <p className={styles.emptySub}>Click Sync Timetable to load your schedule.</p>
                </div>
            )}
        </div>
    );
});

// ─── SETTINGS MODAL ────────────────────────────────────────────────────────

const UNIVERSITIES = [
    ...UNIVERSITY_CONFIG,
    { label: 'Custom / Other university', url: '' },
];

function SettingsModal({ user, onClose, onSaved }) {
    const defaultEnvUrl = 'https://rmit.instructure.com/api/v1/';
    const savedUrl = user?.canvasBaseUrl || defaultEnvUrl;
    const matchedPreset = UNIVERSITIES.find(u => u.url && u.url.toLowerCase() === savedUrl.toLowerCase());
    const initialPreset = matchedPreset ? matchedPreset.url : '';

    const [form, setForm] = useState({ canvasApiToken: '', timetableLink: '', canvasBaseUrl: '' });
    const [uniPreset, setUniPreset] = useState(initialPreset);
    const [showCustomUrl, setShowCustomUrl] = useState(!matchedPreset && Boolean(user?.canvasBaseUrl));
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const handleChange = (e) => { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setError(''); setSuccess(''); };
    const handleUniSelect = (e) => {
        const val = e.target.value;
        setUniPreset(val);
        if (val === '') { setShowCustomUrl(true); setForm(f => ({ ...f, canvasBaseUrl: '' })); }
        else { setShowCustomUrl(false); setForm(f => ({ ...f, canvasBaseUrl: val })); }
        setError(''); setSuccess('');
    };

    const handleSave = async (e) => {
        e.preventDefault(); setSaving(true); setError(''); setSuccess('');
        try {
            const payload = {};
            if (form.canvasApiToken) payload.canvasApiToken = form.canvasApiToken;
            if (form.timetableLink) payload.timetableLink = form.timetableLink;
            const resolvedUrl = showCustomUrl ? form.canvasBaseUrl : (uniPreset !== initialPreset ? uniPreset : undefined);
            if (resolvedUrl !== undefined) payload.canvasBaseUrl = resolvedUrl;
            const res = await fetch('/api/auth/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!res.ok) { setError(data.message || 'Failed to save.'); return; }
            setSuccess('Settings saved! All sensitive data is encrypted with AES-256-GCM.');
            onSaved && onSaved(data.user);
        } catch { setError('Network error. Please try again.'); }
        finally { setSaving(false); }
    };

    const currentDisplayUrl = user?.canvasBaseUrl || defaultEnvUrl;

    return (
        <div className={dashStyles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={dashStyles.modal}>
                <div className={dashStyles.modalHeader}>
                    <h2 className={dashStyles.modalTitle}>⚙️ Settings</h2>
                    <button className={dashStyles.modalClose} onClick={onClose}>✕</button>
                </div>
                <div className={dashStyles.modalBody}>
                    <div className={dashStyles.userInfo}>
                        <div className={dashStyles.userAvatar}>{user?.username?.[0]?.toUpperCase() || '?'}</div>
                        <div>
                            <div className={dashStyles.userName}>{user?.username}</div>
                            <div className={dashStyles.userEmail}>{user?.email}</div>
                        </div>
                    </div>
                    <div className={dashStyles.encryptionBadge}>
                        <span className={dashStyles.encryptBadgeIcon}>🔐</span>
                        <span>API token, timetable link, and Canvas URL are encrypted with <strong>AES-256-GCM</strong> before being stored.</span>
                    </div>
                    {error && <div className={dashStyles.settingsError}><span>⚠️</span> {error}</div>}
                    {success && <div className={dashStyles.settingsSuccess}><span>✅</span> {success}</div>}
                    <form onSubmit={handleSave} className={dashStyles.settingsForm}>
                        <div className={dashStyles.settingsField}>
                            <label className={dashStyles.settingsLabel}>
                                University / Canvas Instance
                                <span className={dashStyles.settingsLabelHint}>Current: <code className={dashStyles.urlCode}>{currentDisplayUrl}</code></span>
                            </label>
                            <select value={uniPreset} onChange={handleUniSelect} className={dashStyles.settingsSelect}>
                                <option value="" disabled>Select your university…</option>
                                {UNIVERSITIES.map((u) => (<option key={u.label} value={u.url}>{u.label}</option>))}
                            </select>
                        </div>
                        {showCustomUrl && (
                            <div className={dashStyles.settingsField}>
                                <label className={dashStyles.settingsLabel}>Canvas API Base URL</label>
                                <input name="canvasBaseUrl" type="url" value={form.canvasBaseUrl} onChange={handleChange}
                                    className={dashStyles.settingsInput} placeholder="https://your-university.instructure.com/api/v1/" autoComplete="off" />
                            </div>
                        )}
                        <div className={dashStyles.settingsDivider} />
                        <div className={dashStyles.settingsField}>
                            <label className={dashStyles.settingsLabel}>
                                Canvas API Token
                                <span className={dashStyles.settingsLabelHint}>Canvas → Account → Settings → New Access Token</span>
                            </label>
                            <div className={dashStyles.inputWithBadge}>
                                <input name="canvasApiToken" type="password" value={form.canvasApiToken} onChange={handleChange}
                                    className={dashStyles.settingsInput}
                                    placeholder={user?.hasCanvasToken ? '••••••••••••••• (saved — paste new to update)' : 'Paste your Canvas API token here'}
                                    autoComplete="off" />
                                {user?.hasCanvasToken && <span className={dashStyles.savedBadge}>🔐 Encrypted &amp; saved</span>}
                            </div>
                        </div>
                        <div className={dashStyles.settingsField}>
                            <label className={dashStyles.settingsLabel}>
                                Timetable iCal Link
                                <span className={dashStyles.settingsLabelHint}>Optional</span>
                            </label>
                            <div className={dashStyles.inputWithBadge}>
                                <input name="timetableLink" type="url" value={form.timetableLink} onChange={handleChange}
                                    className={dashStyles.settingsInput}
                                    placeholder={user?.hasTimetableLink ? 'https://... (saved — paste to update)' : 'https://your-timetable.ics'} />
                                {user?.hasTimetableLink && <span className={dashStyles.savedBadge}>🔐 Encrypted &amp; saved</span>}
                            </div>
                        </div>
                        <button type="submit" className={dashStyles.settingsSave} disabled={saving}>
                            {saving ? '🔐 Encrypting & saving…' : 'Save settings'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

// ─── MAIN DASHBOARD PAGE ───────────────────────────────────────────────────

export default function Dashboard() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [dueData, setDueData] = useState({ terms: [], totalAssessments: 0 });
    const [searchText, setSearchText] = useState('');
    const [urgencyFilter, setUrgencyFilter] = useState('all');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [activeTab, setActiveTab] = useState('list');
    const [timetableEvents, setTimetableEvents] = useState([]);
    const [timetableLoading, setTimetableLoading] = useState(false);
    const [timetableError, setTimetableError] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);

    // Sidebar state
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [filters, setFilters] = useState({
        years: [], terms: [], courseIds: [], courseCodes: [],
        sortBy: 'dueDate', sortDir: 'asc'
    });

    // Hidden assessments state
    const [hiddenIds, setHiddenIds] = useState(new Set());
    const [showHidden, setShowHidden] = useState(false);

    // Load hidden IDs from localStorage on mount
    useEffect(() => {
        setHiddenIds(loadHidden());
    }, []);

    const hideAssessment = useCallback((id) => {
        setHiddenIds(prev => {
            const next = new Set(prev);
            next.add(String(id));
            saveHidden(next);
            return next;
        });
    }, []);

    const unhideAssessment = useCallback((id) => {
        setHiddenIds(prev => {
            const next = new Set(prev);
            next.delete(String(id));
            saveHidden(next);
            return next;
        });
    }, []);

    const clearAllHidden = useCallback(() => {
        setHiddenIds(new Set());
        saveHidden(new Set());
    }, []);

    // Auth check
    useEffect(() => {
        fetch('/api/auth/session')
            .then((r) => r.json())
            .then((data) => {
                if (!data.authenticated) { router.replace('/login'); }
                else {
                    setUser(data.user);
                    setAuthChecked(true);
                    if (router.query.welcome === '1') { setShowWelcome(true); setShowSettings(true); }
                }
            })
            .catch(() => router.replace('/login'));
    }, [router]);

    const fetchDueAssessments = useCallback(async (queryText = '') => {
        setLoading(true); setError(null);
        try {
            const query = queryText.trim() ? `?search=${encodeURIComponent(queryText.trim())}` : '';
            const response = await fetch(`/api/assessments/due${query}`);
            if (!response.ok) {
                const data = await response.json();
                if (data.requiresSetup) { setError('No Canvas API token configured. Open Settings to add your token.'); setShowSettings(true); return; }
                throw new Error(`Error ${response.status}: Failed to fetch`);
            }
            const data = await response.json();
            setDueData(data);
            setLastUpdated(new Date());
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { if (authChecked) fetchDueAssessments(''); }, [authChecked, fetchDueAssessments]);

    const handleSubmit = (e) => { e.preventDefault(); fetchDueAssessments(searchText); };
    const handleClearFilter = () => { setSearchText(''); fetchDueAssessments(''); };

    const fetchTimetableData = useCallback(async () => {
        setTimetableLoading(true); setTimetableError('');
        try {
            const response = await fetch('/api/timetable');
            if (!response.ok) throw new Error(`Error ${response.status}: Failed to fetch timetable`);
            const data = await response.json();
            const now = new Date();
            const futureEvents = data.events
                .filter((event) => new Date(event.end) > now)
                .sort((a, b) => new Date(a.start) - new Date(b.start))
                .slice(0, 20);
            setTimetableEvents(futureEvents);
        } catch (err) { setTimetableError(err.message || 'Failed to sync timetable'); setTimetableEvents([]); }
        finally { setTimetableLoading(false); }
    }, []);

    useEffect(() => { if (activeTab === 'timetable' && authChecked) fetchTimetableData(); }, [activeTab, authChecked, fetchTimetableData]);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
    };

    // Active filter count for badge
    const activeFilterCount = (filters.years?.length || 0) + (filters.terms?.length || 0) +
        (filters.courseIds?.length || 0) + (filters.courseCodes?.length || 0);

    // ADD after the activeFilterCount line:
    const quickLinks = useMemo(() => getQuickLinks(user?.canvasBaseUrl), [user?.canvasBaseUrl]);

    if (!authChecked) {
        return (
            <div style={{ minHeight: '100vh', background: '#0b0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className={styles.spinnerLarge} />
            </div>
        );
    }

    const isListOrCalendar = activeTab === 'list' || activeTab === 'calendar' || activeTab === 'hidden';

    return (
        <div className={styles.root}>
            {showSettings && (
                <SettingsModal
                    user={user}
                    onClose={() => { setShowSettings(false); setShowWelcome(false); }}
                    onSaved={(updatedUser) => {
                        setUser(updatedUser);
                        setShowWelcome(false);
                        setTimeout(() => { setShowSettings(false); fetchDueAssessments(''); }, 800);
                    }}
                />
            )}

            <div className={styles.bgDecor} aria-hidden="true">
                <div className={styles.blob1} /><div className={styles.blob2} /><div className={styles.blob3} />
            </div>

            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <div className={styles.logoRow}>
                        <SiteLogo size={32} />
                        <div>
                            <h1 className={styles.siteTitle}>Final Reckoning</h1>
                            <p className={styles.siteSub}>Upcoming assessments at a glance</p>
                        </div>
                    </div>
                    <div className={styles.headerRight}>
                        <nav className={styles.topLinks} aria-label="Quick links">
                            {quickLinks.map((link) => (
                                <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className={styles.topLink}>{link.label}</a>
                            ))}
                        </nav>
                        <div className={dashStyles.userMenu}>
                            {lastUpdated && (
                                <span className={styles.lastUpdated}>
                                    Updated {lastUpdated.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                            <button className={dashStyles.userBtn} onClick={() => setShowSettings(true)} title="Settings">
                                <span className={dashStyles.userInitial}>{user?.username?.[0]?.toUpperCase()}</span>
                                <span className={dashStyles.userBtnName}>{user?.username}</span>
                                <span className={dashStyles.userBtnIcon}>⚙️</span>
                            </button>
                            <button className={dashStyles.logoutBtn} onClick={handleLogout} title="Log out">Sign out</button>
                        </div>
                    </div>
                </div>
            </header>

            {showWelcome && (
                <div className={dashStyles.welcomeBanner}>
                    <span>🎉 Welcome, {user?.username}! Add your Canvas API token below to get started.</span>
                    <button className={dashStyles.welcomeClose} onClick={() => setShowWelcome(false)}>✕</button>
                </div>
            )}

            <main className={styles.main}>
                {/* Search panel */}
                <section className={styles.controlPanel}>
                    <form className={styles.searchForm} onSubmit={handleSubmit}>
                        <div className={styles.inputWrapper}>
                            <span className={styles.inputIcon}>🔍</span>
                            <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)}
                                placeholder="Search classes, quizzes, or semester" className={styles.searchInput} />
                        </div>
                        <div className={styles.btnGroup}>
                            <button type="submit" disabled={loading} className={styles.btnPrimary}>
                                {loading ? <><span className={styles.spinner} /> Loading…</> : 'Search'}
                            </button>
                            <button type="button" onClick={handleClearFilter} disabled={loading} className={styles.btnSecondary}>Show All</button>
                        </div>
                    </form>
                </section>

                {/* Tabs */}
                <div className={dashStyles.tabsAndFilter}>
                    <div className={styles.tabRow}>
                        <button className={`${styles.tabBtn} ${activeTab === 'list' ? styles.tabBtnActive : ''}`}
                            onClick={() => { setActiveTab('list'); setShowHidden(false); }}>📋 List</button>
                        <button className={`${styles.tabBtn} ${activeTab === 'calendar' ? styles.tabBtnActive : ''}`}
                            onClick={() => { setActiveTab('calendar'); setShowHidden(false); }}>📅 Calendar</button>
                        <button className={`${styles.tabBtn} ${activeTab === 'timetable' ? styles.tabBtnActive : ''}`}
                            onClick={() => { setActiveTab('timetable'); setShowHidden(false); }}>🕐 Timetable</button>
                        <button
                            className={`${styles.tabBtn} ${activeTab === 'hidden' ? styles.tabBtnActive : ''} ${dashStyles.hiddenTab}`}
                            onClick={() => { setActiveTab('hidden'); setShowHidden(true); }}
                        >
                            👁 Hidden
                            {hiddenIds.size > 0 && <span className={dashStyles.hiddenBadge}>{hiddenIds.size}</span>}
                        </button>
                    </div>

                    {/* Filter button — only show for list/calendar/hidden tabs */}
                    {isListOrCalendar && (
                        <button
                            className={`${dashStyles.filterToggleBtn} ${activeFilterCount > 0 ? dashStyles.filterToggleBtnActive : ''}`}
                            onClick={() => setSidebarOpen(o => !o)}
                            aria-label="Toggle filters"
                        >
                            ⚡ Filters
                            {activeFilterCount > 0 && <span className={dashStyles.filterBadge}>{activeFilterCount}</span>}
                        </button>
                    )}
                </div>

                {error && (
                    <div className={styles.errorBanner}>
                        <span>⚠️ {error}</span>
                        <button onClick={() => fetchDueAssessments(searchText)} className={styles.retryBtn}>Retry</button>
                    </div>
                )}

                {/* Content area with optional sidebar */}
                <div className={`${dashStyles.contentWithSidebar} ${sidebarOpen && isListOrCalendar ? dashStyles.contentWithSidebarOpen : ''}`}>
                    {isListOrCalendar && (
                        <FilterSidebar
                            dueData={dueData}
                            filters={filters}
                            onFiltersChange={setFilters}
                            isOpen={sidebarOpen}
                            onClose={() => setSidebarOpen(false)}
                        />
                    )}

                    <div className={dashStyles.mainContent}>
                        {loading && (
                            <div className={styles.loadingWrap}>
                                <span className={styles.spinnerLarge} />
                                <p className={styles.loadingText}>Fetching assessments…</p>
                            </div>
                        )}

                        {!loading && !error && (activeTab === 'list' || activeTab === 'hidden') && (
                            <>
                                {activeTab === 'hidden' && hiddenIds.size > 0 && (
                                    <div className={dashStyles.hiddenControls}>
                                        <button className={dashStyles.clearHiddenBtn} onClick={clearAllHidden}>
                                            🗑 Clear all hidden ({hiddenIds.size})
                                        </button>
                                    </div>
                                )}
                                <ListView
                                    dueData={dueData}
                                    urgencyFilter={urgencyFilter}
                                    setUrgencyFilter={setUrgencyFilter}
                                    filters={filters}
                                    hiddenIds={hiddenIds}
                                    onHide={hideAssessment}
                                    onUnhide={unhideAssessment}
                                    showHidden={activeTab === 'hidden'}
                                />
                            </>
                        )}

                        {!loading && !error && activeTab === 'calendar' && (
                            <CalendarView
                                dueData={dueData}
                                hiddenIds={hiddenIds}
                                onHide={hideAssessment}
                                onUnhide={unhideAssessment}
                            />
                        )}

                        {activeTab === 'timetable' && (
                            <TimetableView
                                timetableEvents={timetableEvents}
                                timetableLoading={timetableLoading}
                                timetableError={timetableError}
                                onFetchTimetable={fetchTimetableData}
                            />
                        )}
                    </div>
                </div>
            </main>

            <footer className={styles.footer}>
                <div className={styles.footerLinks}>
                    {quickLinks.map((link) => (
                        <a key={`footer-${link.label}`} href={link.href} target="_blank" rel="noopener noreferrer" className={styles.footerLink}>{link.label}</a>
                    ))}
                </div>
                <p>Final Reckoning · RajLogic</p>
            </footer>
        </div>
    );
}