import React, { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';
import dashStyles from '../styles/DashboardV1.module.css';
import sidebarStyles from '../styles/FilterSidebar.module.css';
import Image from 'next/image';
import { normalizeCanvasBaseUrl } from '../lib/canvas-url.js';
import { getDashboardRoute } from '../lib/dashboard-route.js';

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

SiteLogo.propTypes = {
    size: PropTypes.number,
};

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

    if (days > 0) {
        return `${days}d ${hours}h left`;
    }

    if (hours > 0) {
        return `${hours}h ${minutes}m left`;
    }

    return `${minutes}m left`;
}

function getDaysLeftLabel(dueTimestamp) {
    const now = Date.now();
    const diff = dueTimestamp - now;
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysLeft = Math.ceil(diff / msPerDay);
    if (daysLeft < 0) {
        const overdueDays = Math.abs(daysLeft);
        return `${overdueDays} day${overdueDays === 1 ? '' : 's'} ago`;
    }

    if (diff > 0 && diff <= 48 * 60 * 60 * 1000) {
        return formatCountdown(diff);
    }

    if (daysLeft === 0) return 'Due today';
    return `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
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

function startOfLocalDay(value = new Date()) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function getAssessmentView(assessment, now = new Date()) {
    const dueDate = new Date(assessment.dueAt);
    if (startOfLocalDay(dueDate) >= startOfLocalDay(now)) return 'active';
    return dueDate.getFullYear() === now.getFullYear() ? 'passedYear' : 'pastClasses';
}

// ─── Hidden assessments storage ────────────────────────────────────────────
const HIDDEN_KEY = 'fr_hidden_assessments';
const REMINDER_HOURS_KEY = 'fr_reminder_hours';
const REMINDED_ITEMS_KEY = 'fr_reminded_items';

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

function loadReminderHours() {
    try {
        const raw = localStorage.getItem(REMINDER_HOURS_KEY);
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 168) {
            return parsed;
        }
    } catch {
        // Ignore storage issues.
    }
    return 36;
}

function saveReminderHours(value) {
    try {
        localStorage.setItem(REMINDER_HOURS_KEY, String(value));
    } catch {
        // Ignore storage issues.
    }
}

function loadRemindedMap() {
    try {
        const raw = localStorage.getItem(REMINDED_ITEMS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        if (parsed && typeof parsed === 'object') return parsed;
    } catch {
        // Ignore storage issues.
    }
    return {};
}

function saveRemindedMap(map) {
    try {
        localStorage.setItem(REMINDED_ITEMS_KEY, JSON.stringify(map));
    } catch {
        // Ignore storage issues.
    }
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

            if (filters.years?.length > 0) {
                assessments = assessments.filter(a =>
                    filters.years.includes(new Date(a.dueAt).getFullYear())
                );
            }

            if (filters.terms?.length > 0) {
                if (!filters.terms.includes(term.termName)) return { ...course, assessments: [] };
            }

            if (filters.courseIds?.length > 0) {
                if (!filters.courseIds.includes(course.courseId)) return { ...course, assessments: [] };
            }

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

    return filtered;
}

// ─── Shared sub-components ─────────────────────────────────────────────────

const UrgencyBadge = memo(function UrgencyBadge({ dueTimestamp, nowTick }) {
    const urgency = getUrgency(dueTimestamp);
    const label = getDaysLeftLabel(dueTimestamp);
    const isOverdue = dueTimestamp < nowTick;
    let icon;
    if (isOverdue) icon = '○';
    else if (urgency === 'urgent') icon = '🔴';
    else if (urgency === 'warning') icon = '🟡';
    else icon = '🟢';

    return (
        <span
            className={`${styles.badge} ${styles['badge_' + urgency]}`}
            style={isOverdue ? { background: 'var(--bg-subtle)', borderColor: 'var(--border)', color: 'var(--text-muted)' } : undefined}
        >
            {icon} {label}
        </span>
    );
});

UrgencyBadge.propTypes = {
    dueTimestamp: PropTypes.number.isRequired,
    nowTick: PropTypes.number.isRequired,
};

const AssessmentCard = memo(function AssessmentCard({ assessment, onHide, onUnhide, onOpenDetails, isHidden, nowTick }) {
    const { dueTimestamp } = assessment;
    const urgency = getUrgency(dueTimestamp);
    const isOverdue = dueTimestamp < nowTick;
    return (
        <li
            className={`${styles.assessmentItem} ${styles[isHidden ? 'item_safe' : 'item_' + urgency]} ${isHidden ? dashStyles.hiddenItem : ''}`}
            style={isOverdue ? { background: 'var(--bg-subtle)', borderColor: 'var(--border)', color: 'var(--text-muted)' } : undefined}
        >
            <div className={styles.assessmentLeft}>
                <div
                    className={styles.urgencyStripe}
                    data-urgency={isHidden || isOverdue ? 'safe' : urgency}
                    style={isOverdue ? { background: 'var(--text-muted)' } : undefined}
                />
                <div className={styles.assessmentContent}>
                    <button className={styles.assessmentNameBtn} onClick={() => onOpenDetails(assessment)}>
                        {assessment.name}
                    </button>
                    <div className={styles.assessmentMeta}>
                        <span className={styles.dueDate}>📅 {formatShortDate(assessment.dueAt)}</span>
                        {assessment.pointsPossible != null && (
                            <span className={styles.points}>⭐ {assessment.pointsPossible} pts</span>
                        )}
                        {assessment.score != null && (
                            <span className={styles.gradeBadge}>🏁 {assessment.score}{assessment.pointsPossible == null ? '' : `/${assessment.pointsPossible}`}</span>
                        )}
                        {/* Submitted tag intentionally removed for V1 */}
                        {isHidden && <span className={dashStyles.hiddenTag}>Hidden</span>}
                    </div>
                </div>
            </div>
            <div className={dashStyles.cardActions}>
                {!isHidden && <UrgencyBadge dueTimestamp={assessment.dueTimestamp} nowTick={nowTick} />}
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

AssessmentCard.propTypes = {
    assessment: PropTypes.object.isRequired,
    onHide: PropTypes.func.isRequired,
    onUnhide: PropTypes.func.isRequired,
    onOpenDetails: PropTypes.func.isRequired,
    isHidden: PropTypes.bool.isRequired,
    nowTick: PropTypes.number.isRequired,
};

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

UrgencyLegend.propTypes = {
    urgencyFilter: PropTypes.string.isRequired,
    setUrgencyFilter: PropTypes.func.isRequired,
};

const FilterSidebar = memo(function FilterSidebar({ dueData, filters, onFiltersChange, isOpen, onClose, onHideCourse }) {
    const allAssessments = dueData.terms.flatMap(t => t.courses.flatMap(c => c.assessments));

    const years = [...new Set(allAssessments.map(a => new Date(a.dueAt).getFullYear()))].sort((a, b) => b - a);
    const terms = [...new Set(dueData.terms.map(t => t.termName))].sort((a, b) => a.localeCompare(b));
    const courses = [...new Map(allAssessments.map(a => [a.courseId, { id: a.courseId, name: a.courseName }])).values()]
        .sort((a, b) => a.name.localeCompare(b.name));
    const courseCodes = [...new Set(
        courses.map(c => { const m = c.name.match(/^([A-Z]{2,6}\d{3,5}[A-Z]?)/); return m ? m[1] : null; }).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

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
            {isOpen && (
                <button
                    type="button"
                    className={sidebarStyles.backdrop}
                    onClick={onClose}
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') onClose(); }}
                    aria-label="Close filters"
                />
            )}
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
                                    <div key={c.id} className={sidebarStyles.courseRow}>
                                        <label className={sidebarStyles.courseFilterLabel}>
                                            <input type="checkbox" className={sidebarStyles.checkbox}
                                                checked={filters.courseIds?.includes(c.id) || false}
                                                onChange={() => toggle('courseIds', c.id)} />
                                            <span className={sidebarStyles.courseLabel}>{c.name}</span>
                                        </label>
                                        <button className={sidebarStyles.courseHideBtn} onClick={() => onHideCourse(c.id)}>
                                            Hide all
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </aside>
        </>
    );
});

FilterSidebar.propTypes = {
    dueData: PropTypes.shape({ terms: PropTypes.array }).isRequired,
    filters: PropTypes.object.isRequired,
    onFiltersChange: PropTypes.func.isRequired,
    isOpen: PropTypes.bool,
    onClose: PropTypes.func,
    onHideCourse: PropTypes.func,
};

// ─── LIST VIEW ─────────────────────────────────────────────────────────────

function shouldIncludeAssessmentInList(a, showHidden, assessmentView, urgencyFilter, nowDate) {
    if (showHidden) return true;
    if (getAssessmentView(a, nowDate) !== assessmentView) return false;
    if (assessmentView === 'active' && urgencyFilter !== 'all') {
        return getUrgency(a.dueTimestamp) === urgencyFilter;
    }
    return true;
}

function getListViewText(showHidden, assessmentView) {
    if (showHidden) {
        return {
            viewTitle: 'Hidden assessments',
            emptyTitle: 'No hidden assessments',
            emptySub: 'Assessments you hide will appear here. Click ✕ Hide on any item to hide it.',
            emptyIcon: '📭',
        };
    }

    if (assessmentView === 'active') {
        return {
            viewTitle: 'Active assessments',
            emptyTitle: 'You are all caught up',
            emptySub: 'No upcoming assessments right now. Enjoy the breather.',
            emptyIcon: '🎉',
        };
    }

    if (assessmentView === 'passedYear') {
        return {
            viewTitle: 'Passed assessments this year',
            emptyTitle: 'No passed assessments found this year',
            emptySub: 'Try adjusting the filters in the sidebar.',
            emptyIcon: '🗂️',
        };
    }

    return {
        viewTitle: 'Past classes',
        emptyTitle: 'No past classes found',
        emptySub: 'Try adjusting the filters in the sidebar.',
        emptyIcon: '🗂️',
    };
}

function getUrgencyFilterTag(urgencyFilter) {
    if (urgencyFilter === 'urgent') return '🔴 Due soon';
    if (urgencyFilter === 'warning') return '🟡 Coming up';
    return '🟢 Later';
}

function filterCourse(course, showHidden, assessmentView, urgencyFilter, nowDate) {
    const assessments = course.assessments.filter(a =>
        shouldIncludeAssessmentInList(a, showHidden, assessmentView, urgencyFilter, nowDate)
    );
    return { ...course, assessments };
}

function filterTermWithCourses(term, showHidden, assessmentView, urgencyFilter, nowDate) {
    // returns a term object with courses filtered to only include assessments
    const courses = term.courses
        .map(course => filterCourse(course, showHidden, assessmentView, urgencyFilter, nowDate))
        .filter(c => c.assessments.length > 0);

    return { ...term, courses };
}

const ListView = memo(function ListView({
    dueData, assessmentView, urgencyFilter, setUrgencyFilter, filters, hiddenIds, onHide, onUnhide, onOpenDetails, showHidden, nowTick
}) {
    const nowDate = useMemo(() => new Date(nowTick), [nowTick]);

    const filteredTerms = useMemo(() => {
        const base = applyFiltersAndSort(dueData, filters, hiddenIds, showHidden);
        return base
            .map(term => filterTermWithCourses(term, showHidden, assessmentView, urgencyFilter, nowDate))
            .filter(t => t.courses.length > 0);
    }, [assessmentView, dueData, filters, hiddenIds, urgencyFilter, showHidden, nowDate]);

    const allVisible = filteredTerms.flatMap(t => t.courses.flatMap(c => c.assessments));
    const allRaw = useMemo(() => {
        return applyFiltersAndSort(dueData, { ...filters, sortBy: 'dueDate', sortDir: 'asc' }, hiddenIds, showHidden)
            .flatMap(t => t.courses.flatMap(c => c.assessments))
            .filter(a => shouldIncludeAssessmentInList(a, showHidden, assessmentView, urgencyFilter, nowDate));
    }, [assessmentView, dueData, filters, hiddenIds, urgencyFilter, showHidden, nowDate]);

    const urgentCount = allRaw.filter(a => getUrgency(a.dueTimestamp) === 'urgent').length;
    const warningCount = allRaw.filter(a => getUrgency(a.dueTimestamp) === 'warning').length;
    const safeCount = allRaw.filter(a => getUrgency(a.dueTimestamp) === 'safe').length;
    const { viewTitle, emptyTitle, emptySub, emptyIcon } = getListViewText(showHidden, assessmentView);
    const showActiveStats = !showHidden && assessmentView === 'active' && allRaw.length > 0;
    const showUrgencyTag = !showHidden && assessmentView === 'active' && urgencyFilter !== 'all';
    let emptySubText = emptySub;
    if (showHidden && urgencyFilter === 'all') {
        emptySubText = 'Try a different urgency filter.';
    }

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
            {showActiveStats && (
                <>
                    <div className={styles.statsRow}>
                        <button
                            type="button"
                            className={`${styles.statCard} ${styles.statUrgent} ${urgencyFilter === 'urgent' ? styles.statCardActive : ''}`}
                            onClick={() => setUrgencyFilter('urgent')}
                            aria-pressed={urgencyFilter === 'urgent'}
                        >
                            <span className={styles.statNum}>{urgentCount}</span>
                            <span className={styles.statLabel}>🔴 Due soon</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.statCard} ${styles.statWarning} ${urgencyFilter === 'warning' ? styles.statCardActive : ''}`}
                            onClick={() => setUrgencyFilter('warning')}
                            aria-pressed={urgencyFilter === 'warning'}
                        >
                            <span className={styles.statNum}>{warningCount}</span>
                            <span className={styles.statLabel}>🟡 Coming up</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.statCard} ${styles.statSafe} ${urgencyFilter === 'safe' ? styles.statCardActive : ''}`}
                            onClick={() => setUrgencyFilter('safe')}
                            aria-pressed={urgencyFilter === 'safe'}
                        >
                            <span className={styles.statNum}>{safeCount}</span>
                            <span className={styles.statLabel}>🟢 Later</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.statCard} ${styles.statTotal} ${urgencyFilter === 'all' ? styles.statCardActive : ''}`}
                            onClick={() => setUrgencyFilter('all')}
                            aria-pressed={urgencyFilter === 'all'}
                        >
                            <span className={styles.statNum}>{allRaw.length}</span>
                            <span className={styles.statLabel}>📋 Total</span>
                        </button>
                    </div>
                    <UrgencyLegend urgencyFilter={urgencyFilter} setUrgencyFilter={setUrgencyFilter} />
                </>
            )}

            {showHidden && (
                <div className={dashStyles.hiddenBanner}>
                    <span>👁 Showing {hiddenIds.size} hidden assessment{hiddenIds.size === 1 ? '' : 's'}. Click ↩ Restore to bring them back.</span>
                </div>
            )}

            {filteredTerms.length === 0 ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>{emptyIcon}</div>
                    <p className={styles.emptyTitle}>{emptyTitle}</p>
                    <p className={styles.emptySub}>{emptySubText}</p>
                </div>
            ) : (
                <div className={styles.results}>
                    <div className={styles.resultsHeader}>
                        <h2 className={styles.resultsTitle}>
                            {allVisible.length} {viewTitle.toLowerCase()}
                            {showUrgencyTag && (
                                <span className={styles.filterTag}>
                                    {getUrgencyFilterTag(urgencyFilter)}
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
                                                    onOpenDetails={onOpenDetails}
                                                    nowTick={nowTick}
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

ListView.propTypes = {
    dueData: PropTypes.object.isRequired,
    assessmentView: PropTypes.string,
    urgencyFilter: PropTypes.string,
    setUrgencyFilter: PropTypes.func,
    filters: PropTypes.object,
    hiddenIds: PropTypes.instanceOf(Set),
    onHide: PropTypes.func,
    onUnhide: PropTypes.func,
    onOpenDetails: PropTypes.func,
    showHidden: PropTypes.bool,
    nowTick: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

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
    const normalised = normalizeCanvasBaseUrl(canvasBaseUrl).toLowerCase().replace(/\/$/, '');
    const match = UNIVERSITY_CONFIG.find(u => u.url.toLowerCase().replace(/\/$/, '') === normalised);
    if (match) return [...match.links, GITHUB_LINK];
    try {
        const parsed = new URL(normalised);
        return [{ label: 'Canvas', href: `${parsed.protocol}//${parsed.hostname}/` }, GITHUB_LINK];
    } catch {
        return DEFAULT_QUICK_LINKS;
    }
}

const CalendarView = memo(function CalendarView({ dueData, hiddenIds, onHide, onUnhide, onOpenDetails, nowTick }) {
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
        setSelectedDay(prev => prev?.key === key ? null : { key, day, assessments: assessmentsByDate[key] || [] });
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
                {(() => {
                    let emptyKeyCount = 0;
                    return cells.map((day) => {
                        if (!day) {
                            return <div key={`empty-${viewYear}-${viewMonth}-${emptyKeyCount++}`} className={styles.calEmptyCell} />;
                        }
                        const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isToday = key === todayStr;
                        const dayItems = assessmentsByDate[key] || [];
                        const isSelected = selectedDay?.key === key;
                        let dotUrgency = null;
                        if (dayItems.length > 0) {
                            if (dayItems.some(a => getUrgency(a.dueTimestamp) === 'urgent')) dotUrgency = 'urgent';
                            else if (dayItems.some(a => getUrgency(a.dueTimestamp) === 'warning')) dotUrgency = 'warning';
                            else dotUrgency = 'safe';
                        }
                        return (
                            <button key={key}
                                type="button"
                                className={[styles.calCell, isToday ? styles.calCellToday : '', isSelected ? styles.calCellSelected : '', dayItems.length > 0 ? styles.calCellHasItems : ''].filter(Boolean).join(' ')}
                                onClick={() => handleDayClick(day)}>
                                <span className={styles.calDayNum}>{day}</span>
                                <div className={styles.calPills}>
                                    {dayItems.slice(0, 2).map((a) => {
                                        const pillUrgency = getUrgency(a.dueTimestamp);
                                        return (
                                            <div key={a.id} className={styles.calPill + ' ' + styles['calPill_' + pillUrgency]}>
                                                {formatTime(a.dueAt)} {a.name}
                                            </div>
                                        );
                                    })}
                                    {dayItems.length > 2 && (<div className={styles.calPillMore}>+{dayItems.length - 2} more</div>)}
                                </div>
                                {dotUrgency && (() => { const dotClass = `dot_${dotUrgency}`; return <span className={`${styles.calDot} ${styles[dotClass]}`} />; })()}
                            </button>
                        );
                    });
                })()}
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
                                const urgClass = 'calDetailItem_' + urg;
                                return (
                                    <li key={a.id} className={`${styles.calDetailItem} ${styles[urgClass]}`}>
                                        <div className={styles.calDetailStripe} data-urgency={urg} />
                                        <div className={styles.calDetailContent}>
                                            <button className={styles.calDetailNameBtn} onClick={() => onOpenDetails(a)}>{a.name}</button>
                                            <div className={styles.calDetailMeta}>
                                                <span className={styles.calDetailCourse}>{a.courseName}</span>
                                                <span className={styles.calDetailTime}>🕐 {formatShortDate(a.dueAt)}</span>
                                                {a.pointsPossible != null && (<span className={styles.calDetailPts}>⭐ {a.pointsPossible} pts</span>)}
                                            </div>
                                        </div>
                                        <div className={dashStyles.cardActions}>
                                            <UrgencyBadge dueTimestamp={a.dueTimestamp} nowTick={nowTick} />
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

CalendarView.propTypes = {
    dueData: PropTypes.shape({
        terms: PropTypes.arrayOf(PropTypes.object),
    }).isRequired,
    hiddenIds: PropTypes.instanceOf(Set).isRequired,
    onHide: PropTypes.func,
    onUnhide: PropTypes.func,
    onOpenDetails: PropTypes.func,
    nowTick: PropTypes.number,
};

// ─── TIMETABLE GRID HELPERS ────────────────────────────────────────────────

const TT_START_HOUR = 7;   // 7 AM
const TT_END_HOUR = 22;    // 10 PM
const TT_SPAN = TT_END_HOUR - TT_START_HOUR;

function positionBlock(startStr, endStr) {
    const parseDecimalHour = (s) => {
        const d = new Date(s);
        return d.getHours() + d.getMinutes() / 60;
    };
    const s = parseDecimalHour(startStr);
    const e = parseDecimalHour(endStr);
    const clampedS = Math.max(TT_START_HOUR, Math.min(TT_END_HOUR, s));
    const clampedE = Math.max(TT_START_HOUR, Math.min(TT_END_HOUR, e));
    const left = ((clampedS - TT_START_HOUR) / TT_SPAN) * 100;
    const width = Math.max(0.5, ((clampedE - clampedS) / TT_SPAN) * 100);
    return { left: `${left}%`, width: `${width}%` };
}

function positionBlockVertical(startStr, endStr) {
    const parseDecimalHour = (s) => {
        const d = new Date(s);
        return d.getHours() + d.getMinutes() / 60;
    };
    const s = parseDecimalHour(startStr);
    const e = parseDecimalHour(endStr);
    const clampedS = Math.max(TT_START_HOUR, Math.min(TT_END_HOUR, s));
    const clampedE = Math.max(TT_START_HOUR, Math.min(TT_END_HOUR, e));
    const top = ((clampedS - TT_START_HOUR) / TT_SPAN) * 100;
    const height = Math.max(1, ((clampedE - clampedS) / TT_SPAN) * 100);
    return { top: `${top}%`, height: `${height}%` };
}

const TT_BLOCK_TONES = 8;

function toneIndexForSummary(summary) {
    const codeMatch = (summary || '').match(/[A-Z]{2,6}\d{3,5}[A-Z]?/);
    const key = codeMatch ? codeMatch[0] : (summary || 'Untitled Event').split(',')[0].trim().toLowerCase();
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

// ─── TIMETABLE VIEW (horizontal: time on x-axis, days on y-axis) ──────────

const TimetableView = memo(function TimetableView({ timetableEvents, timetableLoading, timetableError }) {
    const today = new Date();
    const [weekOffset, setWeekOffset] = useState(0);
    const [dayOffset, setDayOffset] = useState(() => {
        const day = new Date().getDay();
        return day === 0 ? 6 : day - 1;
    });
    const [ttViewMode, setTtViewMode] = useState('week');
    const [isVerticalTimetable, setIsVerticalTimetable] = useState(false);
    const [localNow, setLocalNow] = useState(() => new Date());
    const [selectedClass, setSelectedClass] = useState(null);
    const [use24Hour, setUse24Hour] = useState(true);

    useEffect(() => {
        try {
            const saved = localStorage.getItem('fr_tt_time_format');
            if (saved === '12') setUse24Hour(false);
            if (saved === '24') setUse24Hour(true);
        } catch {
            // Ignore storage issues
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('fr_tt_time_format', use24Hour ? '24' : '12');
        } catch {
            // Ignore storage issues
        }
    }, [use24Hour]);

    useEffect(() => {
        const timer = setInterval(() => setLocalNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (globalThis.window === undefined) return;
        const media = globalThis.matchMedia('(max-width: 900px), (orientation: portrait)');
        const updateMode = (event) => {
            const matches = event.matches;
            setIsVerticalTimetable(matches);
        };

        updateMode(media);
        media.addEventListener('change', updateMode);
        return () => media.removeEventListener('change', updateMode);
    }, []);

    // Compute Monday of the selected week
    const weekStart = useMemo(() => {
        const d = new Date(today);
        const day = d.getDay(); // 0=Sun
        const diffToMon = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diffToMon + weekOffset * 7);
        d.setHours(0, 0, 0, 0);
        return d;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekOffset]);

    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    }), [weekStart]);

    const toDateKey = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const todayKey = toDateKey(today);

    // Group timetable events by date key
    const eventsByDate = useMemo(() => {
        const map = {};
        timetableEvents.forEach((ev) => {
            const key = toDateKey(new Date(ev.start));
            if (!map[key]) map[key] = [];
            map[key].push(ev);
        });
        return map;
    }, [timetableEvents]);

    const hours = Array.from({ length: TT_SPAN }, (_, i) => TT_START_HOUR + i);

    const weekLabel = (() => {
        const opts = { day: 'numeric', month: 'short' };
        const s = weekDays[0].toLocaleDateString('en-AU', opts);
        const e = weekDays[6].toLocaleDateString('en-AU', { ...opts, year: 'numeric' });
        return `${s} – ${e}${weekOffset === 0 ? ' (current week)' : ''}`;
    })();

    const formatLocalTime = (value) => new Date(value).toLocaleTimeString('en-AU', {
        hour: '2-digit', minute: '2-digit', hour12: !use24Hour,
    });

    const localNowLabel = localNow.toLocaleTimeString('en-AU', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !use24Hour,
    });

    const nowDecimalHour = localNow.getHours() + (localNow.getMinutes() / 60) + (localNow.getSeconds() / 3600);
    const isNowInTimetableRange = nowDecimalHour >= TT_START_HOUR && nowDecimalHour <= TT_END_HOUR;
    const nowMarkerPercent = ((Math.max(TT_START_HOUR, Math.min(TT_END_HOUR, nowDecimalHour)) - TT_START_HOUR) / TT_SPAN) * 100;

    const selectedDay = weekDays[Math.max(0, Math.min(6, dayOffset))] || weekDays[0];
    const selectedDayKey = toDateKey(selectedDay);
    const isSelectedDayToday = selectedDayKey === todayKey;
    const selectedDayEvents = [...(eventsByDate[selectedDayKey] || [])].sort((a, b) => new Date(a.start) - new Date(b.start));
    const selectedDayLabel = selectedDay.toLocaleDateString('en-AU', {
        weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
    });

    const formatLocalDateTime = (value) => new Date(value).toLocaleString('en-AU', {
        weekday: 'short', day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: !use24Hour,
    });

    return (
        <div className={styles.timetableWrap}>
            <div className={styles.ttControls}>
                <span className={styles.ttLocalTime}>
                    <span className={styles.ttLocalTimeValue}>{localNowLabel}</span>
                </span>
                <button
                    type="button"
                    className={styles.ttTimeFormatBtn}
                    onClick={() => setUse24Hour(v => !v)}
                    aria-label={`Switch to ${use24Hour ? '12-hour' : '24-hour'} time`}
                >
                    {use24Hour ? '24h' : '12h'}
                </button>
            </div>

            {timetableError && (
                <div className={styles.errorBanner}><span>⚠️ {timetableError}</span></div>
            )}

            {timetableLoading && (
                <div className={styles.loadingWrap}>
                    <span className={styles.spinnerLarge} />
                    <p className={styles.loadingText}>Syncing timetable…</p>
                </div>
            )}

            {!timetableLoading && timetableEvents.length === 0 && !timetableError && (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📚</div>
                    <p className={styles.emptyTitle}>No timetable events found</p>
                    <p className={styles.emptySub}>No timetable events are available for this account.</p>
                </div>
            )}

            {!timetableLoading && timetableEvents.length > 0 && (
                <div className={styles.ttOuter}>
                    {/* Week navigator */}
                    <div className={styles.ttWeekNav}>
                        <button className={styles.ttNavBtn} onClick={() => setWeekOffset(o => o - 1)} aria-label="Previous week">‹</button>
                        <span className={styles.ttWeekLabel}>{weekLabel}</span>
                        <button className={styles.ttNavBtn} onClick={() => setWeekOffset(o => o + 1)} aria-label="Next week">›</button>
                        {weekOffset !== 0 && (
                            <button className={styles.ttTodayBtn} onClick={() => setWeekOffset(0)}>Today</button>
                        )}
                    </div>

                    <div className={styles.ttViewSwitch}>
                        <button
                            className={`${styles.ttViewBtn} ${ttViewMode === 'week' ? styles.ttViewBtnActive : ''}`}
                            onClick={() => setTtViewMode('week')}
                        >
                            Week view
                        </button>
                        <button
                            className={`${styles.ttViewBtn} ${ttViewMode === 'day' ? styles.ttViewBtnActive : ''}`}
                            onClick={() => setTtViewMode('day')}
                        >
                            Day activities
                        </button>
                    </div>

                    {ttViewMode === 'week' ? (
                        <>
                            {/* Horizontally scrollable grid */}
                            <div className={styles.ttScrollArea}>
                                <div className={styles.ttGrid}>

                                    {/* ── Top-left corner ── */}
                                    <div className={styles.ttCorner} />

                                    {/* ── Hour headers ── */}
                                    <div className={styles.ttHourRow}>
                                        {hours.map((h) => (
                                            <div key={h} className={styles.ttHourCell}>
                                                {formatHourLabel(h, use24Hour)}
                                            </div>
                                        ))}
                                    </div>

                                    {/* ── Day rows ── */}
                                    {weekDays.map((day) => {
                                        const key = toDateKey(day);
                                        const isToday = key === todayKey;
                                        const dayEvents = eventsByDate[key] || [];

                                        return (
                                            <React.Fragment key={key}>
                                                {/* Day label cell */}
                                                <div className={`${styles.ttDayLabel} ${isToday ? styles.ttDayLabelToday : ''}`}>
                                                    <span className={styles.ttDayName}>
                                                        {day.toLocaleDateString('en-AU', { weekday: 'short' })}
                                                    </span>
                                                    <span className={styles.ttDayDate}>
                                                        {day.toLocaleDateString('en-AU', { day: 'numeric', month: 'numeric' })}
                                                    </span>
                                                </div>

                                                {/* Timeline cell */}
                                                <div className={`${styles.ttTimeline} ${isToday ? styles.ttTimelineToday : ''}`}>
                                                    {/* Hour divider lines */}
                                                    {hours.map((h) => (
                                                        <div
                                                            key={h}
                                                            className={styles.ttHourDivider}
                                                            style={{
                                                                left: `${((h - TT_START_HOUR) / TT_SPAN) * 100}%`,
                                                                width: `${(1 / TT_SPAN) * 100}%`,
                                                            }}
                                                        />
                                                    ))}

                                                    {isToday && isNowInTimetableRange && (
                                                        <div className={styles.ttNowMarker} style={{ left: `${nowMarkerPercent}%` }} aria-hidden="true" />
                                                    )}

                                                    {/* Event blocks */}
                                                    {dayEvents.map((ev, idx) => {
                                                        const pos = positionBlock(ev.start, ev.end);
                                                        const classKey = ev.className || (ev.summary || '').split(',')[0] || ev.summary;
                                                        const toneIndex = toneIndexForSummary(classKey);
                                                        const startFmt = formatLocalTime(ev.start);
                                                        const endFmt = formatLocalTime(ev.end);
                                                        const eventKey = key + '-' + (ev.uid || (ev.start + '-' + ev.end + '-' + idx));
                                                        const isSelected = selectedClass?.uid ? selectedClass.uid === ev.uid : selectedClass?.eventKey === eventKey;
                                                        const blockClassName = styles.ttBlock + ' ' + styles[`ttBlockTone${toneIndex}`] + (isSelected ? ' ' + styles.ttBlockActive : '');
                                                        const blockTitle = ev.summary + '\n' + startFmt + '–' + endFmt + (ev.location ? '\n' + ev.location : '');
                                                        return (
                                                            <button
                                                                key={eventKey}
                                                                type="button"
                                                                className={blockClassName}
                                                                style={{ left: pos.left, width: pos.width }}
                                                                title={blockTitle}
                                                                onClick={() => setSelectedClass({ ...ev, toneIndex, eventKey })}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                                        e.preventDefault();
                                                                        setSelectedClass({ ...ev, toneIndex, eventKey });
                                                                    }
                                                                }}
                                                            >
                                                                <span className={styles.ttBlockName}>{ev.summary}</span>
                                                                {ev.location && (
                                                                    <span className={styles.ttBlockLoc}>{ev.location}</span>
                                                                )}
                                                                <span className={styles.ttBlockTime}>{startFmt} – {endFmt}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className={styles.ttDayViewWrap}>
                            <div className={styles.ttDayNav}>
                                <button
                                    className={styles.ttNavBtn}
                                    onClick={() => setDayOffset((d) => Math.max(0, d - 1))}
                                    disabled={dayOffset === 0}
                                    aria-label="Previous day"
                                >
                                    ‹
                                </button>
                                <span className={styles.ttDayLabelLarge}>{selectedDayLabel}</span>
                                <button
                                    className={styles.ttNavBtn}
                                    onClick={() => setDayOffset((d) => Math.min(6, d + 1))}
                                    disabled={dayOffset === 6}
                                    aria-label="Next day"
                                >
                                    ›
                                </button>
                            </div>

                            {isVerticalTimetable ? (
                                <div className={styles.ttDayTimelineShell}>
                                    <div className={styles.ttHourRow}>
                                        {hours.map((h) => (
                                            <div key={`day-${h}`} className={styles.ttHourCell}>
                                                {formatHourLabel(h, use24Hour)}
                                            </div>
                                        ))}
                                    </div>
                                    <div className={styles.ttDayTimelineTrack}>
                                        {hours.map((h) => (
                                            <div
                                                key={`day-divider-${h}`}
                                                className={styles.ttHourDivider}
                                                style={{
                                                    left: `${((h - TT_START_HOUR) / TT_SPAN) * 100}%`,
                                                    width: `${(1 / TT_SPAN) * 100}%`,
                                                }}
                                            />
                                        ))}

                                        {isSelectedDayToday && isNowInTimetableRange && (
                                            <div className={styles.ttNowMarker} style={{ left: `${nowMarkerPercent}%` }} aria-hidden="true" />
                                        )}

                                        {selectedDayEvents.map((ev, idx) => {
                                            const pos = positionBlock(ev.start, ev.end);
                                            const classKey = ev.className || (ev.summary || '').split(',')[0] || ev.summary;
                                            const toneIndex = toneIndexForSummary(classKey);
                                            const startFmt = formatLocalTime(ev.start);
                                            const endFmt = formatLocalTime(ev.end);
                                            const eventKey = `${selectedDayKey}-${idx}`;
                                            const isSelected = selectedClass?.uid ? selectedClass.uid === ev.uid : selectedClass?.eventKey === eventKey;

                                            const titleText = `${ev.summary}\n${startFmt}–${endFmt}${ev.location ? '\n' + ev.location : ''}`;
                                            const toneClass = styles['ttBlockTone' + toneIndex];
                                            return (
                                                <button
                                                    key={eventKey}
                                                    className={`${styles.ttBlock} ${styles.ttDayBlock} ${toneClass} ${isSelected ? styles.ttBlockActive : ''}`}
                                                    style={{ left: pos.left, width: pos.width }}
                                                    title={titleText}
                                                    onClick={() => setSelectedClass({ ...ev, toneIndex, eventKey })}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            setSelectedClass({ ...ev, toneIndex, eventKey });
                                                        }
                                                    }}
                                                >
                                                    <span className={styles.ttBlockName}>{ev.summary}</span>
                                                    <span className={styles.ttBlockTime}>{startFmt} – {endFmt}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.ttDayVerticalShell}>
                                    <div className={styles.ttDayVerticalTrack}>
                                        {hours.map((h) => (
                                            <div
                                                key={`vertical-divider-${h}`}
                                                className={styles.ttDayVerticalDivider}
                                                style={{ top: `${((h - TT_START_HOUR) / TT_SPAN) * 100}%` }}
                                            >
                                                <span className={styles.ttDayVerticalHour}>{formatHourLabel(h, use24Hour)}</span>
                                            </div>
                                        ))}

                                        {isSelectedDayToday && isNowInTimetableRange && (
                                            <div className={`${styles.ttNowMarker} ${styles.ttNowMarkerVertical}`} style={{ top: `${nowMarkerPercent}%` }} aria-hidden="true" />
                                        )}

                                        {selectedDayEvents.map((ev, idx) => {
                                            const pos = positionBlockVertical(ev.start, ev.end);
                                            const classKey = ev.className || (ev.summary || '').split(',')[0] || ev.summary;
                                            const toneIndex = toneIndexForSummary(classKey);
                                            const toneClass = styles[`ttBlockTone${toneIndex}`];
                                            const eventKey = `${selectedDayKey}-${idx}`;
                                            const isSelected = selectedClass?.uid ? selectedClass.uid === ev.uid : selectedClass?.eventKey === eventKey;

                                            return (
                                                <button
                                                    key={`vertical-${eventKey}`}
                                                    type="button"
                                                    className={`${styles.ttBlock} ${styles.ttDayVerticalBlock} ${toneClass} ${isSelected ? styles.ttBlockActive : ''}`}
                                                    style={{ top: pos.top, height: pos.height }}
                                                    onClick={() => setSelectedClass({ ...ev, toneIndex, eventKey })}
                                                >
                                                    <span className={styles.ttBlockName}>{ev.summary}</span>
                                                    <span className={styles.ttBlockTime}>{formatLocalTime(ev.start)} - {formatLocalTime(ev.end)}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {selectedDayEvents.length === 0 ? (
                                <div className={styles.eventEmptyState}>No activities for this day.</div>
                            ) : (
                                <ul className={styles.ttDayActivitiesList}>
                                    {selectedDayEvents.map((ev, idx) => {
                                        const classKey = ev.className || (ev.summary || '').split(',')[0] || ev.summary;
                                        const toneIndex = toneIndexForSummary(classKey);
                                        const eventKey = `${selectedDayKey}-${idx}`;
                                        const isSelected = selectedClass?.uid ? selectedClass.uid === ev.uid : selectedClass?.eventKey === eventKey;
                                        return (
                                            <li key={`activity-${eventKey}`} className={styles.ttActivityItem}>
                                                <button
                                                    className={`${styles.ttActivityBtn} ${isSelected ? styles.ttActivityBtnActive : ''}`}
                                                    onClick={() => setSelectedClass({ ...ev, toneIndex, eventKey })}
                                                >
                                                    <span className={styles.ttActivityTime}>{formatLocalTime(ev.start)} - {formatLocalTime(ev.end)}</span>
                                                    <span className={styles.ttActivityName}>{ev.summary}</span>
                                                    {ev.location && <span className={styles.ttActivityLocation}>{ev.location}</span>}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    )}

                    <div className={styles.eventsListWrapper}>
                        {selectedClass ? (
                            <div className={styles.eventCard}>
                                <div className={`${styles.ttDetailStripe} ${styles['ttBlockTone' + selectedClass.toneIndex]}`} />
                                <div className={styles.eventDetailsSection} style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <span className={styles.eventName}>{selectedClass.className || selectedClass.summary}</span>
                                        <button
                                            className={styles.calDetailClose}
                                            onClick={() => setSelectedClass(null)}
                                            aria-label="Close"
                                        >✕</button>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.625rem 1.5rem' }}>
                                        <div>
                                            <div className={styles.ttDetailLabel}>Start</div>
                                            <div className={styles.ttDetailValue}>{formatLocalDateTime(selectedClass.start)}</div>
                                        </div>
                                        <div>
                                            <div className={styles.ttDetailLabel}>End</div>
                                            <div className={styles.ttDetailValue}>{formatLocalDateTime(selectedClass.end)}</div>
                                        </div>

                                        {selectedClass.location && (
                                            <div style={{ gridColumn: '1 / -1' }}>
                                                <div className={styles.ttDetailLabel}>Location</div>
                                                <div className={styles.ttDetailValue}>{selectedClass.location}</div>
                                            </div>
                                        )}

                                        {selectedClass.summary && selectedClass.summary !== selectedClass.className && (
                                            <div style={{ gridColumn: '1 / -1' }}>
                                                <div className={styles.ttDetailLabel}>Full title</div>
                                                <div className={styles.ttDetailValue}>{selectedClass.summary}</div>
                                            </div>
                                        )}

                                        {selectedClass.description && (
                                            <div style={{ gridColumn: '1 / -1' }}>
                                                <div className={styles.ttDetailLabel}>Description</div>
                                                <div className={styles.ttDetailValue} style={{ whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>
                                                    {selectedClass.description}
                                                </div>
                                            </div>
                                        )}

                                        {selectedClass.uid && (
                                            <div style={{ gridColumn: '1 / -1' }}>
                                                <div className={styles.ttDetailLabel}>UID</div>
                                                <div className={styles.ttDetailValue} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.68rem', wordBreak: 'break-all', color: 'var(--text-muted)' }}>
                                                    {selectedClass.uid}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.eventEmptyState}>Click a class block to view details.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

TimetableView.propTypes = {
    timetableEvents: PropTypes.arrayOf(PropTypes.object).isRequired,
    timetableLoading: PropTypes.bool,
    timetableError: PropTypes.string,
};

// ─── SETTINGS MODAL ────────────────────────────────────────────────────────

const UNIVERSITIES = [
    ...UNIVERSITY_CONFIG,
    { label: 'Custom / Other university', url: '' },
];

function SettingsModal({
    user,
    dashboardVersion,
    onClose,
    onSaved,
    reminderHours,
    onReminderHoursChange,
    notificationPermission,
    onEnableNotifications,
    inline = false,
}) {
    const defaultEnvUrl = 'https://rmit.instructure.com/api/v1/';
    const savedUrl = user?.canvasBaseUrl || defaultEnvUrl;
    const matchedPreset = UNIVERSITIES.find(u => u.url && u.url.toLowerCase() === savedUrl.toLowerCase());
    const initialPreset = matchedPreset ? matchedPreset.url : '';

    const [form, setForm] = useState({ canvasApiToken: '', timetableLink: '', canvasBaseUrl: '', dashboardVersion: dashboardVersion || 'v1' });
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
            setSuccess('Settings saved! All sensitive data is encrypted with AES-256-GCM.');
            onSaved?.(data.user);
        } catch { setError('Network error. Please try again.'); }
        finally { setSaving(false); }
    };

    const currentDisplayUrl = user?.canvasBaseUrl || defaultEnvUrl;
    const handleExportCalendar = () => {
        globalThis.location.href = '/api/assessments/export.ics';
    };

    const content = (
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
                    <span>API token and timetable link are encrypted with <strong>AES-256-GCM</strong> before being stored.</span>
                </div>
                {error && <div className={dashStyles.settingsError}><span>⚠️</span> {error}</div>}
                {success && <div className={dashStyles.settingsSuccess}><span>✅</span> {success}</div>}
                <form onSubmit={handleSave} className={dashStyles.settingsForm}>
                    <div className={dashStyles.settingsField}>
                        <label htmlFor="uniPreset" className={dashStyles.settingsLabel}>
                            University / Canvas Instance{' '}
                            <span className={dashStyles.settingsLabelHint}>Current: <code className={dashStyles.urlCode}>{currentDisplayUrl}</code></span>
                        </label>
                        <select id="uniPreset" value={uniPreset} onChange={handleUniSelect} className={dashStyles.settingsSelect}>
                            <option value="" disabled>Select your university…</option>
                            {UNIVERSITIES.map((u) => (<option key={u.label} value={u.url}>{u.label}</option>))}
                        </select>
                    </div>
                    <div className={dashStyles.settingsField}>
                        <label htmlFor="dashboardVersion" className={dashStyles.settingsLabel}>
                            Dashboard version{' '}
                            <span className={dashStyles.settingsLabelHint}>Switch between the default dashboard and old dashboard</span>
                        </label>
                        <select
                            id="dashboardVersion"
                            value={form.dashboardVersion}
                            onChange={e => setForm(f => ({ ...f, dashboardVersion: e.target.value }))}
                            className={dashStyles.settingsSelect}
                        >
                            <option value="base">Default dashboard</option>
                            <option value="v1">Old dashboard</option>
                        </select>
                    </div>
                    {showCustomUrl && (
                        <div className={dashStyles.settingsField}>
                            <label htmlFor="canvasBaseUrl" className={dashStyles.settingsLabel}>Canvas API Base URL</label>
                            <input id="canvasBaseUrl" name="canvasBaseUrl" type="url" value={form.canvasBaseUrl} onChange={handleChange}
                                className={dashStyles.settingsInput} placeholder="https://your-university.instructure.com/api/v1/" autoComplete="off" />
                        </div>
                    )}
                    <div className={dashStyles.settingsDivider} />
                    <div className={dashStyles.settingsField}>
                        <label htmlFor="canvasApiToken" className={dashStyles.settingsLabel}>
                            Canvas API Token{' '}
                            <span className={dashStyles.settingsLabelHint}>Canvas → Account → Settings → New Access Token</span>
                        </label>
                        <div className={dashStyles.inputWithBadge}>
                            <input id="canvasApiToken" name="canvasApiToken" type="password" value={form.canvasApiToken} onChange={handleChange}
                                className={dashStyles.settingsInput}
                                placeholder={user?.hasCanvasToken ? '••••••••••••••• (saved — paste new to update)' : 'Paste your Canvas API token here'}
                                autoComplete="off" />
                            {user?.hasCanvasToken && <span className={dashStyles.savedBadge}>🔐 Encrypted &amp; saved</span>}
                        </div>
                    </div>
                    <div className={dashStyles.settingsField}>
                        <label htmlFor="timetableLink" className={dashStyles.settingsLabel}>
                            Timetable iCal Link{' '}
                            <span className={dashStyles.settingsLabelHint}>Optional</span>
                        </label>
                        <div className={dashStyles.inputWithBadge}>
                            <input id="timetableLink" name="timetableLink" type="url" value={form.timetableLink} onChange={handleChange}
                                className={dashStyles.settingsInput}
                                placeholder={user?.hasTimetableLink ? 'https://... (saved — paste to update)' : 'https://your-timetable.ics'} />
                            {user?.hasTimetableLink && <span className={dashStyles.savedBadge}>🔐 Encrypted &amp; saved</span>}
                        </div>
                    </div>

                    <div className={dashStyles.settingsDivider} />

                    <div className={dashStyles.settingsField}>
                        <label htmlFor="reminderHours" className={dashStyles.settingsLabel}>
                            Browser reminder threshold (hours){' '}
                            <span className={dashStyles.settingsLabelHint}>Local setting on this device</span>
                        </label>
                        <input
                            id="reminderHours"
                            type="number"
                            min="1"
                            max="168"
                            value={reminderHours}
                            onChange={(e) => onReminderHoursChange(Math.min(168, Math.max(1, Number(e.target.value) || 1)))}
                            className={dashStyles.settingsInput}
                        />
                    </div>

                    <div className={dashStyles.settingsField}>
                        <label className={dashStyles.settingsLabel}>
                            Browser notifications{' '}
                            <span className={dashStyles.settingsLabelHint}>Current: {notificationPermission}</span>
                        </label>
                        <button
                            type="button"
                            className={dashStyles.settingsSave}
                            onClick={onEnableNotifications}
                            disabled={notificationPermission === 'granted'}
                        >
                            {notificationPermission === 'granted' ? 'Notifications enabled' : 'Enable browser notifications'}
                        </button>
                    </div>

                    <div className={dashStyles.settingsField}>
                        <label className={dashStyles.settingsLabel}>
                            Calendar export{' '}
                            <span className={dashStyles.settingsLabelHint}>Download upcoming assessments as .ics</span>
                        </label>
                        <button
                            type="button"
                            className={dashStyles.settingsSave}
                            onClick={handleExportCalendar}
                        >
                            Export assessments (.ics)
                        </button>
                    </div>

                    <button type="submit" className={dashStyles.settingsSave} disabled={saving}>
                        {saving ? '🔐 Encrypting & saving…' : 'Save settings'}
                    </button>
                </form>
            </div>
        </div>
    );

    if (inline) return content;

    return (
        <div className={dashStyles.modalOverlay}>
            <button
                type="button"
                className={dashStyles.modalBackdrop}
                onClick={onClose}
                aria-label="Close settings"
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
};
SettingsModal.propTypes.inline = PropTypes.bool;

function HelpModal({ onClose }) {
    const shortcuts = [
        { key: 'S', action: 'Focus search' },
        { key: 'C', action: 'Open calendar tab' },
        { key: 'T', action: 'Open timetable tab' },
        { key: '?', action: 'Open this help modal' },
    ];

    return (
        <dialog
            className={dashStyles.modalOverlay}
            aria-modal="true"
        >
            <div className={dashStyles.modal}>
                <div className={dashStyles.modalHeader}>
                    <h2 className={dashStyles.modalTitle}>⌨️ Keyboard shortcuts</h2>
                    <button className={dashStyles.modalClose} onClick={onClose}>✕</button>
                </div>
                <div className={dashStyles.modalBody}>
                    <div className={dashStyles.shortcutList}>
                        {shortcuts.map((shortcut) => (
                            <div key={shortcut.key} className={dashStyles.shortcutRow}>
                                <kbd className={dashStyles.shortcutKey}>{shortcut.key}</kbd>
                                <span className={dashStyles.shortcutAction}>{shortcut.action}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </dialog>
    );
}

HelpModal.propTypes = {
    onClose: PropTypes.func.isRequired,
};

function AssessmentDetailModal({ assessment, onClose }) {
    if (!assessment) return null;

    const plainDescription = (assessment.description || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return (
        <div className={dashStyles.modalOverlay}>
            <button
                type="button"
                className={dashStyles.modalBackdrop}
                onClick={onClose}
                aria-label="Close assessment details"
            />
            <div className={dashStyles.modal}>
                <div className={dashStyles.modalHeader}>
                    <h2 className={dashStyles.modalTitle}>📘 {assessment.name}</h2>
                    <button className={dashStyles.modalClose} onClick={onClose}>✕</button>
                </div>
                <div className={dashStyles.modalBody}>
                    <div className={dashStyles.detailMetaGrid}>
                        <span className={dashStyles.detailMetaItem}>📚 {assessment.courseName}</span>
                        <span className={dashStyles.detailMetaItem}>📅 {formatShortDate(assessment.dueAt)}</span>
                        {assessment.pointsPossible !== null && assessment.pointsPossible !== undefined && <span className={dashStyles.detailMetaItem}>⭐ {assessment.pointsPossible} pts</span>}
                        {assessment.score !== null && assessment.score !== undefined && <span className={dashStyles.detailMetaItem}>🏁 Score: {assessment.score}{(assessment.pointsPossible !== null && assessment.pointsPossible !== undefined) ? `/${assessment.pointsPossible}` : ''}</span>}
                        {assessment.grade && <span className={dashStyles.detailMetaItem}>🧾 Grade: {assessment.grade}</span>}
                        {/* Submitted tag intentionally removed for V1 */}
                        {Array.isArray(assessment.submissionTypes) && assessment.submissionTypes.length > 0 && (
                            <span className={dashStyles.detailMetaItem}>📤 {assessment.submissionTypes.join(', ')}</span>
                        )}
                    </div>

                    <div className={dashStyles.detailDescription}>
                        {plainDescription || 'No description available for this assessment.'}
                    </div>

                    <div className={dashStyles.detailActions}>
                        <a className={dashStyles.settingsSave} href={assessment.htmlUrl} target="_blank" rel="noopener noreferrer">Open in Canvas</a>
                    </div>
                </div>
            </div>
        </div>
    );
}

AssessmentDetailModal.propTypes = {
    assessment: PropTypes.object,
    onClose: PropTypes.func.isRequired,
};

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
    const [activeTab, setActiveTab] = useState('active');
    const [timetableEvents, setTimetableEvents] = useState([]);
    const [timetableLoading, setTimetableLoading] = useState(false);
    const [timetableError, setTimetableError] = useState('');

    const [setupBanner, setSetupBanner] = useState('');
    const [nowTick, setNowTick] = useState(() => Date.now());
    const [reminderHours, setReminderHours] = useState(36);
    const [notificationPermission, setNotificationPermission] = useState('default');
    const [remindedMap, setRemindedMap] = useState({});
    const [showHelp, setShowHelp] = useState(false);
    const [selectedAssessment, setSelectedAssessment] = useState(null);
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);

    const searchInputRef = useRef(null);
    const pageDashboardVersion = 'v1';

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [filters, setFilters] = useState({
        years: [], terms: [], courseIds: [], courseCodes: [],
        sortBy: 'dueDate', sortDir: 'asc'
    });

    const [hiddenIds, setHiddenIds] = useState(new Set());

    useEffect(() => {
        setHiddenIds(loadHidden());
        setReminderHours(loadReminderHours());
        setRemindedMap(loadRemindedMap());
        if (globalThis.window !== undefined && 'Notification' in globalThis) {
            setNotificationPermission(Notification.permission);
        }
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setNowTick(Date.now());
        }, 30 * 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        saveReminderHours(reminderHours);
    }, [reminderHours]);

    useEffect(() => {
        saveRemindedMap(remindedMap);
    }, [remindedMap]);

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

    const addCourseAssessmentIds = useCallback((course, next) => {
        if (!course || String(course.courseId) === '' || !Array.isArray(course.assessments)) return;
        for (const assessment of course.assessments) {
            if (assessment?.id != null) next.add(String(assessment.id));
        }
    }, []);

    const hideCourseAssessments = useCallback((courseId) => {
        setHiddenIds((prev) => {
            const next = new Set(prev);
            if (!dueData || !Array.isArray(dueData.terms)) return next;

            for (const term of dueData.terms) {
                if (!term || !Array.isArray(term.courses)) continue;
                for (const course of term.courses) {
                    if (!course || String(course.courseId) !== String(courseId)) continue;
                    addCourseAssessmentIds(course, next);
                }
            }
            saveHidden(next);
            return next;
        });
    }, [dueData, addCourseAssessmentIds]);

    useEffect(() => {
        fetch('/api/auth/session')
            .then((r) => r.json())
            .then((data) => {
                if (data.authenticated) {
                    setUser(data.user);
                    setAuthChecked(true);
                    if (data.user?.dashboardVersion && data.user.dashboardVersion !== pageDashboardVersion) {
                        router.replace(getDashboardRoute(data.user.dashboardVersion));
                        return;
                    }
                    if (router.query.welcome === '1') {
                        setSetupBanner('Welcome! Add your Canvas API token in Settings to get started.');
                    }
                }
                else { router.replace('/login'); }
            })
            .catch(() => router.replace('/login'));
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
                if (data.requiresSetup) {
                    setSetupBanner('No Canvas API token configured. Open Settings to add your token.');
                    return;
                }
                throw new Error(`Error ${response.status}: Failed to fetch`);
            }
            const data = await response.json();
            setSetupBanner('');
            setDueData(data);
            setLastUpdated(new Date());
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (!authChecked) return;
        const debounce = setTimeout(() => {
            fetchDueAssessments(searchText.trim());
        }, 320);
        return () => clearTimeout(debounce);
    }, [authChecked, searchText, fetchDueAssessments]);

    const handleClearFilter = () => { setSearchText(''); };

    const fetchTimetableData = useCallback(async () => {
        setTimetableLoading(true); setTimetableError('');
        try {
            const response = await fetch('/api/timetable');
            if (!response.ok) throw new Error(`Error ${response.status}: Failed to fetch timetable`);
            const data = await response.json();
            const sortedEvents = data.events
                .sort((a, b) => new Date(a.start) - new Date(b.start));
            setTimetableEvents(sortedEvents);
        } catch (err) { setTimetableError(err.message || 'Failed to sync timetable'); setTimetableEvents([]); }
        finally { setTimetableLoading(false); }
    }, []);

    useEffect(() => { if (activeTab === 'timetable' && authChecked) fetchTimetableData(); }, [activeTab, authChecked, fetchTimetableData]);

    useEffect(() => {
        if (globalThis.window === undefined || !('Notification' in globalThis) || notificationPermission !== 'granted') {
            return;
        }

        const allAssessments = dueData.terms.flatMap((term) =>
            term.courses.flatMap((course) => course.assessments)
        );

        if (allAssessments.length === 0) return;

        const now = Date.now();
        const thresholdMs = reminderHours * 60 * 60 * 1000;
        const nextMap = { ...remindedMap };
        let changed = false;

        allAssessments.forEach((assessment) => {
            const key = `${assessment.courseId}:${assessment.id}:${assessment.dueAt}`;
            const diff = assessment.dueTimestamp - now;

            if (diff > 0 && diff <= thresholdMs && !nextMap[key]) {
                const dueLabel = new Date(assessment.dueAt).toLocaleString('en-AU', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                });

                new Notification('Assessment due soon', {
                    body: `${assessment.name} (${assessment.courseName}) due ${dueLabel}`,
                    tag: key,
                });

                nextMap[key] = true;
                changed = true;
            }
        });

        if (changed) {
            setRemindedMap(nextMap);
        }
    }, [dueData, reminderHours, notificationPermission, remindedMap, nowTick]);

    const handleEnableNotifications = useCallback(async () => {
        if (globalThis.window === undefined || !('Notification' in globalThis)) return;
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
    }, []);

    useEffect(() => {
        const onKeyDown = (event) => {
            const targetTag = event.target?.tagName || '';
            const isTyping = targetTag === 'INPUT' || targetTag === 'TEXTAREA' || event.target?.isContentEditable;
            if (isTyping && event.key !== '?') return;

            if (event.key === 's' || event.key === 'S') {
                event.preventDefault();
                searchInputRef.current?.focus();
                return;
            }

            if (event.key === 'c' || event.key === 'C') {
                event.preventDefault();
                setActiveTab('calendar');
                return;
            }

            if (event.key === 't' || event.key === 'T') {
                event.preventDefault();
                setActiveTab('timetable');
                return;
            }

            if (event.key === '?') {
                event.preventDefault();
                setShowHelp(true);
            }
        };

        globalThis.addEventListener('keydown', onKeyDown);
        return () => globalThis.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        if (!showHeaderMenu) return;
        const onEscape = (event) => {
            if (event.key === 'Escape') setShowHeaderMenu(false);
        };
        globalThis.addEventListener('keydown', onEscape);
        return () => globalThis.removeEventListener('keydown', onEscape);
    }, [showHeaderMenu]);

    const handleRefresh = () => {
        fetchDueAssessments(searchText.trim());
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
    };

    const switchDashboardVersion = useCallback(async () => {
        const nextVersion = 'base';
        try {
            await fetch('/api/auth/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dashboardVersion: nextVersion }),
            });
        } finally {
            router.replace(getDashboardRoute(nextVersion));
        }
    }, [router]);

    const activeFilterCount = (filters.years?.length || 0) + (filters.terms?.length || 0) +
        (filters.courseIds?.length || 0) + (filters.courseCodes?.length || 0);

    const quickLinks = useMemo(() => getQuickLinks(user?.canvasBaseUrl), [user?.canvasBaseUrl]);

    if (!authChecked) {
        return (
            <div style={{ minHeight: '100vh', background: '#0b0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className={styles.spinnerLarge} />
            </div>
        );
    }

    const isAssessmentView = activeTab === 'active' || activeTab === 'passedYear' || activeTab === 'pastClasses';
    const isListOrCalendar = isAssessmentView || activeTab === 'calendar' || activeTab === 'hidden';

    return (
        <div className={styles.root}>
            {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
            {selectedAssessment && <AssessmentDetailModal assessment={selectedAssessment} onClose={() => setSelectedAssessment(null)} />}



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
                        {lastUpdated && (
                            <span className={styles.lastUpdated}>
                                Updated {lastUpdated.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}

                        <button
                            className={styles.menuBtn}
                            onClick={() => setShowHeaderMenu((open) => !open)}
                            aria-expanded={showHeaderMenu}
                            aria-haspopup="menu"
                        >
                            ☰ Menu
                        </button>

                        {showHeaderMenu && (
                            <>
                                <button
                                    className={styles.menuBackdrop}
                                    onClick={() => setShowHeaderMenu(false)}
                                    aria-label="Close menu"
                                />
                                <div className={styles.menuPanel} role="menu" aria-label="Dashboard menu">
                                    <div className={styles.menuSection}>Quick links</div>
                                    {quickLinks.map((link) => (
                                        <a
                                            key={`menu-${link.label}`}
                                            href={link.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={styles.menuLink}
                                            onClick={() => setShowHeaderMenu(false)}
                                        >
                                            {link.label}
                                        </a>
                                    ))}
                                    <button className={styles.menuAction} onClick={() => { setShowHeaderMenu(false); switchDashboardVersion(); }}>Switch to default dashboard</button>
                                    <button className={styles.menuAction} onClick={() => { setShowHeaderMenu(false); setActiveTab('settings'); }}>⚙️ Settings</button>
                                    <button className={styles.menuAction} onClick={() => { setShowHeaderMenu(false); setShowHelp(true); }}>⌨️ Shortcuts</button>
                                    <button className={styles.menuActionDanger} onClick={() => { setShowHeaderMenu(false); handleLogout(); }}>Sign out</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {setupBanner && (
                <div className={dashStyles.setupBanner}>
                    <span>{setupBanner}</span>
                    <div className={dashStyles.setupBannerActions}>
                        <button className={dashStyles.setupBannerBtn} onClick={() => setActiveTab('settings')}>Open Settings</button>
                        <button className={dashStyles.setupBannerClose} onClick={() => setSetupBanner('')}>✕</button>
                    </div>
                </div>
            )}

            <main className={styles.main}>
                <section className={styles.controlPanel}>
                    <div className={styles.searchForm}>
                        <div className={styles.inputWrapper}>
                            <span className={styles.inputIcon}>🔍</span>
                            <input ref={searchInputRef} type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)}
                                placeholder="Type to search classes, quizzes, or semester" className={styles.searchInput} />
                        </div>
                        <div className={styles.btnGroup}>
                            <button type="button" onClick={handleClearFilter} disabled={loading} className={styles.btnSecondary}>Show All</button>
                            <button type="button" onClick={handleRefresh} disabled={loading} className={styles.btnPrimary}>
                                {loading ? <><span className={styles.spinner} /> Refreshing…</> : 'Refresh'}
                            </button>
                        </div>
                    </div>
                </section>

                <div className={dashStyles.tabsAndFilter}>
                    <div className={styles.tabRow}>
                        <button className={`${styles.tabBtn} ${activeTab === 'active' ? styles.tabBtnActive : ''}`}
                            onClick={() => { setActiveTab('active'); }}>📋 Active</button>
                        <button className={`${styles.tabBtn} ${activeTab === 'passedYear' ? styles.tabBtnActive : ''}`}
                            onClick={() => { setActiveTab('passedYear'); }}>✅ Passed This Year</button>
                        <button className={`${styles.tabBtn} ${activeTab === 'pastClasses' ? styles.tabBtnActive : ''}`}
                            onClick={() => { setActiveTab('pastClasses'); }}>🗂️ Past Classes</button>
                        <button className={`${styles.tabBtn} ${activeTab === 'calendar' ? styles.tabBtnActive : ''}`}
                            onClick={() => { setActiveTab('calendar'); }}>📅 Calendar</button>
                        <button className={`${styles.tabBtn} ${activeTab === 'settings' ? styles.tabBtnActive : ''}`}
                            onClick={() => { setActiveTab('settings'); }}>⚙️ Settings</button>
                        <button className={`${styles.tabBtn} ${activeTab === 'timetable' ? styles.tabBtnActive : ''}`}
                            onClick={() => { setActiveTab('timetable'); }}>🕐 Timetable</button>
                        <button
                            className={`${styles.tabBtn} ${activeTab === 'hidden' ? styles.tabBtnActive : ''} ${dashStyles.hiddenTab}`}
                            onClick={() => { setActiveTab('hidden'); }}
                        >
                            👁 Hidden
                            {hiddenIds.size > 0 && <span className={dashStyles.hiddenBadge}>{hiddenIds.size}</span>}
                        </button>
                    </div>

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

                <div className={`${dashStyles.contentWithSidebar} ${sidebarOpen && isListOrCalendar ? dashStyles.contentWithSidebarOpen : ''}`}>
                    {isListOrCalendar && (
                        <FilterSidebar
                            dueData={dueData}
                            filters={filters}
                            onFiltersChange={setFilters}
                            onHideCourse={hideCourseAssessments}
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

                        {!loading && !error && (isAssessmentView || activeTab === 'hidden') && (
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
                                    assessmentView={activeTab}
                                    urgencyFilter={urgencyFilter}
                                    setUrgencyFilter={setUrgencyFilter}
                                    filters={filters}
                                    hiddenIds={hiddenIds}
                                    onHide={hideAssessment}
                                    onUnhide={unhideAssessment}
                                    onOpenDetails={setSelectedAssessment}
                                    showHidden={activeTab === 'hidden'}
                                    nowTick={nowTick}
                                />
                            </>
                        )}

                        {!loading && !error && activeTab === 'calendar' && (
                            <CalendarView
                                dueData={dueData}
                                hiddenIds={hiddenIds}
                                onHide={hideAssessment}
                                onUnhide={unhideAssessment}
                                onOpenDetails={setSelectedAssessment}
                                nowTick={nowTick}
                            />
                        )}

                        {activeTab === 'timetable' && (
                            <TimetableView
                                timetableEvents={timetableEvents}
                                timetableLoading={timetableLoading}
                                timetableError={timetableError}
                            />
                        )}
                        {activeTab === 'settings' && (
                            <div style={{ padding: '1rem' }}>
                                <SettingsModal
                                    inline
                                    user={user}
                                    dashboardVersion={pageDashboardVersion}
                                    onClose={() => setActiveTab('active')}
                                    reminderHours={reminderHours}
                                    onReminderHoursChange={setReminderHours}
                                    notificationPermission={notificationPermission}
                                    onEnableNotifications={handleEnableNotifications}
                                    onSaved={(updatedUser) => {
                                        setUser(updatedUser);
                                        setSetupBanner('');
                                        if (updatedUser?.dashboardVersion && updatedUser.dashboardVersion !== pageDashboardVersion) {
                                            router.replace(getDashboardRoute(updatedUser.dashboardVersion));
                                            return;
                                        }
                                        setTimeout(() => { setActiveTab('active'); fetchDueAssessments(''); }, 800);
                                    }}
                                />
                            </div>
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