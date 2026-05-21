import React, { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { useRouter } from 'next/router';
import styles from '../styles/Dashboard.module.css';
import Image from 'next/image';
import { normalizeCanvasBaseUrl } from '../lib/canvas-url.js';
import { getDashboardRoute } from '../lib/dashboard-route.js';

// ─── Helpers ────
function SiteLogo({ size = 28 }) {
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

function formatCountdown(msLeft) {
    const totalMinutes = Math.max(0, Math.floor(msLeft / (1000 * 60)));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
}

function getDaysLeftLabel(dueTimestamp) {
    const now = Date.now();
    const diff = dueTimestamp - now;
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysLeft = Math.ceil(diff / msPerDay);
    if (daysLeft < 0) {
        const overdueDays = Math.abs(daysLeft);
        return `${overdueDays}d ago`;
    }
    if (diff > 0 && diff <= 48 * 60 * 60 * 1000) return formatCountdown(diff);
    if (daysLeft === 0) return 'Today';
    return `${daysLeft}d left`;
}

function formatShortDate(dateString) {
    return new Date(dateString).toLocaleString('en-AU', {
        weekday: 'short', day: '2-digit', month: 'short',
        year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function formatDateRow(dateString) {
    const d = new Date(dateString);
    return {
        main: d.toLocaleDateString('en-AU', { weekday: 'short', day: '2-digit', month: 'short' }),
        sub: d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
    };
}

function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

function getScorePercentage(score, pointsPossible) {
    const numericScore = Number(score);
    const numericPointsPossible = Number(pointsPossible);
    if (!Number.isFinite(numericScore) || !Number.isFinite(numericPointsPossible) || numericPointsPossible <= 0) return null;
    return Math.max(0, Math.min(100, (numericScore / numericPointsPossible) * 100));
}

// ─── Local storage helpers ──────────────────────────────────────────────────
const HIDDEN_KEY = 'fr_hidden_assessments';
const COMPLETE_KEY = 'fr_completed_assessments';
const REMINDER_HOURS_KEY = 'fr_reminder_hours';
const REMINDED_ITEMS_KEY = 'fr_reminded_items';

function loadHidden() {
    try { const raw = localStorage.getItem(HIDDEN_KEY); return raw ? new Set(JSON.parse(raw)) : new Set(); }
    catch { return new Set(); }
}
function saveHidden(set) {
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set])); } catch { }
}
function loadCompleted() {
    try { const raw = localStorage.getItem(COMPLETE_KEY); return raw ? new Set(JSON.parse(raw)) : new Set(); }
    catch { return new Set(); }
}
function saveCompleted(set) {
    try { localStorage.setItem(COMPLETE_KEY, JSON.stringify([...set])); } catch { }
}
function loadReminderHours() {
    try { const raw = localStorage.getItem(REMINDER_HOURS_KEY); const parsed = Number(raw); if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 168) return parsed; } catch { }
    return 36;
}
function saveReminderHours(value) {
    try { localStorage.setItem(REMINDER_HOURS_KEY, String(value)); } catch { }
}
function loadRemindedMap() {
    try { const raw = localStorage.getItem(REMINDED_ITEMS_KEY); const parsed = raw ? JSON.parse(raw) : {}; if (parsed && typeof parsed === 'object') return parsed; } catch { }
    return {};
}
function saveRemindedMap(map) {
    try { localStorage.setItem(REMINDED_ITEMS_KEY, JSON.stringify(map)); } catch { }
}

// ─── Filter/Sort ───────────────────────────────────────────────────────────
function applyFiltersAndSort(dueData, filters, hiddenIds, showHidden) {
    return dueData.terms.map(term => {
        const courses = term.courses.map(course => {
            let assessments = course.assessments.filter(a => {
                const isHidden = hiddenIds.has(String(a.id));
                return showHidden ? isHidden : !isHidden;
            });
            if (filters.years?.length > 0)
                assessments = assessments.filter(a => filters.years.includes(new Date(a.dueAt).getFullYear()));
            if (filters.terms?.length > 0)
                if (!filters.terms.includes(term.termName)) return { ...course, assessments: [] };
            if (filters.courseIds?.length > 0)
                if (!filters.courseIds.includes(course.courseId)) return { ...course, assessments: [] };
            if (filters.courseCodes?.length > 0) {
                const codeMatch = course.courseName.match(/^([A-Z]{2,6}\d{3,5}[A-Z]?)/);
                const code = codeMatch ? codeMatch[1] : null;
                if (!code || !filters.courseCodes.includes(code)) return { ...course, assessments: [] };
            }
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
}

function buildClassGroups(terms) {
    const groups = new Map();

    terms.forEach(term => {
        term.courses.forEach(course => {
            const key = String(course.courseId ?? course.courseName);
            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    courseName: course.courseName,
                    courseId: course.courseId,
                    assessments: [],
                    termNames: new Set(),
                });
            }
            const group = groups.get(key);
            group.assessments.push(...course.assessments);
            group.termNames.add(term.termName);
        });
    });

    return [...groups.values()]
        .map(group => ({
            ...group,
            termNames: [...group.termNames].sort((a, b) => a.localeCompare(b)),
            assessments: [...group.assessments].sort((a, b) => a.dueTimestamp - b.dueTimestamp),
        }))
        .sort((a, b) => {
            const dueDiff = (a.assessments[0]?.dueTimestamp ?? Number.MAX_SAFE_INTEGER) - (b.assessments[0]?.dueTimestamp ?? Number.MAX_SAFE_INTEGER);
            if (dueDiff !== 0) return dueDiff;
            return a.courseName.localeCompare(b.courseName);
        });
}

function getListViewMeta({ mode, showHidden, hiddenCount }) {
    let titleText;
    if (mode === 'completed') {
        titleText = 'Past assessments';
    } else if (mode === 'past') {
        titleText = 'Past classes';
    } else if (showHidden) {
        titleText = 'Hidden assessments';
    } else {
        titleText = 'Upcoming assessments';
    }

    let subtitleText = null;
    if (mode === 'completed') {
        subtitleText = 'Marked complete assessments and past-due assessments from this year, grouped by class.';
    } else if (mode === 'past') {
        subtitleText = 'Classes whose assessments are all in the past.';
    }

    let displayCountLabel;
    if (mode === 'completed' || mode === 'past') {
        displayCountLabel = hiddenCount === 1 ? 'class' : 'classes';
    } else {
        displayCountLabel = hiddenCount === 1 ? 'item' : 'items';
    }

    return { titleText, subtitleText, displayCountLabel };
}

function getListViewEmptyState({ mode, showHidden, filteredTermsLength, completedClassGroupsLength, pastClassGroupsLength }) {
    if (mode === 'upcoming' && filteredTermsLength === 0) {
        return {
            icon: showHidden ? '📭' : '🎉',
            title: showHidden ? 'No assessments found' : 'All caught up!',
            sub: showHidden ? 'Try a different filter.' : 'No upcoming assessments right now.',
        };
    }
    if (mode === 'completed' && completedClassGroupsLength === 0) {
        return {
            icon: '✅',
            title: 'No past assessments yet',
            sub: 'Mark items as complete or wait for past-due assessments in this year.',
        };
    }
    if (mode === 'past' && pastClassGroupsLength === 0) {
        return {
            icon: '🕓',
            title: 'No past classes yet',
            sub: 'Classes will appear here once every assessment is past due.',
        };
    }
    return null;
}

// ─── University config ─────────────────────────────────────────────────────
const UNIVERSITY_CONFIG = [
    {
        label: 'RMIT University', url: 'https://rmit.instructure.com/api/v1/',
        links: [
            { label: 'Canvas', href: 'https://rmit.instructure.com/' },
            { label: 'Timetable', href: 'https://mytimetable.rmit.edu.au/even/student' },
            { label: 'Student Hub', href: 'https://www.rmit.edu.au/students' },
        ],
    },
    {
        label: 'Swinburne University', url: 'https://swinburne.instructure.com/api/v1/',
        links: [
            { label: 'Canvas', href: 'https://swinburne.instructure.com/' },
            { label: 'Timetable', href: 'https://www.swinburne.edu.au/current-students/student-services/timetables/' },
            { label: 'Student Portal', href: 'https://www.swinburne.edu.au/current-students/' },
        ],
    },
];
const GITHUB_LINK = { label: 'GitHub', href: 'https://github.com/RajLogic/canvasHelp' };
const DEFAULT_QUICK_LINKS = [{ label: 'Canvas', href: 'https://rmit.instructure.com/' }, GITHUB_LINK];

function getQuickLinks(canvasBaseUrl) {
    if (!canvasBaseUrl) return DEFAULT_QUICK_LINKS;
    const normalised = normalizeCanvasBaseUrl(canvasBaseUrl).toLowerCase().replace(/\/$/, '');
    const match = UNIVERSITY_CONFIG.find(u => u.url.toLowerCase().replace(/\/$/, '') === normalised);
    if (match) return [...match.links, GITHUB_LINK];
    try {
        const parsed = new URL(normalised);
        return [{ label: 'Canvas', href: `${parsed.protocol}//${parsed.hostname}/` }, GITHUB_LINK];
    } catch { return DEFAULT_QUICK_LINKS; }
}

const UNIVERSITIES = [...UNIVERSITY_CONFIG, { label: 'Custom / Other university', url: '' }];

// ─── Filter Sidebar ────────────────────────────────────────────────────────
const FilterPanel = memo(function FilterPanel({ dueData, filters, onFiltersChange, onHideCourse }) {
    const allAssessments = dueData.terms.flatMap(t => t.courses.flatMap(c => c.assessments));
    const years = [...new Set(allAssessments.map(a => new Date(a.dueAt).getFullYear()))].sort((a, b) => b - a);
    const terms = [...new Set(dueData.terms.map(t => t.termName))].sort((a, b) => a.localeCompare(b));
    const courses = [...new Map(allAssessments.map(a => [a.courseId, { id: a.courseId, name: a.courseName }])).values()].sort((a, b) => a.name.localeCompare(b.name));
    const courseCodes = [...new Set(courses.map(c => { const m = c.name.match(/^([A-Z]{2,6}\d{3,5}[A-Z]?)/); return m ? m[1] : null; }).filter(Boolean))].sort((a, b) => a.localeCompare(b));

    const toggle = (key, value) => {
        const current = filters[key] || [];
        const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
        onFiltersChange({ ...filters, [key]: next });
    };
    const clearAll = () => onFiltersChange({ years: [], terms: [], courseIds: [], courseCodes: [], sortBy: 'dueDate', sortDir: 'asc' });
    const activeCount = (filters.years?.length || 0) + (filters.terms?.length || 0) + (filters.courseIds?.length || 0) + (filters.courseCodes?.length || 0);

    return (
        <div className={styles.filterPanel}>
            <div className={styles.filterPanelHeader}>
                <span className={styles.filterPanelTitle}>Filters</span>
                {activeCount > 0 && <button className={styles.filterClearBtn} onClick={clearAll}>Clear ({activeCount})</button>}
            </div>
            <div className={styles.filterPanelBody}>
                <div className={styles.filterSection}>
                    <h3 className={styles.filterSectionTitle}>Sort by</h3>
                    <div className={styles.sortRow}>
                        <select className={styles.filterSelect} value={filters.sortBy || 'dueDate'} onChange={e => onFiltersChange({ ...filters, sortBy: e.target.value })}>
                            <option value="dueDate">Due date</option>
                            <option value="courseName">Course name</option>
                            <option value="points">Points</option>
                            <option value="name">Name</option>
                        </select>
                        <button className={styles.dirBtn} onClick={() => onFiltersChange({ ...filters, sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' })}>
                            {filters.sortDir === 'asc' ? '↑' : '↓'}
                        </button>
                    </div>
                </div>
                {years.length > 0 && (
                    <div className={styles.filterSection}>
                        <h3 className={styles.filterSectionTitle}>Year {filters.years?.length > 0 && <span className={styles.filterActiveCount}>{filters.years.length}</span>}</h3>
                        <div className={styles.filterChipGroup}>
                            {years.map(y => (
                                <button key={y} className={`${styles.filterChip} ${filters.years?.includes(y) ? styles.filterChipActive : ''}`} onClick={() => toggle('years', y)}>{y}</button>
                            ))}
                        </div>
                    </div>
                )}
                {terms.length > 0 && (
                    <div className={styles.filterSection}>
                        <h3 className={styles.filterSectionTitle}>Semester {filters.terms?.length > 0 && <span className={styles.filterActiveCount}>{filters.terms.length}</span>}</h3>
                        <div className={styles.filterChipGroup}>
                            {terms.map(t => (
                                <button key={t} className={`${styles.filterChip} ${filters.terms?.includes(t) ? styles.filterChipActive : ''}`} onClick={() => toggle('terms', t)}>{t}</button>
                            ))}
                        </div>
                    </div>
                )}
                {courseCodes.length > 0 && (
                    <div className={styles.filterSection}>
                        <h3 className={styles.filterSectionTitle}>Course code {filters.courseCodes?.length > 0 && <span className={styles.filterActiveCount}>{filters.courseCodes.length}</span>}</h3>
                        <div className={styles.filterChipGroup}>
                            {courseCodes.map(code => (
                                <button key={code} className={`${styles.filterChip} ${filters.courseCodes?.includes(code) ? styles.filterChipActive : ''}`} onClick={() => toggle('courseCodes', code)}>{code}</button>
                            ))}
                        </div>
                    </div>
                )}
                {courses.length > 0 && (
                    <div className={styles.filterSection}>
                        <h3 className={styles.filterSectionTitle}>Course {filters.courseIds?.length > 0 && <span className={styles.filterActiveCount}>{filters.courseIds.length}</span>}</h3>
                        <div className={styles.courseList}>
                            {courses.map(c => (
                                <div key={c.id} className={styles.courseRow}>
                                    <label className={styles.courseFilterLabel}>
                                        <input type="checkbox" className={styles.checkbox} checked={filters.courseIds?.includes(c.id) || false} onChange={() => toggle('courseIds', c.id)} />
                                        <span className={styles.courseLabel}>{c.name}</span>
                                    </label>
                                    <button className={styles.courseHideBtn} onClick={() => onHideCourse(c.id)}>Hide all</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

FilterPanel.propTypes = {
    dueData: PropTypes.object.isRequired,
    filters: PropTypes.object.isRequired,
    onFiltersChange: PropTypes.func.isRequired,
    onHideCourse: PropTypes.func.isRequired,
};

// ─── Assessment Table Row ──────────────────────────────────────────────────
const getAssessmentRowClasses = ({ urgency, isHidden, isOverdue }) => {
    if (isOverdue) {
        return {
            badgeClass: styles.badgeConnected,
            dotClass: '',
            rowBgClass: '',
            stripeClass: '',
        };
    }

    const urgencyClasses = {
        urgent: {
            badgeClass: styles.badgeUrgent,
            dotClass: styles.dotUrgent,
            rowBgClass: styles.rowUrgentBg,
            stripeClass: styles.rowStripeUrgent,
        },
        warning: {
            badgeClass: styles.badgeWarning,
            dotClass: styles.dotWarning,
            rowBgClass: styles.rowWarningBg,
            stripeClass: styles.rowStripeWarning,
        },
        default: {
            badgeClass: styles.badgeConnected,
            dotClass: styles.dotSafe,
            rowBgClass: '',
            stripeClass: styles.rowStripeSafe,
        },
    };

    const { badgeClass, dotClass, rowBgClass: urgencyRowBgClass, stripeClass } = urgencyClasses[urgency] || urgencyClasses.default;
    const rowBgClass = isHidden ? '' : urgencyRowBgClass;

    return { badgeClass, dotClass, rowBgClass, stripeClass };
};

const renderStatusBadge = ({ isHidden, isOverdue, badgeClass, dotClass, daysLabel, isComplete }) => {
    if (isHidden) {
        return <span className={`${styles.badge} ${styles.badgeConnected}`}>Hidden</span>;
    }

    return (
        <>
            <span
                className={`${styles.badge} ${badgeClass}`}
                style={isOverdue ? { background: 'var(--bg-subtle)', borderColor: 'var(--border)', color: 'var(--text-muted)' } : undefined}
            >
                <span className={`${styles.badgeDot} ${dotClass}`} style={isOverdue ? { background: 'var(--text-muted)' } : undefined} />
                {daysLabel}
            </span>
            {isComplete && (
                <span className={`${styles.badge} ${styles.badgeComplete}`} style={{ marginLeft: '0.35rem' }}>✓ Complete</span>
            )}
        </>
    );
};

const AssessmentRow = memo(function AssessmentRow({ assessment, onOpenDetails, isHidden, isComplete, nowTick }) {
    const urgency = getUrgency(assessment.dueTimestamp);
    const daysLabel = getDaysLeftLabel(assessment.dueTimestamp);
    const { main: dateMain, sub: dateSub } = formatDateRow(assessment.dueAt);
    const courseCode = assessment.courseName.match(/^([A-Z]{2,6}\d{3,5}[A-Z]?)/)?.[1] || null;
    const isOverdue = assessment.dueTimestamp < nowTick;
    const { badgeClass, dotClass, rowBgClass, stripeClass } = getAssessmentRowClasses({ urgency, isHidden, isOverdue });

    const scorePercentage = getScorePercentage(assessment.score, assessment.pointsPossible);
    const scoreLabel = scorePercentage == null ? null : `${Math.round(scorePercentage)}%`;

    return (
        <button
            type="button"
            className={`${styles.assessmentRow} ${rowBgClass}`}
            onClick={() => onOpenDetails(assessment)}
        >
            <div className={`${styles.rowStripe} ${stripeClass}`} />
            <div className={styles.rowNameCell}>
                {courseCode && <span className={styles.rowCourseChip}>{courseCode}</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.rowName}>{assessment.name}</div>
                    <div className={styles.rowCourseName}>{assessment.courseName}</div>
                </div>
            </div>
            <div className={`${styles.rowCell} ${styles.rowDateCell}`}>
                <div className={styles.rowDateMain}>{dateMain}</div>
                <div className={styles.rowDateSub}>{dateSub}</div>
            </div>
            <div className={styles.rowCell}>
                {renderStatusBadge({ isHidden, isOverdue, badgeClass, dotClass, daysLabel, isComplete })}
            </div>
            <div className={`${styles.rowCell} ${styles.rowPoints}`}>
                {assessment.pointsPossible == null ? '—' : `${assessment.pointsPossible} pts`}
                {assessment.score != null && (
                    <div className={styles.rowScoreBlock}>
                        <div className={styles.rowScoreMeta}>
                            <span className={styles.rowScoreValue}>Score: {assessment.score}</span>
                            {scoreLabel && <span className={styles.rowScorePercentage}>{scoreLabel}</span>}
                        </div>
                        {scorePercentage != null && (
                            <div className={styles.rowScoreBar} aria-hidden="true">
                                <div className={styles.rowScoreBarFill} style={{ width: `${scorePercentage}%` }} />
                            </div>
                        )}
                    </div>
                )}
            </div>
            {/* <div className={styles.rowActions} onClick={e => e.stopPropagation()}>
                <button className={styles.moreBtn} onClick={() => onOpenDetails(assessment)}>···</button>
            </div> */}
        </button>
    );
});

AssessmentRow.propTypes = {
    assessment: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        dueTimestamp: PropTypes.number.isRequired,
        dueAt: PropTypes.string.isRequired,
        courseName: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        score: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        pointsPossible: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }).isRequired,
    onOpenDetails: PropTypes.func.isRequired,
    isHidden: PropTypes.bool.isRequired,
    isComplete: PropTypes.bool.isRequired,
    nowTick: PropTypes.number.isRequired,
};

// Helper to filter assessments by timestamp and urgency
const filterAssessmentsByUrgency = (assessments, nowTick, urgencyFilter) =>
    assessments.filter(a =>
        a.dueTimestamp >= nowTick &&
        (urgencyFilter === 'all' || getUrgency(a.dueTimestamp) === urgencyFilter)
    );

// Helper to enrich courses with filtered assessments
const enrichCourseWithAssessments = (course, nowTick, urgencyFilter) => ({
    ...course,
    assessments: filterAssessmentsByUrgency(course.assessments, nowTick, urgencyFilter),
});

// ─── List View ─────────────────────────────────────────────────────────────
const ListView = memo(function ListView({ dueData, urgencyFilter, setUrgencyFilter, filters, hiddenIds, completeIds, onOpenDetails, showHidden, nowTick, groupBy, mode = 'upcoming' }) {
    const currentYear = new Date(nowTick).getFullYear();

    const filteredTerms = useMemo(() => {
        const base = applyFiltersAndSort(dueData, filters, hiddenIds, showHidden);
        return base
            .map(term => ({
                ...term,
                courses: term.courses
                    .map(course => enrichCourseWithAssessments(course, nowTick, urgencyFilter))
                    .filter(c => c.assessments.length > 0),
            }))
            .filter(t => t.courses.length > 0);
    }, [dueData, filters, hiddenIds, urgencyFilter, showHidden, nowTick]);

    const baseTerms = useMemo(() => {
        return applyFiltersAndSort(dueData, filters, hiddenIds, showHidden);
    }, [dueData, filters, hiddenIds, showHidden]);

    const allRaw = useMemo(() => {
        return applyFiltersAndSort(dueData, { ...filters, sortBy: 'dueDate', sortDir: 'asc' }, hiddenIds, showHidden)
            .flatMap(t => t.courses.flatMap(c => c.assessments))
            .filter(a => a.dueTimestamp >= nowTick);
    }, [dueData, filters, hiddenIds, showHidden, nowTick]);

    const groupedByClass = useMemo(() => buildClassGroups(filteredTerms), [filteredTerms]);
    const allClassGroups = useMemo(() => buildClassGroups(baseTerms), [baseTerms]);
    const completedClassGroups = useMemo(() => {
        return allClassGroups
            .map(group => ({
                ...group,
                assessments: group.assessments.filter(a => {
                    const isMarkedComplete = completeIds.has(String(a.id));
                    const isPastInCurrentYear = a.dueTimestamp < nowTick && new Date(a.dueTimestamp).getFullYear() === currentYear;
                    return isMarkedComplete || isPastInCurrentYear;
                }),
            }))
            .filter(group => group.assessments.length > 0)
            .sort((a, b) => {
                const dueDiff = (a.assessments[0]?.dueTimestamp ?? Number.MAX_SAFE_INTEGER) - (b.assessments[0]?.dueTimestamp ?? Number.MAX_SAFE_INTEGER);
                if (dueDiff !== 0) return dueDiff;
                return a.courseName.localeCompare(b.courseName);
            });
    }, [allClassGroups, completeIds, currentYear, nowTick]);
    const pastClassGroups = useMemo(() => {
        return allClassGroups.filter(group => group.assessments.length > 0 && group.assessments.every(a => a.dueTimestamp < nowTick));
    }, [allClassGroups, nowTick]);

    let activeClassGroups;
    if (mode === 'completed') {
        activeClassGroups = completedClassGroups;
    } else if (mode === 'past') {
        activeClassGroups = pastClassGroups;
    } else {
        activeClassGroups = groupedByClass;
    }

    const { titleText, subtitleText, displayCountLabel } = getListViewMeta({
        mode,
        showHidden,
        hiddenCount: mode === 'completed' || mode === 'past' ? activeClassGroups.length : filteredTerms.length,
    });

    const emptyState = getListViewEmptyState({
        mode,
        showHidden,
        filteredTermsLength: filteredTerms.length,
        completedClassGroupsLength: completedClassGroups.length,
        pastClassGroupsLength: pastClassGroups.length,
    });

    const urgentCount = allRaw.filter(a => getUrgency(a.dueTimestamp) === 'urgent').length;
    const warningCount = allRaw.filter(a => getUrgency(a.dueTimestamp) === 'warning').length;
    const safeCount = allRaw.filter(a => getUrgency(a.dueTimestamp) === 'safe').length;
    const allVisible = filteredTerms.flatMap(t => t.courses.flatMap(c => c.assessments));
    let displayCount;
    if (mode === 'completed') {
        displayCount = completedClassGroups.length;
    } else if (mode === 'past') {
        displayCount = pastClassGroups.length;
    } else {
        displayCount = allVisible.length;
    }
    const shouldRenderMain = !showHidden || hiddenIds.size > 0 || mode !== 'upcoming';

    return (
        <>
            {!showHidden && mode === 'upcoming' && allRaw.length > 0 && (
                <div className={styles.statsRow}>
                    <button
                        type="button"
                        className={`${styles.statCard} ${styles.statUrgent} ${urgencyFilter === 'urgent' ? styles.statCardActive : ''}`}
                        onClick={() => setUrgencyFilter('urgent')}
                        aria-pressed={urgencyFilter === 'urgent'}
                    >
                        <span className={styles.statIcon}>🔴</span>
                        <div className={styles.statBody}><div className={styles.statNum}>{urgentCount}</div><div className={styles.statLabel}>Due soon</div></div>
                    </button>
                    <button
                        type="button"
                        className={`${styles.statCard} ${styles.statWarning} ${urgencyFilter === 'warning' ? styles.statCardActive : ''}`}
                        onClick={() => setUrgencyFilter('warning')}
                        aria-pressed={urgencyFilter === 'warning'}
                    >
                        <span className={styles.statIcon}>🟡</span>
                        <div className={styles.statBody}><div className={styles.statNum}>{warningCount}</div><div className={styles.statLabel}>Coming up</div></div>
                    </button>
                    <button
                        type="button"
                        className={`${styles.statCard} ${styles.statSafe} ${urgencyFilter === 'safe' ? styles.statCardActive : ''}`}
                        onClick={() => setUrgencyFilter('safe')}
                        aria-pressed={urgencyFilter === 'safe'}
                    >
                        <span className={styles.statIcon}>🟢</span>
                        <div className={styles.statBody}><div className={styles.statNum}>{safeCount}</div><div className={styles.statLabel}>Later</div></div>
                    </button>
                    <button
                        type="button"
                        className={`${styles.statCard} ${styles.statTotal} ${urgencyFilter === 'all' ? styles.statCardActive : ''}`}
                        onClick={() => setUrgencyFilter('all')}
                        aria-pressed={urgencyFilter === 'all'}
                    >
                        <span className={styles.statIcon}>📋</span>
                        <div className={styles.statBody}><div className={styles.statNum}>{allRaw.length}</div><div className={styles.statLabel}>Total</div></div>
                    </button>
                </div>
            )}

            {showHidden && hiddenIds.size === 0 && (
                <div className={`${styles.tableWrap} ${groupBy === 'class' ? styles.tableWrapGrouped : ''}`}>
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>👁</div>
                        <p className={styles.emptyTitle}>No hidden assessments</p>
                        <p className={styles.emptySub}>Click ✕ Hide on any row to hide it.</p>
                    </div>
                </div>
            )}

            {shouldRenderMain && (
                <div className={styles.tableWrap}>
                    <div className={styles.tableHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span className={styles.tableTitle}>
                                {titleText}
                                <span className={styles.tableCount}>{displayCount} {displayCountLabel}</span>
                            </span>
                            {showHidden && hiddenIds.size > 0 && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {hiddenIds.size} hidden
                                </span>
                            )}
                        </div>
                        {!showHidden && mode === 'upcoming' && (
                            <div className={styles.urgencyChips}>
                                {[
                                    { key: 'all', label: '📋 All' },
                                    { key: 'urgent', label: '🔴 ≤5d' },
                                    { key: 'warning', label: '🟡 ≤2wk' },
                                    { key: 'safe', label: '🟢 Later' },
                                ].map(f => (
                                    <button key={f.key} className={`${styles.urgencyChip} ${urgencyFilter === f.key ? styles.urgencyChipActive : ''}`} onClick={() => setUrgencyFilter(f.key)}>{f.label}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    {subtitleText && (
                        <div style={{ padding: '0.75rem 1.25rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {subtitleText}
                        </div>
                    )}

                    {groupBy !== 'class' && mode === 'upcoming' && (
                        <div className={styles.colHeaders}>
                            <div className={styles.colHeader}>Assessment</div>
                            <div className={`${styles.colHeader}`}>Due date</div>
                            <div className={styles.colHeader}>Status</div>
                            <div className={`${styles.colHeader} ${styles.colHeaderPoints}`}>Points</div>
                            {/* <div className={`${styles.colHeader} ${styles.colHeaderActions}`}></div> */}
                        </div>
                    )}

                    {(() => {
                        if (emptyState) {
                            return (
                                <div className={styles.emptyState}>
                                    <div className={styles.emptyIcon}>{emptyState.icon}</div>
                                    <p className={styles.emptyTitle}>{emptyState.title}</p>
                                    <p className={styles.emptySub}>{emptyState.sub}</p>
                                </div>
                            );
                        }

                        if (groupBy === 'class' || mode === 'completed' || mode === 'past') {
                            return (
                                <div className={`${styles.classGroupsGrid} ${groupBy === 'class' ? styles.classGroupsGridClassMode : ''}`}>
                                    {activeClassGroups.map(group => (
                                        <div key={`class-${group.key}`} className={styles.classGroupCard}>
                                            <div className={styles.classGroupHeader}>
                                                <div className={styles.classGroupHeaderLeft}>
                                                    <span className={styles.classGroupName}>{group.courseName}</span>
                                                    <span className={styles.termGroupCount}>{group.assessments.length} items</span>
                                                </div>
                                                {group.termNames.length > 0 && (
                                                    <span className={styles.classGroupMeta}>{group.termNames.join(' · ')}</span>
                                                )}
                                            </div>
                                            <div className={`${styles.colHeaders} ${styles.classGroupColumns}`}>
                                                <div className={styles.colHeader}>Assessment</div>
                                                <div className={`${styles.colHeader}`}>Due date</div>
                                                <div className={styles.colHeader}>Status</div>
                                                <div className={`${styles.colHeader} ${styles.colHeaderPoints}`}>Points</div>
                                                <div className={`${styles.colHeader} ${styles.colHeaderActions}`}></div>
                                            </div>
                                            <div className={styles.classGroupRows}>
                                                {group.assessments.map(a => (
                                                    <AssessmentRow
                                                        key={a.id}
                                                        assessment={a}
                                                        isHidden={showHidden}
                                                        isComplete={completeIds.has(String(a.id))}
                                                        onOpenDetails={onOpenDetails}
                                                        nowTick={nowTick}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        }

                        return filteredTerms.map(term => (
                            <div key={term.termName} className={styles.termGroup}>
                                <div className={styles.termGroupHeader}>
                                    <span className={styles.termGroupName}>{term.termName}</span>
                                    <span className={styles.termGroupCount}>
                                        {term.courses.reduce((s, c) => s + c.assessments.length, 0)} items
                                    </span>
                                </div>
                                {term.courses
                                    .flatMap(course => course.assessments)
                                    .sort((a, b) => a.dueTimestamp - b.dueTimestamp)
                                    .map(a => (
                                        <AssessmentRow
                                            key={a.id}
                                            assessment={a}
                                            isHidden={showHidden}
                                            isComplete={completeIds.has(String(a.id))}
                                            onOpenDetails={onOpenDetails}
                                            nowTick={nowTick}
                                        />
                                    ))}
                            </div>
                        ));
                    })()}
                </div>
            )}
        </>
    );
});

ListView.propTypes = {
    dueData: PropTypes.object.isRequired,
    urgencyFilter: PropTypes.string.isRequired,
    setUrgencyFilter: PropTypes.func.isRequired,
    filters: PropTypes.object.isRequired,
    hiddenIds: PropTypes.instanceOf(Set).isRequired,
    completeIds: PropTypes.instanceOf(Set).isRequired,
    onOpenDetails: PropTypes.func.isRequired,
    showHidden: PropTypes.bool.isRequired,
    nowTick: PropTypes.number.isRequired,
    groupBy: PropTypes.string,
    mode: PropTypes.oneOf(['upcoming', 'completed', 'past']),
};

// ─── Calendar View ─────────────────────────────────────────────────────────
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const CalendarView = memo(function CalendarView({ dueData, hiddenIds, onHide, onUnhide, onOpenDetails, nowTick }) {
    /* onUnhide and nowTick are intentionally unused in this view */
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [selectedDay, setSelectedDay] = useState(null);

    const assessmentsByDate = {};
    dueData.terms.forEach(term => {
        term.courses.forEach(course => {
            course.assessments.forEach(a => {
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
    for (let i = 0; i < firstDay; i++) cells.push({ type: 'empty', key: `empty-${viewYear}-${viewMonth}-${i}` });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ type: 'day', day: d, key: `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });

    const handleDayClick = (day) => {
        if (!day) return;
        const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        setSelectedDay(prev => prev?.key === key ? null : { key, day, assessments: assessmentsByDate[key] || [] });
    };

    const getDotColor = (dayItems) => {
        if (dayItems.length === 0) return null;
        if (dayItems.some(a => getUrgency(a.dueTimestamp) === 'urgent')) return 'var(--urgent-stripe)';
        if (dayItems.some(a => getUrgency(a.dueTimestamp) === 'warning')) return 'var(--warning-stripe)';
        return 'var(--safe-stripe)';
    };

    const getUrgencyStyles = (urg) => {
        let bg = 'var(--safe-bg)';
        let col = 'var(--safe-text)';
        let stripe = 'var(--safe-stripe)';

        if (urg === 'urgent') {
            bg = 'var(--urgent-bg)';
            col = 'var(--urgent-text)';
            stripe = 'var(--urgent-stripe)';
        } else if (urg === 'warning') {
            bg = 'var(--warning-bg)';
            col = 'var(--warning-text)';
            stripe = 'var(--warning-stripe)';
        }

        return { bg, col, stripe };
    };

    const getBorderColor = (isSelected, isToday) => {
        if (isSelected) return 'var(--accent)';
        if (isToday) return 'var(--accent-border)';
        return 'transparent';
    };

    const getCellContainerStyle = (isSelected, isToday, hasItems) => {
        let background = 'transparent';
        if (isSelected || isToday) background = 'var(--accent-light)';
        else if (hasItems) background = 'var(--bg-subtle)';

        return {
            minHeight: 80,
            borderRadius: 8,
            padding: '0.4rem',
            cursor: 'pointer',
            position: 'relative',
            border: `1px solid ${getBorderColor(isSelected, isToday)}`,
            background,
            overflow: 'hidden',
        };
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.75rem 1.125rem', boxShadow: 'var(--shadow-sm)' }}>
                <button onClick={prevMonth} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>{MONTHS[viewMonth]} {viewYear}</span>
                    <button onClick={goToday} style={{ padding: '0.3rem 0.8rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Today</button>
                </div>
                <button onClick={nextMonth} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.5rem', boxShadow: 'var(--shadow-sm)' }}>
                {DAYS.map(d => (
                    <div key={d} style={{ padding: '0.5rem 0', textAlign: 'center', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{d}</div>
                ))}
                {cells.map((cell) => {
                    if (cell.type === 'empty') return <div key={cell.key} style={{ minHeight: 80 }} />;
                    const { day, key } = cell;
                    const isToday = key === todayStr;
                    const dayItems = assessmentsByDate[key] || [];
                    const isSelected = selectedDay?.key === key;
                    const dotColor = getDotColor(dayItems);
                    return (
                        <button key={key} onClick={() => handleDayClick(day)}
                            style={getCellContainerStyle(isSelected, isToday, dayItems.length > 0)}
                        >
                            <span style={{ fontSize: '0.75rem', fontWeight: isToday ? 800 : 600, fontFamily: 'IBM Plex Mono, monospace', color: isToday ? 'var(--accent)' : 'var(--text-secondary)', display: 'block', lineHeight: 1 }}>{day}</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 3 }}>
                                {dayItems.slice(0, 2).map(a => {
                                    const urg = getUrgency(a.dueTimestamp);
                                    const { bg, col, stripe } = getUrgencyStyles(urg);
                                    return (
                                        <div key={a.id} style={{ fontSize: '0.57rem', fontWeight: 600, padding: '0.1rem 0.3rem', borderRadius: 4, background: bg, color: col, borderLeft: `2px solid ${stripe}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {formatTime(a.dueAt)} {a.name}
                                        </div>
                                    );
                                })}
                                {dayItems.length > 2 && <div style={{ fontSize: '0.55rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0 0.3rem' }}>+{dayItems.length - 2} more</div>}
                            </div>
                            {dotColor && <span style={{ position: 'absolute', bottom: 4, right: 5, width: 6, height: 6, borderRadius: '50%', background: dotColor }} />}
                        </button>
                    );
                })}
            </div>

            {selectedDay && (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedDay.day} {MONTHS[viewMonth]} {viewYear}</h3>
                        <button onClick={() => setSelectedDay(null)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                    {selectedDay.assessments.length === 0 ? (
                        <p style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0, textAlign: 'center' }}>No assessments due this day.</p>
                    ) : (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {selectedDay.assessments.map(a => {
                                const urg = getUrgency(a.dueTimestamp);
                                let stripeColor;
                                if (urg === 'urgent') {
                                    stripeColor = 'var(--urgent-stripe)';
                                } else if (urg === 'warning') {
                                    stripeColor = 'var(--warning-stripe)';
                                } else {
                                    stripeColor = 'var(--safe-stripe)';
                                }
                                return (
                                    <div
                                        key={a.id}
                                        tabIndex={0}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                                        type="button"
                                        onClick={() => onOpenDetails(a)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                onOpenDetails(a);
                                            }
                                        }}
                                    >
                                        <div style={{ width: 3, height: 36, borderRadius: 3, background: stripeColor, flexShrink: 0 }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{a.name}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{a.courseName} · {formatShortDate(a.dueAt)}</div>
                                        </div>
                                        <button className={styles.moreBtn} style={{ opacity: 1 }} onClick={e => { e.stopPropagation(); onOpenDetails(a); }}>···</button>
                                    </div>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
});

CalendarView.propTypes = {
    dueData: PropTypes.shape({
        terms: PropTypes.arrayOf(
            PropTypes.shape({
                courses: PropTypes.arrayOf(
                    PropTypes.shape({
                        assessments: PropTypes.arrayOf(PropTypes.object).isRequired,
                    })
                ).isRequired,
            })
        ).isRequired,
    }).isRequired,
    hiddenIds: PropTypes.instanceOf(Set).isRequired,
    onHide: PropTypes.func,
    onUnhide: PropTypes.func,
    onOpenDetails: PropTypes.func.isRequired,
    nowTick: PropTypes.number,
};

// ─── Timetable & helpers (keep from original) ───────────────────────────────
const TT_START_HOUR = 7;
const TT_END_HOUR = 22;
const TT_SPAN = TT_END_HOUR - TT_START_HOUR;
const TT_BLOCK_TONES = 8;

function positionBlock(startStr, endStr) {
    const parseDecimalHour = s => { const d = new Date(s); return d.getHours() + d.getMinutes() / 60; };
    const s = parseDecimalHour(startStr); const e = parseDecimalHour(endStr);
    const cs = Math.max(TT_START_HOUR, Math.min(TT_END_HOUR, s));
    const ce = Math.max(TT_START_HOUR, Math.min(TT_END_HOUR, e));
    return { left: `${((cs - TT_START_HOUR) / TT_SPAN) * 100}%`, width: `${Math.max(0.5, ((ce - cs) / TT_SPAN) * 100)}%` };
}

function positionBlockVertical(startStr, endStr) {
    const parseDecimalHour = s => { const d = new Date(s); return d.getHours() + d.getMinutes() / 60; };
    const s = parseDecimalHour(startStr); const e = parseDecimalHour(endStr);
    const cs = Math.max(TT_START_HOUR, Math.min(TT_END_HOUR, s));
    const ce = Math.max(TT_START_HOUR, Math.min(TT_END_HOUR, e));
    return { top: `${((cs - TT_START_HOUR) / TT_SPAN) * 100}%`, height: `${Math.max(1, ((ce - cs) / TT_SPAN) * 100)}%` };
}

function toneIndexForSummary(summary) {
    const codeMatch = (summary || '').match(/[A-Z]{2,6}\d{3,5}[A-Z]?/);
    const key = codeMatch ? codeMatch[0] : (summary || '').split(',')[0].trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = key.codePointAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % TT_BLOCK_TONES;
}

function formatHourLabel(h, use24Hour) {
    if (use24Hour) return `${String(h).padStart(2, '0')}:00`;
    if (h === 0 || h === 24) return '12 AM';
    if (h === 12) return '12 PM';
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

// Import timetable view styles from Home.module.css via inline styles for the timetable
// (keeping all timetable functionality intact by using original Home.module.css)
import homeStyles from '../styles/Home.module.css';

const TimetableView = memo(function TimetableView({ timetableEvents, timetableLoading, timetableError }) {
    const today = new Date();
    const [weekOffset, setWeekOffset] = useState(0);
    const [dayOffset, setDayOffset] = useState(() => { const day = new Date().getDay(); return day === 0 ? 6 : day - 1; });
    const [ttViewMode, setTtViewMode] = useState('week');
    const [isVerticalTimetable, setIsVerticalTimetable] = useState(false);
    const [localNow, setLocalNow] = useState(() => new Date());
    const [selectedClass, setSelectedClass] = useState(null);
    const [use24Hour, setUse24Hour] = useState(() => {
        try {
            const saved = localStorage.getItem('fr_tt_time_format');
            if (saved === '12') return false;
            if (saved === '24') return true;
        } catch { }
        return true;
    });
    useEffect(() => { try { localStorage.setItem('fr_tt_time_format', use24Hour ? '24' : '12'); } catch { } }, [use24Hour]);
    useEffect(() => { const timer = setInterval(() => setLocalNow(new Date()), 1000); return () => clearInterval(timer); }, []);
    useEffect(() => {
        if (globalThis.window === undefined) return;
        const media = globalThis.matchMedia('(max-width: 900px), (orientation: portrait)');
        const updateMode = e => setIsVerticalTimetable(e.matches);
        updateMode(media); media.addEventListener('change', updateMode);
        return () => media.removeEventListener('change', updateMode);
    }, []);

    const weekStart = useMemo(() => {
        const d = new Date(today);
        const day = d.getDay();
        const diffToMon = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diffToMon + weekOffset * 7);
        d.setHours(0, 0, 0, 0);
        return d;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekOffset]);

    const weekDays = useMemo(() => {
        const arr = [];
        for (let i = 0; i < 7; i += 1) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            arr.push(d);
        }
        return arr;
    }, [weekStart]);
    const toDateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayKey = toDateKey(today);
    const eventsByDate = useMemo(() => { const map = {}; timetableEvents.forEach(ev => { const key = toDateKey(new Date(ev.start)); if (!map[key]) { map[key] = []; } map[key].push(ev); }); return map; }, [timetableEvents]);
    const hours = Array.from({ length: TT_SPAN }, (_, i) => TT_START_HOUR + i);
    const weekLabel = (() => { const opts = { day: 'numeric', month: 'short' }; const s = weekDays[0].toLocaleDateString('en-AU', opts); const e = weekDays[6].toLocaleDateString('en-AU', { ...opts, year: 'numeric' }); return `${s} – ${e}${weekOffset === 0 ? ' (current week)' : ''}`; })();
    const formatLocalTime = value => new Date(value).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: !use24Hour });
    const localNowLabel = localNow.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !use24Hour });
    const nowDecimalHour = localNow.getHours() + (localNow.getMinutes() / 60) + (localNow.getSeconds() / 3600);
    const isNowInTimetableRange = nowDecimalHour >= TT_START_HOUR && nowDecimalHour <= TT_END_HOUR;
    const nowMarkerPercent = ((Math.max(TT_START_HOUR, Math.min(TT_END_HOUR, nowDecimalHour)) - TT_START_HOUR) / TT_SPAN) * 100;
    const selectedDay = weekDays[Math.max(0, Math.min(6, dayOffset))] || weekDays[0];
    const selectedDayKey = toDateKey(selectedDay);
    const isSelectedDayToday = selectedDayKey === todayKey;
    const selectedDayEvents = [...(eventsByDate[selectedDayKey] || [])].sort((a, b) => new Date(a.start) - new Date(b.start));
    const selectedDayLabel = selectedDay.toLocaleDateString('en-AU', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
    const formatLocalDateTime = value => new Date(value).toLocaleString('en-AU', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: !use24Hour });

    return (
        <div className={homeStyles.timetableWrap}>
            <div className={homeStyles.ttControls}>
                <span className={homeStyles.ttLocalTime}><span className={homeStyles.ttLocalTimeValue}>{localNowLabel}</span></span>
                <button type="button" className={homeStyles.ttTimeFormatBtn} onClick={() => setUse24Hour(v => !v)}>{use24Hour ? '24h' : '12h'}</button>
            </div>
            {timetableError && <div className={homeStyles.errorBanner}><span>⚠️ {timetableError}</span></div>}
            {timetableLoading && <div className={homeStyles.loadingWrap}><span className={homeStyles.spinnerLarge} /><p className={homeStyles.loadingText}>Syncing timetable…</p></div>}
            {!timetableLoading && timetableEvents.length === 0 && !timetableError && (
                <div className={homeStyles.emptyState}>
                    <div className={homeStyles.emptyIcon}>📚</div>
                    <p className={homeStyles.emptyTitle}>No timetable events found</p>
                    <p className={homeStyles.emptySub}>No timetable events are available for this account.</p>
                </div>
            )}
            {!timetableLoading && timetableEvents.length > 0 && (
                <div className={homeStyles.ttOuter}>
                    <div className={homeStyles.ttWeekNav}>
                        <button className={homeStyles.ttNavBtn} onClick={() => setWeekOffset(o => o - 1)}>‹</button>
                        <span className={homeStyles.ttWeekLabel}>{weekLabel}</span>
                        <button className={homeStyles.ttNavBtn} onClick={() => setWeekOffset(o => o + 1)}>›</button>
                        {weekOffset !== 0 && <button className={homeStyles.ttTodayBtn} onClick={() => setWeekOffset(0)}>Today</button>}
                    </div>
                    <div className={homeStyles.ttViewSwitch}>
                        <button className={`${homeStyles.ttViewBtn} ${ttViewMode === 'week' ? homeStyles.ttViewBtnActive : ''}`} onClick={() => setTtViewMode('week')}>Week view</button>
                        <button className={`${homeStyles.ttViewBtn} ${ttViewMode === 'day' ? homeStyles.ttViewBtnActive : ''}`} onClick={() => setTtViewMode('day')}>Day activities</button>
                    </div>
                    {ttViewMode === 'week' ? (
                        <div className={homeStyles.ttScrollArea}>
                            <div className={homeStyles.ttGrid}>
                                <div className={homeStyles.ttCorner} />
                                <div className={homeStyles.ttHourRow}>{hours.map(h => <div key={h} className={homeStyles.ttHourCell}>{formatHourLabel(h, use24Hour)}</div>)}</div>
                                {weekDays.map(day => {
                                    const key = toDateKey(day);
                                    const isToday = key === todayKey;
                                    const dayEvents = eventsByDate[key] || [];
                                    return (
                                        <React.Fragment key={key}>
                                            <div className={`${homeStyles.ttDayLabel} ${isToday ? homeStyles.ttDayLabelToday : ''}`}>
                                                <span className={homeStyles.ttDayName}>{day.toLocaleDateString('en-AU', { weekday: 'short' })}</span>
                                                <span className={homeStyles.ttDayDate}>{day.toLocaleDateString('en-AU', { day: 'numeric', month: 'numeric' })}</span>
                                            </div>
                                            <div className={`${homeStyles.ttTimeline} ${isToday ? homeStyles.ttTimelineToday : ''}`}>
                                                {hours.map(h => <div key={h} className={homeStyles.ttHourDivider} style={{ left: `${((h - TT_START_HOUR) / TT_SPAN) * 100}%`, width: `${(1 / TT_SPAN) * 100}%` }} />)}
                                                {isToday && isNowInTimetableRange && <div className={homeStyles.ttNowMarker} style={{ left: `${nowMarkerPercent}%` }} />}
                                                {dayEvents.map((ev, idx) => {
                                                    const pos = positionBlock(ev.start, ev.end);
                                                    const toneIndex = toneIndexForSummary(ev.className || ev.summary);
                                                    const toneClass = homeStyles['ttBlockTone' + toneIndex];
                                                    const eventKey = ev.uid || `${key}-${idx}`;
                                                    const isSelected = selectedClass?.uid ? selectedClass.uid === ev.uid : selectedClass?.eventKey === eventKey;
                                                    return (
                                                        <button key={eventKey} className={[homeStyles.ttBlock, toneClass, isSelected ? homeStyles.ttBlockActive : ''].join(' ')} style={{ left: pos.left, width: pos.width }} onClick={() => setSelectedClass({ ...ev, toneIndex, eventKey })}>
                                                            <span className={homeStyles.ttBlockName}>{ev.summary}</span>
                                                            {ev.location && <span className={homeStyles.ttBlockLoc}>{ev.location}</span>}
                                                            <span className={homeStyles.ttBlockTime}>{formatLocalTime(ev.start)} – {formatLocalTime(ev.end)}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className={homeStyles.ttDayViewWrap}>
                            <div className={homeStyles.ttDayNav}>
                                <button className={homeStyles.ttNavBtn} onClick={() => setDayOffset(d => Math.max(0, d - 1))} disabled={dayOffset === 0}>‹</button>
                                <span className={homeStyles.ttDayLabelLarge}>{selectedDayLabel}</span>
                                <button className={homeStyles.ttNavBtn} onClick={() => setDayOffset(d => Math.min(6, d + 1))} disabled={dayOffset === 6}>›</button>
                            </div>
                            {isVerticalTimetable ? (
                                <div className={homeStyles.ttDayTimelineShell}>
                                    <div className={homeStyles.ttHourRow}>{hours.map(h => <div key={`day-${h}`} className={homeStyles.ttHourCell}>{formatHourLabel(h, use24Hour)}</div>)}</div>
                                    <div className={homeStyles.ttDayTimelineTrack}>
                                        {hours.map(h => <div key={`day-divider-${h}`} className={homeStyles.ttHourDivider} style={{ left: `${((h - TT_START_HOUR) / TT_SPAN) * 100}%`, width: `${(1 / TT_SPAN) * 100}%` }} />)}
                                        {isSelectedDayToday && isNowInTimetableRange && <div className={homeStyles.ttNowMarker} style={{ left: `${nowMarkerPercent}%` }} />}
                                        {selectedDayEvents.map((ev, idx) => {
                                            const pos = positionBlock(ev.start, ev.end);
                                            const toneIndex = toneIndexForSummary(ev.className || ev.summary);
                                            const eventKey = `${selectedDayKey}-${idx}`;
                                            const isSelected = selectedClass?.uid ? selectedClass.uid === ev.uid : selectedClass?.eventKey === eventKey;
                                            const toneClass = homeStyles['ttBlockTone' + toneIndex];
                                            return (
                                                <button key={eventKey} type="button" className={[homeStyles.ttBlock, homeStyles.ttDayBlock, toneClass, isSelected ? homeStyles.ttBlockActive : ''].join(' ')} style={{ left: pos.left, width: pos.width }} onClick={() => setSelectedClass({ ...ev, toneIndex, eventKey })}>
                                                    <span className={homeStyles.ttBlockName}>{ev.summary}</span>
                                                    <span className={homeStyles.ttBlockTime}>{formatLocalTime(ev.start)} – {formatLocalTime(ev.end)}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className={homeStyles.ttDayVerticalShell}>
                                    <div className={homeStyles.ttDayVerticalTrack}>
                                        {hours.map(h => <div key={`vertical-divider-${h}`} className={homeStyles.ttDayVerticalDivider} style={{ top: `${((h - TT_START_HOUR) / TT_SPAN) * 100}%` }}><span className={homeStyles.ttDayVerticalHour}>{formatHourLabel(h, use24Hour)}</span></div>)}
                                        {isSelectedDayToday && isNowInTimetableRange && <div className={`${homeStyles.ttNowMarker} ${homeStyles.ttNowMarkerVertical}`} style={{ top: `${nowMarkerPercent}%` }} />}
                                        {selectedDayEvents.map((ev, idx) => {
                                            const pos = positionBlockVertical(ev.start, ev.end);
                                            const toneIndex = toneIndexForSummary(ev.className || ev.summary);
                                            const eventKey = `${selectedDayKey}-${idx}`;
                                            const isSelected = selectedClass?.uid ? selectedClass.uid === ev.uid : selectedClass?.eventKey === eventKey;
                                            const toneClass = homeStyles['ttBlockTone' + toneIndex];
                                            return (
                                                <button key={`vertical-${eventKey}`} type="button" className={[homeStyles.ttBlock, homeStyles.ttDayVerticalBlock, toneClass, isSelected ? homeStyles.ttBlockActive : ''].join(' ')} style={{ top: pos.top, height: pos.height }} onClick={() => setSelectedClass({ ...ev, toneIndex, eventKey })}>
                                                    <span className={homeStyles.ttBlockName}>{ev.summary}</span>
                                                    <span className={homeStyles.ttBlockTime}>{formatLocalTime(ev.start)} - {formatLocalTime(ev.end)}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {selectedDayEvents.length === 0 ? (
                                <div className={homeStyles.eventEmptyState}>No activities for this day.</div>
                            ) : (
                                <ul className={homeStyles.ttDayActivitiesList}>
                                    {selectedDayEvents.map((ev, idx) => {
                                        const toneIndex = toneIndexForSummary(ev.className || ev.summary);
                                        const eventKey = `${selectedDayKey}-${idx}`;
                                        const isSelected = selectedClass?.uid ? selectedClass.uid === ev.uid : selectedClass?.eventKey === eventKey;
                                        return (
                                            <li key={`activity-${eventKey}`} className={homeStyles.ttActivityItem}>
                                                <button className={`${homeStyles.ttActivityBtn} ${isSelected ? homeStyles.ttActivityBtnActive : ''}`} onClick={() => setSelectedClass({ ...ev, toneIndex, eventKey })}>
                                                    <span className={homeStyles.ttActivityTime}>{formatLocalTime(ev.start)} - {formatLocalTime(ev.end)}</span>
                                                    <span className={homeStyles.ttActivityName}>{ev.summary}</span>
                                                    {ev.location && <span className={homeStyles.ttActivityLocation}>{ev.location}</span>}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    )}
                    <div className={homeStyles.eventsListWrapper}>
                        {selectedClass ? (
                            <div className={homeStyles.eventCard}>
                                <div className={`${homeStyles.ttDetailStripe} ${homeStyles['ttBlockTone' + selectedClass.toneIndex]}`} />
                                <div className={homeStyles.eventDetailsSection} style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <span className={homeStyles.eventName}>{selectedClass.className || selectedClass.summary}</span>
                                        <button className={homeStyles.calDetailClose} onClick={() => setSelectedClass(null)}>✕</button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.625rem 1.5rem' }}>
                                        <div><div className={homeStyles.ttDetailLabel}>Start</div><div className={homeStyles.ttDetailValue}>{formatLocalDateTime(selectedClass.start)}</div></div>
                                        <div><div className={homeStyles.ttDetailLabel}>End</div><div className={homeStyles.ttDetailValue}>{formatLocalDateTime(selectedClass.end)}</div></div>
                                        {selectedClass.location && <div style={{ gridColumn: '1 / -1' }}><div className={homeStyles.ttDetailLabel}>Location</div><div className={homeStyles.ttDetailValue}>{selectedClass.location}</div></div>}
                                        {selectedClass.summary && selectedClass.summary !== selectedClass.className && <div style={{ gridColumn: '1 / -1' }}><div className={homeStyles.ttDetailLabel}>Full title</div><div className={homeStyles.ttDetailValue}>{selectedClass.summary}</div></div>}
                                        {selectedClass.description && <div style={{ gridColumn: '1 / -1' }}><div className={homeStyles.ttDetailLabel}>Description</div><div className={homeStyles.ttDetailValue} style={{ whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>{selectedClass.description}</div></div>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className={homeStyles.eventEmptyState}>Click a class block to view details.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

TimetableView.propTypes = {
    timetableEvents: PropTypes.arrayOf(PropTypes.shape({
        start: PropTypes.string.isRequired,
        end: PropTypes.string.isRequired,
        summary: PropTypes.string,
        className: PropTypes.string,
        location: PropTypes.string,
        uid: PropTypes.string,
    })),
    timetableLoading: PropTypes.bool,
    timetableError: PropTypes.string,
};

TimetableView.defaultProps = {
    timetableEvents: [],
    timetableLoading: false,
    timetableError: null,
};

// ─── Settings Modal ────────────────────────────────────────────────────────
function SettingsModal({ user, dashboardVersion, onClose, onSaved, reminderHours, onReminderHoursChange, notificationPermission, onEnableNotifications, inline = false }) {
    const defaultEnvUrl = 'https://rmit.instructure.com/api/v1/';
    const savedUrl = user?.canvasBaseUrl || defaultEnvUrl;
    const matchedPreset = UNIVERSITIES.find(u => u.url && u.url.toLowerCase() === savedUrl.toLowerCase());
    const initialPreset = matchedPreset ? matchedPreset.url : '';

    const [form, setForm] = useState({ canvasApiToken: '', timetableLink: '', canvasBaseUrl: '', dashboardVersion: dashboardVersion || 'base' });
    const [uniPreset, setUniPreset] = useState(initialPreset);
    const [showCustomUrl, setShowCustomUrl] = useState(!matchedPreset && Boolean(user?.canvasBaseUrl));
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const handleChange = e => { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setError(''); setSuccess(''); };
    const handleUniSelect = e => {
        const val = e.target.value;
        setUniPreset(val);
        if (val === '') { setShowCustomUrl(true); setForm(f => ({ ...f, canvasBaseUrl: '' })); }
        else { setShowCustomUrl(false); setForm(f => ({ ...f, canvasBaseUrl: val })); }
        setError(''); setSuccess('');
    };
    const handleSave = async e => {
        e.preventDefault(); setSaving(true); setError(''); setSuccess('');
        try {
            const payload = {};
            if (form.canvasApiToken) payload.canvasApiToken = form.canvasApiToken;
            if (form.timetableLink) payload.timetableLink = form.timetableLink;
            let resolvedUrl;
            if (showCustomUrl) {
                resolvedUrl = form.canvasBaseUrl;
            } else if (uniPreset === initialPreset) {
                resolvedUrl = undefined;
            } else {
                resolvedUrl = uniPreset;
            }
            if (resolvedUrl !== undefined) payload.canvasBaseUrl = resolvedUrl;
            payload.dashboardVersion = form.dashboardVersion;
            const res = await fetch('/api/auth/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!res.ok) { setError(data.message || 'Failed to save.'); return; }
            setSuccess('Settings saved! Encrypted with AES-256-GCM.');
            onSaved?.(data.user);
        } catch { setError('Network error. Please try again.'); }
        finally { setSaving(false); }
    };

    const content = (
        <div className={styles.modal}>
            <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>⚙️ Settings</h2>
                <button className={styles.modalClose} onClick={onClose}>✕</button>
            </div>
            <div className={styles.modalBody}>
                <div className={styles.userInfo}>
                    <div className={styles.userAvatar}>{user?.username?.[0]?.toUpperCase() || '?'}</div>
                    <div><div className={styles.userName}>{user?.username}</div><div className={styles.userEmail}>{user?.email}</div></div>
                </div>
                {error && <div className={styles.settingsError}><span>⚠️</span> {error}</div>}
                {success && <div className={styles.settingsSuccess}><span>✅</span> {success}</div>}
                <form onSubmit={handleSave} className={styles.settingsForm}>
                    <div className={styles.settingsField}>
                        <label htmlFor="uniPreset" className={styles.settingsLabel}>
                            University / Canvas Instance{''}
                            <span className={styles.settingsLabelHint}>Current: <code className={styles.urlCode}>{user?.canvasBaseUrl || defaultEnvUrl}</code></span>
                        </label>
                        <select id="uniPreset" value={uniPreset} onChange={handleUniSelect} className={styles.settingsSelect}>
                            <option value="" disabled>Select your university…</option>
                            {UNIVERSITIES.map(u => <option key={u.label} value={u.url}>{u.label}</option>)}
                        </select>
                    </div>
                    <div className={styles.settingsField}>
                        <label htmlFor="dashboardVersion" className={styles.settingsLabel}>
                            Dashboard version
                            {' '}
                            <span className={styles.settingsLabelHint}>Switch between the default dashboard and v1</span>
                        </label>
                        <select
                            id="dashboardVersion"
                            value={form.dashboardVersion}
                            onChange={e => setForm(f => ({ ...f, dashboardVersion: e.target.value }))}
                            className={styles.settingsSelect}
                        >
                            <option value="base">Default dashboard</option>
                            <option value="v1">Dashboard v1</option>
                        </select>
                    </div>
                    {showCustomUrl && (
                        <div className={styles.settingsField}>
                            <label htmlFor="canvasBaseUrl" className={styles.settingsLabel}>Canvas API Base URL</label>
                            <input id="canvasBaseUrl" name="canvasBaseUrl" type="url" value={form.canvasBaseUrl} onChange={handleChange} className={styles.settingsInput} placeholder="https://your-university.instructure.com/api/v1/" autoComplete="off" />
                        </div>
                    )}
                    <div className={styles.settingsDivider} />
                    <div className={styles.settingsField}>
                        <label htmlFor="canvasApiToken" className={styles.settingsLabel}>
                            Canvas API Token{' '}
                            <span className={styles.settingsLabelHint}>Canvas → Account → Settings → New Access Token</span>
                        </label>
                        <div className={styles.inputWithBadge}>
                            <input id="canvasApiToken" name="canvasApiToken" type="password" value={form.canvasApiToken} onChange={handleChange} className={styles.settingsInput} placeholder={user?.hasCanvasToken ? '••••••••••••••• (saved — paste to update)' : 'Paste your Canvas API token'} autoComplete="off" />
                            {user?.hasCanvasToken && <span className={styles.savedBadge}>🔐 Encrypted &amp; saved</span>}
                        </div>
                    </div>
                    <div className={styles.settingsField}>
                        <label htmlFor="timetableLink" className={styles.settingsLabel}>
                            Timetable iCal Link
                            {' '}
                            <span className={styles.settingsLabelHint}>Optional</span>
                        </label>
                        <div className={styles.inputWithBadge}>
                            <input id="timetableLink" name="timetableLink" type="url" value={form.timetableLink} onChange={handleChange} className={styles.settingsInput} placeholder={user?.hasTimetableLink ? 'https://... (saved — paste to update)' : 'https://your-timetable.ics'} />
                            {user?.hasTimetableLink && <span className={styles.savedBadge}>🔐 Encrypted &amp; saved</span>}
                        </div>
                    </div>
                    <div className={styles.settingsDivider} />
                    <div className={styles.settingsField}>
                        <label htmlFor="reminderHours" className={styles.settingsLabel}>
                            Reminder threshold (hours)<span className={styles.settingsLabelHint}>Local device setting</span>
                        </label>
                        <input id="reminderHours" type="number" min="1" max="168" value={reminderHours} onChange={e => onReminderHoursChange(Math.min(168, Math.max(1, Number(e.target.value) || 1)))} className={styles.settingsInput} />
                    </div>
                    <div className={styles.settingsField}>
                        <label className={styles.settingsLabel}>
                            Browser notifications
                            {' '}
                            <span className={styles.settingsLabelHint}>Current: {notificationPermission}</span>
                        </label>
                        <button type="button" className={styles.settingsSave} onClick={onEnableNotifications} disabled={notificationPermission === 'granted'}>
                            {notificationPermission === 'granted' ? 'Notifications enabled' : 'Enable notifications'}
                        </button>
                    </div>
                    <div className={styles.settingsField}>
                        <div className={styles.settingsLabel}>Calendar export<span className={styles.settingsLabelHint}>Download as .ics</span></div>
                        <button type="button" className={styles.settingsSave} onClick={() => { globalThis.location.href = '/api/assessments/export.ics'; }}>Export assessments (.ics)</button>
                    </div>
                    <button type="submit" className={styles.settingsSave} disabled={saving}>{saving ? '🔐 Saving…' : 'Save settings'}</button>
                </form>
            </div>
        </div>
    );

    if (inline) return content;

    return (
        <div className={styles.modalOverlay}>
            <button
                type="button"
                className={styles.modalBackdrop}
                aria-label="Close settings"
                onClick={onClose}
            />
            {content}
        </div>
    );
}
SettingsModal.propTypes = {
    user: PropTypes.shape({
        username: PropTypes.string,
        email: PropTypes.string,
        canvasBaseUrl: PropTypes.string,
        hasCanvasToken: PropTypes.bool,
        hasTimetableLink: PropTypes.bool,
    }),
    dashboardVersion: PropTypes.string,
    onClose: PropTypes.func.isRequired,
    onSaved: PropTypes.func,
    reminderHours: PropTypes.number.isRequired,
    onReminderHoursChange: PropTypes.func.isRequired,
    notificationPermission: PropTypes.string.isRequired,
    onEnableNotifications: PropTypes.func.isRequired,
    inline: PropTypes.bool,
};

function HelpModal({ onClose }) {
    const shortcuts = [{ key: 'S', action: 'Focus search' }, { key: 'C', action: 'Open calendar tab' }, { key: 'T', action: 'Open timetable tab' }, { key: '?', action: 'Open this help modal' }];
    return (
        <div
            className={styles.modalOverlay}
        >
            <button
                type="button"
                className={styles.modalBackdrop}
                aria-label="Close keyboard shortcuts"
                onClick={onClose}
            />
            <div
                className={styles.modal}
            >
                <div className={styles.modalHeader}><h2 className={styles.modalTitle}>⌨️ Keyboard shortcuts</h2><button className={styles.modalClose} onClick={onClose}>✕</button></div>
                <div className={styles.modalBody}>
                    <div className={styles.shortcutList}>
                        {shortcuts.map(s => (
                            <div key={s.key} className={styles.shortcutRow}><kbd className={styles.shortcutKey}>{s.key}</kbd><span className={styles.shortcutAction}>{s.action}</span></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

HelpModal.propTypes = {
    onClose: PropTypes.func.isRequired,
};

function AssessmentDetailModal({ assessment, onClose, isHidden, isComplete, onHide, onUnhide, onToggleComplete }) {
    if (!assessment) return null;
    const plainDescription = (assessment.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const showCompleteAction = !isHidden;
    const showHideAction = !isHidden;
    const showRestoreAction = isHidden;
    return (
        <div
            className={styles.modalOverlay}
        >
            <button
                type="button"
                className={styles.modalBackdrop}
                aria-label="Close assessment details"
                onClick={onClose}
            />
            <div className={styles.modal}>
                <div className={styles.modalHeader}><h2 className={styles.modalTitle}>📘 {assessment.name}</h2><button className={styles.modalClose} onClick={onClose}>✕</button></div>
                <div className={styles.modalBody}>
                    <div className={styles.detailMetaGrid}>
                        <span className={styles.detailMetaItem}>📚 {assessment.courseName}</span>
                        <span className={styles.detailMetaItem}>📅 {formatShortDate(assessment.dueAt)}</span>
                        {assessment.pointsPossible != null && <span className={styles.detailMetaItem}>⭐ {assessment.pointsPossible} pts</span>}
                        {assessment.score != null && <span className={styles.detailMetaItem}>🏁 Score: {assessment.score}{assessment.pointsPossible !== null && assessment.pointsPossible !== undefined ? `/${assessment.pointsPossible}` : ''}</span>}
                        {assessment.grade && <span className={styles.detailMetaItem}>🧾 Grade: {assessment.grade}</span>}
                        {Array.isArray(assessment.submissionTypes) && assessment.submissionTypes.length > 0 && <span className={styles.detailMetaItem}>📤 {assessment.submissionTypes.join(', ')}</span>}
                    </div>
                    <div className={styles.detailDescription}>{plainDescription || 'No description available.'}</div>
                    <div className={styles.detailActions}>
                        <a className={styles.settingsSave} href={assessment.htmlUrl} target="_blank" rel="noopener noreferrer">Open in Canvas</a>
                        {showCompleteAction && (
                            <button className={styles.settingsSave} onClick={() => onToggleComplete(assessment.id)}>
                                {isComplete ? '↺ Undo complete' : '✓ Mark complete'}
                            </button>
                        )}
                        {showHideAction && (
                            <button className={styles.settingsSave} onClick={() => onHide(assessment.id)}>✕ Hide</button>
                        )}
                        {showRestoreAction && (
                            <button className={styles.settingsSave} onClick={() => onUnhide(assessment.id)}>↩ Restore</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

AssessmentDetailModal.propTypes = {
    assessment: PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        courseName: PropTypes.string,
        dueAt: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        pointsPossible: PropTypes.number,
        score: PropTypes.number,
        grade: PropTypes.string,
        submissionTypes: PropTypes.arrayOf(PropTypes.string),
        rubricUrl: PropTypes.string,
        htmlUrl: PropTypes.string,
        description: PropTypes.string,
    }).isRequired,
    onClose: PropTypes.func.isRequired,
    isHidden: PropTypes.bool,
    isComplete: PropTypes.bool,
    onHide: PropTypes.func,
    onUnhide: PropTypes.func,
    onToggleComplete: PropTypes.func,
};

// ─── MAIN DASHBOARD ────────────────────────────────────────────────────────
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
    // settings are now a tab; remove separate modal flag
    const [setupBanner, setSetupBanner] = useState('');
    const [nowTick, setNowTick] = useState(() => Date.now());
    const [reminderHours, setReminderHours] = useState(() => loadReminderHours());
    const [notificationPermission, setNotificationPermission] = useState(() => {
        if (globalThis.window !== undefined && 'Notification' in globalThis) return Notification.permission;
        return 'default';
    });
    const [remindedMap, setRemindedMap] = useState(() => loadRemindedMap());
    const [showHelp, setShowHelp] = useState(false);
    const [selectedAssessment, setSelectedAssessment] = useState(null);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [groupBy, setGroupBy] = useState('term');
    const [filters, setFilters] = useState({ years: [], terms: [], courseIds: [], courseCodes: [], sortBy: 'dueDate', sortDir: 'asc' });
    const [hiddenIds, setHiddenIds] = useState(() => loadHidden());
    const [completeIds, setCompleteIds] = useState(() => loadCompleted());

    const searchInputRef = useRef(null);
    const pageDashboardVersion = 'base';

    useEffect(() => { const timer = setInterval(() => setNowTick(Date.now()), 30000); return () => clearInterval(timer); }, []);
    useEffect(() => { saveReminderHours(reminderHours); }, [reminderHours]);
    useEffect(() => { saveRemindedMap(remindedMap); }, [remindedMap]);

    const hideAssessment = useCallback(id => {
        setHiddenIds(prev => { const next = new Set(prev); next.add(String(id)); saveHidden(next); return next; });
    }, []);
    const unhideAssessment = useCallback(id => {
        setHiddenIds(prev => { const next = new Set(prev); next.delete(String(id)); saveHidden(next); return next; });
    }, []);
    const toggleAssessmentComplete = useCallback(id => {
        setCompleteIds(prev => {
            const next = new Set(prev);
            const key = String(id);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            saveCompleted(next);
            return next;
        });
    }, []);
    const clearAllHidden = useCallback(() => { setHiddenIds(new Set()); saveHidden(new Set()); }, []);

    const collectCourseAssessmentIds = useCallback((courseId, hiddenSet) => {
        if (!dueData?.terms) return;
        for (const term of dueData.terms) {
            if (!term?.courses) continue;
            for (const course of term.courses) {
                if (!course || String(course.courseId) !== String(courseId)) continue;
                if (!Array.isArray(course.assessments)) continue;
                for (const a of course.assessments) {
                    hiddenSet.add(String(a.id));
                }
            }
        }
    }, [dueData]);

    const hideCourseAssessments = useCallback(courseId => {
        setHiddenIds(prev => {
            const next = new Set(prev);
            collectCourseAssessmentIds(courseId, next);
            saveHidden(next);
            return next;
        });
    }, [collectCourseAssessmentIds]);

    useEffect(() => {
        fetch('/api/auth/session').then(r => r.json()).then(data => {
            if (data.authenticated) {
                setUser(data.user);
                setAuthChecked(true);
                if (data.user?.dashboardVersion && data.user.dashboardVersion !== pageDashboardVersion) {
                    router.replace(getDashboardRoute(data.user.dashboardVersion));
                    return;
                }
                if (router.query.welcome === '1') setSetupBanner('Welcome! Add your Canvas API token in Settings to get started.');
            } else { router.replace('/login'); }
        }).catch(() => router.replace('/login'));
    }, [router]);

    useEffect(() => {
        router.prefetch(getDashboardRoute('base')).catch(() => { });
    }, [router]);

    const fetchDueAssessments = useCallback(async (queryText = '') => {
        setLoading(true); setError(null);
        try {
            const params = new URLSearchParams();
            if (queryText.trim()) params.set('search', queryText.trim());
            params.set('onlyActive', 'false');
            const query = params.toString() ? `?${params.toString()}` : '';
            const response = await fetch(`/api/assessments/due${query}`);
            if (!response.ok) {
                const data = await response.json();
                if (data.requiresSetup) { setSetupBanner('No Canvas API token configured. Open Settings to add your token.'); return; }
                throw new Error(`Error ${response.status}: Failed to fetch`);
            }
            const data = await response.json();
            setSetupBanner(''); setDueData(data); setLastUpdated(new Date());
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (!authChecked) return;
        const debounce = setTimeout(() => fetchDueAssessments(searchText.trim()), 320);
        return () => clearTimeout(debounce);
    }, [authChecked, searchText, fetchDueAssessments]);

    const fetchTimetableData = useCallback(async () => {
        setTimetableLoading(true); setTimetableError('');
        try {
            const response = await fetch('/api/timetable');
            if (!response.ok) throw new Error(`Error ${response.status}: Failed to fetch timetable`);
            const data = await response.json();
            setTimetableEvents(data.events.sort((a, b) => new Date(a.start) - new Date(b.start)));
        } catch (err) { setTimetableError(err.message || 'Failed to sync timetable'); setTimetableEvents([]); }
        finally { setTimetableLoading(false); }
    }, []);

    useEffect(() => {
        if (activeTab !== 'timetable' || !authChecked) return;
        const timer = setTimeout(() => { fetchTimetableData(); }, 0);
        return () => clearTimeout(timer);
    }, [activeTab, authChecked, fetchTimetableData]);

    useEffect(() => {
        if (globalThis.window === undefined || !('Notification' in globalThis) || notificationPermission !== 'granted') return;
        const allAssessments = dueData.terms.flatMap(t => t.courses.flatMap(c => c.assessments));
        if (allAssessments.length === 0) return;
        const now = Date.now();
        const thresholdMs = reminderHours * 60 * 60 * 1000;
        const nextMap = { ...remindedMap };
        let changed = false;
        allAssessments.forEach(assessment => {
            const key = `${assessment.courseId}:${assessment.id}:${assessment.dueAt}`;
            const diff = assessment.dueTimestamp - now;
            if (diff > 0 && diff <= thresholdMs && !nextMap[key]) {
                const dueLabel = new Date(assessment.dueAt).toLocaleString('en-AU', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                new Notification('Assessment due soon', { body: `${assessment.name} (${assessment.courseName}) due ${dueLabel}`, tag: key });
                nextMap[key] = true; changed = true;
            }
        });
        if (changed) {
            // avoid synchronous setState inside effect to prevent cascading renders
            setTimeout(() => setRemindedMap(nextMap), 0);
        }
    }, [dueData, reminderHours, notificationPermission, remindedMap, nowTick, setRemindedMap]);

    const handleEnableNotifications = useCallback(async () => {
        if (globalThis.window === undefined || !('Notification' in globalThis)) return;
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
    }, []);

    useEffect(() => {
        const onKeyDown = event => {
            const targetTag = event.target?.tagName || '';
            const isTyping = targetTag === 'INPUT' || targetTag === 'TEXTAREA' || event.target?.isContentEditable;
            if (isTyping && event.key !== '?') return;
            if (event.key === 's' || event.key === 'S') { event.preventDefault(); searchInputRef.current?.focus(); return; }
            if (event.key === 'c' || event.key === 'C') { event.preventDefault(); setActiveTab('calendar'); return; }
            if (event.key === 't' || event.key === 'T') { event.preventDefault(); setActiveTab('timetable'); return; }
            if (event.key === '?') { event.preventDefault(); setShowHelp(true); }
        };
        globalThis.addEventListener('keydown', onKeyDown);
        return () => globalThis.removeEventListener('keydown', onKeyDown);
    }, []);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
    };

    const switchDashboardVersion = useCallback(async () => {
        const nextVersion = 'v1';
        fetch('/api/auth/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dashboardVersion: nextVersion }),
            keepalive: true,
        }).catch(() => { });
        router.replace(getDashboardRoute(nextVersion));
    }, [router]);

    const quickLinks = useMemo(() => getQuickLinks(user?.canvasBaseUrl), [user?.canvasBaseUrl]);
    const activeFilterCount = (filters.years?.length || 0) + (filters.terms?.length || 0) + (filters.courseIds?.length || 0) + (filters.courseCodes?.length || 0);
    const isAssessmentTab = ['list', 'calendar', 'hidden', 'completed', 'past'].includes(activeTab);
    const isListLikeTab = activeTab === 'list' || activeTab === 'hidden';

    const tabConfig = [
        { key: 'list', icon: '📋', label: 'Assessments' },
        { key: 'completed', icon: '✅', label: 'Past assessments' },
        { key: 'past', icon: '🕓', label: 'Past classes' },
        { key: 'calendar', icon: '📅', label: 'Calendar' },
        { key: 'settings', icon: '⚙️', label: 'Settings' },
        { key: 'timetable', icon: '🕐', label: 'Timetable' },
        { key: 'hidden', icon: '👁', label: 'Hidden', badge: hiddenIds.size > 0 ? hiddenIds.size : null },
    ];

    const pageTitle = {
        list: 'Assessments',
        completed: 'Past assessments',
        past: 'Past classes',
        settings: 'Settings',
        calendar: 'Calendar',
        timetable: 'Timetable',
        hidden: 'Hidden assessments',
    }[activeTab] || 'Dashboard';

    if (!authChecked) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className={styles.spinnerLarge} />
            </div>
        );
    }

    return (
        <div className={styles.appShell}>
            {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
            {selectedAssessment && (
                <AssessmentDetailModal
                    assessment={selectedAssessment}
                    onClose={() => setSelectedAssessment(null)}
                    isHidden={hiddenIds.has(String(selectedAssessment.id))}
                    isComplete={completeIds.has(String(selectedAssessment.id))}
                    onHide={hideAssessment}
                    onUnhide={unhideAssessment}
                    onToggleComplete={toggleAssessmentComplete}
                />
            )}
            {/* Settings are rendered as a normal tab (see below in content rendering) */}

            {/* Mobile sidebar backdrop */}
            {mobileSidebarOpen && (
                <button
                    className={styles.sidebarBackdrop}
                    tabIndex={0}
                    aria-label="Close sidebar"
                    onClick={() => setMobileSidebarOpen(false)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                            setMobileSidebarOpen(false);
                        }
                    }}
                />
            )}

            {/* ─── Sidebar ─── */}
            <aside className={`${styles.sidebar} ${mobileSidebarOpen ? styles.sidebarOpen : ''}`}>
                <div className={styles.sidebarLogo}>
                    <SiteLogo size={28} />
                    <div>
                        <span className={styles.sidebarLogoText}>Final Reckoning</span>
                        <span className={styles.sidebarLogoSub}>Canvas tracker</span>
                    </div>
                </div>

                <nav className={styles.sidebarNav}>
                    <span className={styles.sidebarSection}>Dashboard</span>
                    {tabConfig.map(tab => (
                        <button key={tab.key} className={`${styles.sidebarNavBtn} ${activeTab === tab.key ? styles.sidebarNavBtnActive : ''}`}
                            onClick={() => { setActiveTab(tab.key); setMobileSidebarOpen(false); }}>
                            <span className={styles.sidebarNavIcon}>{tab.icon}</span>
                            {tab.label}
                            {tab.badge && <span className={styles.sidebarNavBadge}>{tab.badge}</span>}
                        </button>
                    ))}

                    <div className={styles.sidebarDivider} />
                    <span className={styles.sidebarSection}>Quick links</span>
                    {quickLinks.map(link => (
                        <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className={styles.sidebarNavBtn}>
                            <span className={styles.sidebarNavIcon}>↗</span>
                            {link.label}
                        </a>
                    ))}
                </nav>

                <div className={styles.sidebarBottom}>
                    <button className={styles.sidebarNavBtn} onClick={() => { setActiveTab('settings'); setMobileSidebarOpen(false); }}>
                        <span className={styles.sidebarNavIcon}>⚙️</span> Settings
                    </button>
                    <button className={styles.sidebarNavBtn} onClick={() => { setMobileSidebarOpen(false); switchDashboardVersion(); }}>
                        <span className={styles.sidebarNavIcon}>⇄</span> Switch to old dashboard
                    </button>
                    <button className={styles.sidebarNavBtn} onClick={() => { setShowHelp(true); setMobileSidebarOpen(false); }}>
                        <span className={styles.sidebarNavIcon}>⌨️</span> Shortcuts
                    </button>
                    <div className={styles.sidebarDivider} />
                    <div className={styles.sidebarUserBtn}>
                        <div className={styles.sidebarUserAvatar}>{user?.username?.[0]?.toUpperCase() || '?'}</div>
                        <span className={styles.sidebarUserName}>{user?.username}</span>
                    </div>
                    <button className={styles.sidebarLogoutBtn} onClick={handleLogout}>
                        <span className={styles.sidebarNavIcon}>⬅</span> Sign out
                    </button>
                </div>
            </aside>

            {/* ─── Main Area ─── */}
            <div className={styles.mainArea}>
                {/* Setup Banner */}
                {setupBanner && (
                    <div className={styles.setupBanner}>
                        <span>{setupBanner}</span>
                        <div className={styles.setupBannerActions}>
                            <button className={styles.setupBannerBtn} onClick={() => setActiveTab('settings')}>Open Settings</button>
                            <button className={styles.setupBannerClose} onClick={() => setSetupBanner('')}>✕</button>
                        </div>
                    </div>
                )}

                {/* Top Bar */}
                <header className={styles.topBar}>
                    <div className={styles.topBarLeft}>
                        <button className={styles.mobileSidebarToggle} onClick={() => setMobileSidebarOpen(o => !o)}>☰</button>
                        <span className={styles.topBarTitle}>{pageTitle}</span>
                        {lastUpdated && (
                            <>
                                <span className={styles.topBarDivider} />
                                <span className={styles.lastUpdated}>Updated {lastUpdated.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>
                            </>
                        )}
                    </div>
                    <div className={styles.topBarRight}>
                        <button className={`${styles.topBarBtn} ${styles.topBarBtnPrimary}`} onClick={() => fetchDueAssessments(searchText)} disabled={loading}>
                            {loading ? <><span className={styles.spinner} /> Refreshing…</> : '↻ Refresh'}
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <main className={styles.pageContent}>
                    {/* Controls row */}
                    {isAssessmentTab && (
                        <div className={styles.controlsRow}>
                            <div className={styles.searchBox}>
                                <span className={styles.searchIcon}>🔍</span>
                                <input ref={searchInputRef} type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search by course, assignment, or semester…" className={styles.searchInput} />
                            </div>
                            <div className={styles.controlsDivider} />
                            <div className={styles.controlsActions}>
                                <button className={styles.ctrlBtn} onClick={() => setSearchText('')}>Show all</button>
                                {isListLikeTab && (
                                    <button
                                        className={`${styles.ctrlBtn} ${groupBy === 'class' ? styles.ctrlBtnActive : ''}`}
                                        onClick={() => setGroupBy(current => (current === 'class' ? 'term' : 'class'))}
                                        title="Toggle grouping mode"
                                    >
                                        Group: {groupBy === 'class' ? 'Class' : 'Term'}
                                    </button>
                                )}
                                {isAssessmentTab && (
                                    <button className={`${styles.ctrlBtn} ${showFilterPanel ? styles.ctrlBtnActive : ''}`} onClick={() => setShowFilterPanel(o => !o)}>
                                        ⚡ Filters
                                        {activeFilterCount > 0 && <span className={styles.filterBadge}>{activeFilterCount}</span>}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

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

                    {/* Content */}
                    {!loading && !error && (
                        <div className={`${styles.contentWithFilter}`}>
                            {isAssessmentTab && showFilterPanel && (
                                <FilterPanel dueData={dueData} filters={filters} onFiltersChange={setFilters} onHideCourse={hideCourseAssessments} />
                            )}
                            <div className={styles.contentMain}>
                                {(activeTab === 'list' || activeTab === 'hidden' || activeTab === 'completed' || activeTab === 'past') && (
                                    <>
                                        {activeTab === 'hidden' && hiddenIds.size > 0 && (
                                            <div className={styles.hiddenBanner}>
                                                <span>👁 Showing {hiddenIds.size} hidden assessment{hiddenIds.size === 1 ? '' : 's'}</span>
                                                <button className={styles.clearHiddenBtn} onClick={clearAllHidden}>🗑 Clear all hidden</button>
                                            </div>
                                        )}
                                        {(() => {
                                            let listViewMode;
                                            if (activeTab === 'completed') {
                                                listViewMode = 'completed';
                                            } else if (activeTab === 'past') {
                                                listViewMode = 'past';
                                            } else {
                                                listViewMode = 'upcoming';
                                            }
                                            return (
                                                <ListView
                                                    dueData={dueData}
                                                    urgencyFilter={urgencyFilter}
                                                    setUrgencyFilter={setUrgencyFilter}
                                                    filters={filters}
                                                    hiddenIds={hiddenIds}
                                                    completeIds={completeIds}
                                                    onOpenDetails={assessment => setSelectedAssessment(assessment)}
                                                    showHidden={activeTab === 'hidden'}
                                                    nowTick={nowTick}
                                                    groupBy={groupBy}
                                                    mode={listViewMode}
                                                />
                                            );
                                        })()}
                                    </>
                                )}
                                {activeTab === 'calendar' && (
                                    <CalendarView dueData={dueData} hiddenIds={hiddenIds} onHide={hideAssessment} onUnhide={unhideAssessment} onOpenDetails={assessment => setSelectedAssessment(assessment)} nowTick={nowTick} />
                                )}
                                {activeTab === 'timetable' && (
                                    <TimetableView timetableEvents={timetableEvents} timetableLoading={timetableLoading} timetableError={timetableError} />
                                )}
                                {activeTab === 'settings' && (
                                    <div style={{ padding: '1rem' }}>
                                        <SettingsModal
                                            inline
                                            user={user}
                                            dashboardVersion={pageDashboardVersion}
                                            onClose={() => setActiveTab('list')}
                                            reminderHours={reminderHours}
                                            onReminderHoursChange={setReminderHours}
                                            notificationPermission={notificationPermission}
                                            onEnableNotifications={handleEnableNotifications}
                                            onSaved={updatedUser => {
                                                setUser(updatedUser);
                                                setSetupBanner('');
                                                if (updatedUser?.dashboardVersion && updatedUser.dashboardVersion !== pageDashboardVersion) {
                                                    router.replace(getDashboardRoute(updatedUser.dashboardVersion));
                                                    return;
                                                }
                                                setTimeout(() => { setActiveTab('list'); fetchDueAssessments(''); }, 800);
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>

                {/* Footer */}
                <footer className={styles.footer}>
                    <div className={styles.footerLinks}>
                        {quickLinks.map(link => (
                            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className={styles.footerLink}>{link.label}</a>
                        ))}
                    </div>
                    <p className={styles.footerCopy}>Final Reckoning · RajLogic</p>
                </footer>
            </div>
        </div>
    );
}

SiteLogo.propTypes = {
    size: PropTypes.number,
};