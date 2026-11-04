import React, { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';
import dashStyles from '../styles/Dashboard.module.css';
import sidebarStyles from '../styles/FilterSidebar.module.css';
import Image from 'next/image';
import { normalizeCanvasBaseUrl } from '../lib/canvas-url.js';
import { sanitizeBriefHtml } from '../lib/sanitize-html.js';

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

function Icon({ name, size = 16, className }) {
    const paths = {
        alert: <path d="M12 3 2.8 19h18.4L12 3Z M12 9v4 M12 16h.01" />,
        book: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5ZM4 5.5V21 M8 7h8 M8 11h8" />,
        calendar: <path d="M5 4v3M19 4v3M4 6h16v14H4zM4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />,
        check: <path d="m5 12 4 4L19 6" />,
        clipboard: <path d="M9 4h6v3H9zM7 5H5v15h14V5h-2M8 12h8M8 16h5" />,
        clock: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2" />,
        close: <path d="m6 6 12 12M18 6 6 18" />,
        eye: <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />,
        filter: <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" />,
        flag: <path d="M5 21V4m0 1c4-3 6 3 14 0v9c-8 3-10-3-14 0" />,
        folder: <path d="M3 6h7l2 2h9v10H3z" />,
        inbox: <path d="M4 5h16l2 10H15l-2 2h-2l-2-2H2L4 5Z M4 5h16" />,
        menu: <path d="M4 7h16M4 12h16M4 17h16" />,
        restore: <path d="M4 10a8 8 0 1 1 2 6M4 10V5m0 5h5" />,
        search: <path d="m20 20-4.5-4.5M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />,
        sparkles: <path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3ZM19 16l.6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" />,
        star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
        tag: <path d="M4 5v6l9 9 7-7-9-9H4Zm3 4h.01" />,
        trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />,
    };

    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            {paths[name] || paths.tag}
        </svg>
    );
}

Icon.propTypes = {
    name: PropTypes.string.isRequired,
    size: PropTypes.number,
    className: PropTypes.string,
};

function getUrgency(dueTimestamp) {
    const diff = dueTimestamp - Date.now();
    const days = diff / (1000 * 60 * 60 * 24);
    if (days <= 5) return 'urgent';
    if (days <= 14) return 'warning';
    return 'safe';
}

function getTimeAwareGreeting(date = new Date()) {
    const hour = date.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
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

function formatScorePercentage(score, pointsPossible) {
    const numericScore = Number(score);
    const numericPointsPossible = Number(pointsPossible);
    if (
        !Number.isFinite(numericScore) ||
        !Number.isFinite(numericPointsPossible) ||
        numericPointsPossible <= 0
    ) {
        return null;
    }

    const percentage = Math.round((numericScore / numericPointsPossible) * 1000) / 10;
    return `${percentage}%`;
}

function formatShortDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-AU', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function formatShortTime(dateString) {
    return new Date(dateString).toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function FormattedDueDate({ dateString }) {
    return (
        <>
            {formatShortDate(dateString)} 
            &nbsp;
            {formatShortTime(dateString)}
        </>
    );
}

FormattedDueDate.propTypes = {
    dateString: PropTypes.string.isRequired,
};

function formatTime(dateString) {
    return formatShortTime(dateString);
}

const submissionTypeLabels = {
    external_tool: 'External Tool',
    media_recording: 'Media Recording',
    none: 'None',
    online_quiz: 'Online Quiz',
    online_text_entry: 'Online Text Entry',
    online_upload: 'Online Upload',
    online_url: 'Online URL',
};

function formatSubmissionType(submissionType) {
    return submissionTypeLabels[submissionType] || submissionType;
}

function FormattedTitle({ title }) {
    const separatorIndex = title.indexOf(':');
    if (separatorIndex === -1) return title;

    return (
        <>
            {title.slice(0, separatorIndex + 1)}
            <br />
            {title.slice(separatorIndex + 1).trim()}
        </>
    );
}

FormattedTitle.propTypes = {
    title: PropTypes.string.isRequired,
};

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

function loadHidden() {
    try {
        const raw = localStorage.getItem(HIDDEN_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
}

function saveHidden(set) {
    try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set]));
    } catch {
        /* ignore */
    }
}

// ─── Filter / Sort logic ───────────────────────────────────────────────────
function applyFiltersAndSort(dueData, filters, hiddenIds, showHidden) {
    const allTerms = dueData.terms;

    const filtered = allTerms
        .map((term) => {
            const courses = term.courses
                .map((course) => {
                    let assessments = course.assessments.filter((a) => {
                        const isHidden = hiddenIds.has(String(a.id));
                        if (showHidden) return isHidden;
                        return !isHidden;
                    });

                    if (filters.years?.length > 0) {
                        assessments = assessments.filter((a) =>
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
                        if (sortBy === 'dueDate') {
                            av = a.dueTimestamp;
                            bv = b.dueTimestamp;
                        } else if (sortBy === 'courseName') {
                            av = a.courseName;
                            bv = b.courseName;
                        } else if (sortBy === 'points') {
                            av = a.pointsPossible ?? -1;
                            bv = b.pointsPossible ?? -1;
                        } else if (sortBy === 'name') {
                            av = a.name;
                            bv = b.name;
                        }
                        if (av < bv) return sortDir === 'asc' ? -1 : 1;
                        if (av > bv) return sortDir === 'asc' ? 1 : -1;
                        return 0;
                    });

                    return { ...course, assessments };
                })
                .filter((c) => c.assessments.length > 0);

            return { ...term, courses };
        })
        .filter((t) => t.courses.length > 0);

    return filtered;
}

// ─── Shared sub-components ─────────────────────────────────────────────────

const UrgencyBadge = memo(function UrgencyBadge({ dueTimestamp, nowTick }) {
    const urgency = getUrgency(dueTimestamp);
    const label = getDaysLeftLabel(dueTimestamp);
    const isOverdue = dueTimestamp < nowTick;

    let iconName = 'clock';
    if (isOverdue) {
        iconName = 'tag';
    } else if (urgency === 'urgent') {
        iconName = 'alert';
    }

    return (
        <span
            className={`${styles.badge} ${styles['badge_' + urgency]}`}
            style={
                isOverdue
                    ? { background: 'var(--bg-subtle)', borderColor: 'var(--border)', color: 'var(--text-muted)' }
                    : undefined
            }
        >
            <Icon name={iconName} size={14} /> {label}
        </span>
    );
});

UrgencyBadge.propTypes = {
    dueTimestamp: PropTypes.number.isRequired,
    nowTick: PropTypes.number.isRequired,
};

const AssessmentMeta = memo(function AssessmentMeta({ assessment, isPast, isHidden, scorePercentage }) {
    return (
        <div className={styles.assessmentMeta}>
            <span className={styles.dueDate}>
                <Icon name="calendar" size={14} /> <FormattedDueDate dateString={assessment.dueAt} />
            </span>
            {!isPast && assessment.pointsPossible != null && (
                <span className={styles.points}><Icon name="star" size={14} /> {assessment.pointsPossible} pts</span>
            )}
            {!isPast && assessment.score != null && (
                <span className={styles.gradeBadge}>
                    {assessment.score}
                    {assessment.pointsPossible == null ? '' : `/${assessment.pointsPossible}`}
                    {scorePercentage && ` (${scorePercentage})`}
                </span>
            )}
            {isHidden && <span className={dashStyles.hiddenTag}>Hidden</span>}
        </div>
    );
});

AssessmentMeta.propTypes = {
    assessment: PropTypes.object.isRequired,
    isPast: PropTypes.bool.isRequired,
    isHidden: PropTypes.bool.isRequired,
    scorePercentage: PropTypes.string,
};

const AssessmentCardActions = memo(function AssessmentCardActions({
    assessment,
    isHidden,
    isPast,
    nowTick,
    scorePercentage,
    onHide,
    onUnhide,
}) {
    return (
        <div className={dashStyles.cardActions}>
            {!isHidden &&
                (isPast ? (
                    assessment.score != null && (
                        <span className={styles.gradeBadge}>
                            <Icon name="flag" size={14} /> {assessment.score}
                            {assessment.pointsPossible == null ? '' : `/${assessment.pointsPossible}`}
                            {scorePercentage && ` (${scorePercentage})`}
                        </span>
                    )
                ) : (
                    <UrgencyBadge dueTimestamp={assessment.dueTimestamp} nowTick={nowTick} />
                ))}
            {(isHidden || !isPast) && (
                <button
                    className={isHidden ? dashStyles.unhideBtn : dashStyles.hideBtn}
                    onClick={() => (isHidden ? onUnhide(assessment.id) : onHide(assessment.id))}
                    title={isHidden ? 'Restore assessment' : 'Hide assessment'}
                    aria-label={isHidden ? `Restore ${assessment.name}` : `Hide ${assessment.name}`}
                >
                    <Icon name={isHidden ? 'restore' : 'close'} size={14} /> {isHidden ? 'Restore' : 'Hide'}
                </button>
            )}
        </div>
    );
});

AssessmentCardActions.propTypes = {
    assessment: PropTypes.object.isRequired,
    isHidden: PropTypes.bool.isRequired,
    isPast: PropTypes.bool.isRequired,
    nowTick: PropTypes.number.isRequired,
    scorePercentage: PropTypes.string,
    onHide: PropTypes.func.isRequired,
    onUnhide: PropTypes.func.isRequired,
};

const AssessmentCard = memo(function AssessmentCard({
    assessment,
    onHide,
    onUnhide,
    onOpenDetails,
    isHidden,
    nowTick,
}) {
    const { dueTimestamp } = assessment;
    const urgency = getUrgency(dueTimestamp);
    const isOverdue = dueTimestamp < nowTick;
    const isPast = isOverdue;
    const scorePercentage = formatScorePercentage(assessment.score, assessment.pointsPossible);
    return (
        <li
            className={`${styles.assessmentItem} ${styles[isHidden ? 'item_safe' : 'item_' + urgency]} ${isHidden ? dashStyles.hiddenItem : ''}`}
            style={
                isOverdue
                    ? { background: 'var(--bg-subtle)', borderColor: 'var(--border)', color: 'var(--text-muted)' }
                    : undefined
            }
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
                        <span className={styles.dueDate}>
                            <Icon name="calendar" size={14} /> <FormattedDueDate dateString={assessment.dueAt} />
                        </span>
                        {!isPast && assessment.pointsPossible != null && (
                            <span className={styles.points}><Icon name="star" size={14} /> {assessment.pointsPossible} pts</span>
                        )}
                        {!isPast && assessment.score != null && (
                            <span className={styles.gradeBadge}>
                                {assessment.score}
                                {assessment.pointsPossible == null ? '' : `/${assessment.pointsPossible}`}
                                {scorePercentage && ` (${scorePercentage})`}
                            </span>
                        )}
                        {isHidden && <span className={dashStyles.hiddenTag}>Hidden</span>}
                    </div>
                </div>
            </div>
            <AssessmentCardActions
                assessment={assessment}
                isHidden={isHidden}
                isPast={isPast}
                nowTick={nowTick}
                scorePercentage={scorePercentage}
                onHide={onHide}
                onUnhide={onUnhide}
            />
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
        { key: 'all', label: 'All', icon: 'clipboard' },
        { key: 'urgent', label: '≤5 days', icon: 'alert' },
        { key: 'warning', label: '≤2 weeks', icon: 'clock' },
        { key: 'safe', label: '>2 weeks', icon: 'check' },
    ];
    return (
        <div className={styles.legendRow}>
            {filters.map((f) => (
                <button
                    key={f.key}
                    className={`${styles.filterChip} ${urgencyFilter === f.key ? styles.filterChipActive : ''}`}
                    onClick={() => setUrgencyFilter(f.key)}
                >
                    <Icon name={f.icon} size={14} /> {f.label}
                </button>
            ))}
            
        </div>
        
    );
});

UrgencyLegend.propTypes = {
    urgencyFilter: PropTypes.string.isRequired,
    setUrgencyFilter: PropTypes.func.isRequired,
};

const FilterSidebar = memo(function FilterSidebar({
    dueData,
    filters,
    onFiltersChange,
    isOpen,
    onClose,
    onHideCourse,
    id,
}) {
    const allAssessments = dueData.terms.flatMap((t) => t.courses.flatMap((c) => c.assessments));

    const years = [...new Set(allAssessments.map((a) => new Date(a.dueAt).getFullYear()))].sort((a, b) => b - a);
    const terms = [...new Set(dueData.terms.map((t) => t.termName))].sort((a, b) => a.localeCompare(b));
    const courses = [
        ...new Map(allAssessments.map((a) => [a.courseId, { id: a.courseId, name: a.courseName }])).values(),
    ].sort((a, b) => a.name.localeCompare(b.name));
    const courseCodes = [
        ...new Set(
            courses
                .map((c) => {
                    const m = c.name.match(/^([A-Z]{2,6}\d{3,5}[A-Z]?)/);
                    return m ? m[1] : null;
                })
                .filter(Boolean)
        ),
    ].sort((a, b) => a.localeCompare(b));

    const toggle = (key, value) => {
        const current = filters[key] || [];
        const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
        onFiltersChange({ ...filters, [key]: next });
    };

    const clearAll = () =>
        onFiltersChange({ years: [], terms: [], courseIds: [], courseCodes: [], sortBy: 'dueDate', sortDir: 'asc' });

    const activeCount =
        (filters.years?.length || 0) +
        (filters.terms?.length || 0) +
        (filters.courseIds?.length || 0) +
        (filters.courseCodes?.length || 0);

    return (
        <>
            {isOpen && (
                <button
                    type="button"
                    className={sidebarStyles.backdrop}
                    onClick={onClose}
                    tabIndex={0}
                    aria-label="Close filters"
                />
            )}
            <aside
                id={id}
                className={`${sidebarStyles.sidebar} ${isOpen ? sidebarStyles.sidebarOpen : ''}`}
            >
                <div className={sidebarStyles.sidebarHeader}>
                    <span className={sidebarStyles.sidebarTitle}>Filters &amp; Sort</span>
                    {activeCount > 0 && (
                        <button className={sidebarStyles.clearBtn} onClick={clearAll}>
                            Clear all ({activeCount})
                        </button>
                    )}
                    <button className={sidebarStyles.closeBtn} onClick={onClose} aria-label="Close">
                        <Icon name="close" size={16} />
                    </button>
                </div>

                <div className={sidebarStyles.sidebarBody}>
                    <section className={sidebarStyles.section}>
                        <h3 className={sidebarStyles.sectionTitle}>Sort by</h3>
                        <div className={sidebarStyles.sortRow}>
                            <select
                                className={sidebarStyles.select}
                                value={filters.sortBy || 'dueDate'}
                                onChange={(e) => onFiltersChange({ ...filters, sortBy: e.target.value })}
                            >
                                <option value="dueDate">Due date</option>
                                <option value="courseName">Course name</option>
                                <option value="points">Points</option>
                                <option value="name">Assessment name</option>
                            </select>
                            <button
                                className={sidebarStyles.dirBtn}
                                onClick={() =>
                                    onFiltersChange({ ...filters, sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' })
                                }
                            >
                                {filters.sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
                            </button>
                        </div>
                    </section>

                    {years.length > 0 && (
                        <section className={sidebarStyles.section}>
                            <h3 className={sidebarStyles.sectionTitle}>
                                Year
                                {filters.years?.length > 0 && (
                                    <span className={sidebarStyles.activeCount}>{filters.years.length}</span>
                                )}
                            </h3>
                            <div className={sidebarStyles.chipGroup}>
                                {years.map((y) => (
                                    <button
                                        key={y}
                                        className={`${sidebarStyles.chip} ${filters.years?.includes(y) ? sidebarStyles.chipActive : ''}`}
                                        onClick={() => toggle('years', y)}
                                    >
                                        {y}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {terms.length > 0 && (
                        <section className={sidebarStyles.section}>
                            <h3 className={sidebarStyles.sectionTitle}>
                                Semester
                                {filters.terms?.length > 0 && (
                                    <span className={sidebarStyles.activeCount}>{filters.terms.length}</span>
                                )}
                            </h3>
                            <div className={sidebarStyles.chipGroup}>
                                {terms.map((t) => (
                                    <button
                                        key={t}
                                        className={`${sidebarStyles.chip} ${filters.terms?.includes(t) ? sidebarStyles.chipActive : ''}`}
                                        onClick={() => toggle('terms', t)}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {courseCodes.length > 0 && (
                        <section className={sidebarStyles.section}>
                            <h3 className={sidebarStyles.sectionTitle}>
                                Course code
                                {filters.courseCodes?.length > 0 && (
                                    <span className={sidebarStyles.activeCount}>{filters.courseCodes.length}</span>
                                )}
                            </h3>
                            <div className={sidebarStyles.chipGroup}>
                                {courseCodes.map((code) => (
                                    <button
                                        key={code}
                                        className={`${sidebarStyles.chip} ${filters.courseCodes?.includes(code) ? sidebarStyles.chipActive : ''}`}
                                        onClick={() => toggle('courseCodes', code)}
                                    >
                                        {code}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {courses.length > 0 && (
                        <section className={sidebarStyles.section}>
                            <h3 className={sidebarStyles.sectionTitle}>
                                Course
                                {filters.courseIds?.length > 0 && (
                                    <span className={sidebarStyles.activeCount}>{filters.courseIds.length}</span>
                                )}
                            </h3>
                            <div className={sidebarStyles.courseList}>
                                {courses.map((c) => (
                                    <div key={c.id} className={sidebarStyles.courseRow}>
                                        <label className={sidebarStyles.courseFilterLabel}>
                                            <input
                                                type="checkbox"
                                                className={sidebarStyles.checkbox}
                                                checked={filters.courseIds?.includes(c.id) || false}
                                                onChange={() => toggle('courseIds', c.id)}
                                            />
                                            <span className={sidebarStyles.courseLabel}>{c.name}</span>
                                        </label>
                                        <button
                                            className={sidebarStyles.courseHideBtn}
                                            onClick={() => onHideCourse(c.id)}
                                        >
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
    id: PropTypes.string,
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
            emptySub: 'Assessments you hide will appear here. Click Hide on any item to hide it.',
            emptyIcon: 'inbox',
        };
    }

    if (assessmentView === 'active') {
        return {
            viewTitle: 'Active assessments',
            emptyTitle: 'You are all caught up',
            emptySub: 'No upcoming assessments right now. Enjoy the breather.',
            emptyIcon: 'sparkles',
        };
    }

    if (assessmentView === 'passedYear') {
        return {
            viewTitle: 'Passed assessments this year',
            emptyTitle: 'No passed assessments found this year',
            emptySub: 'Try adjusting the filters in the sidebar.',
            emptyIcon: 'folder',
        };
    }

    return {
        viewTitle: 'Past classes',
        emptyTitle: 'No past classes found',
        emptySub: 'Try adjusting the filters in the sidebar.',
        emptyIcon: 'folder',
    };
}

function getUrgencyFilterTag(urgencyFilter) {
    if (urgencyFilter === 'urgent') return 'Due soon';
    if (urgencyFilter === 'warning') return 'Coming up';
    return 'Later';
}

function filterCourse(course, showHidden, assessmentView, urgencyFilter, nowDate) {
    const assessments = course.assessments.filter((a) =>
        shouldIncludeAssessmentInList(a, showHidden, assessmentView, urgencyFilter, nowDate)
    );
    return { ...course, assessments };
}

function filterTermWithCourses(term, showHidden, assessmentView, urgencyFilter, nowDate) {
    // returns a term object with courses filtered to only include assessments
    const courses = term.courses
        .map((course) => filterCourse(course, showHidden, assessmentView, urgencyFilter, nowDate))
        .filter((c) => c.assessments.length > 0);

    return { ...term, courses };
}

const ListView = memo(function ListView({
    dueData,
    assessmentView,
    urgencyFilter,
    setUrgencyFilter,
    filters,
    hiddenIds,
    onHide,
    onUnhide,
    onOpenDetails,
    showHidden,
    nowTick,
}) {
    const nowDate = useMemo(() => new Date(nowTick), [nowTick]);

    const filteredTerms = useMemo(() => {
        const base = applyFiltersAndSort(dueData, filters, hiddenIds, showHidden);
        return base
            .map((term) => filterTermWithCourses(term, showHidden, assessmentView, urgencyFilter, nowDate))
            .filter((t) => t.courses.length > 0);
    }, [assessmentView, dueData, filters, hiddenIds, urgencyFilter, showHidden, nowDate]);

    const allVisible = filteredTerms.flatMap((t) => t.courses.flatMap((c) => c.assessments));
    const allActive = useMemo(() => {
        return applyFiltersAndSort(dueData, { ...filters, sortBy: 'dueDate', sortDir: 'asc' }, hiddenIds, showHidden)
            .flatMap((t) => t.courses.flatMap((c) => c.assessments))
            .filter((a) => shouldIncludeAssessmentInList(a, showHidden, assessmentView, 'all', nowDate));
    }, [assessmentView, dueData, filters, hiddenIds, showHidden, nowDate]);

    const urgentCount = allActive.filter((a) => getUrgency(a.dueTimestamp) === 'urgent').length;
    const warningCount = allActive.filter((a) => getUrgency(a.dueTimestamp) === 'warning').length;
    const safeCount = allActive.filter((a) => getUrgency(a.dueTimestamp) === 'safe').length;
    const { viewTitle, emptyTitle, emptySub, emptyIcon } = getListViewText(showHidden, assessmentView);
    const showActiveStats = !showHidden && assessmentView === 'active';
    const showUrgencyTag = !showHidden && assessmentView === 'active' && urgencyFilter !== 'all';
    let emptySubText = emptySub;
    if (showHidden && urgencyFilter === 'all') {
        emptySubText = 'Try a different urgency filter.';
    }

    if (showHidden && hiddenIds.size === 0) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyIcon}><Icon name="eye" size={32} /></div>
                <p className={styles.emptyTitle}>No hidden assessments</p>
                <p className={styles.emptySub}>
                    Assessments you hide will appear here. Click Hide on any item to hide it.
                </p>
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
                            <span className={styles.statLabel}><Icon name="alert" size={14} /> Due soon</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.statCard} ${styles.statWarning} ${urgencyFilter === 'warning' ? styles.statCardActive : ''}`}
                            onClick={() => setUrgencyFilter('warning')}
                            aria-pressed={urgencyFilter === 'warning'}
                        >
                            <span className={styles.statNum}>{warningCount}</span>
                            <span className={styles.statLabel}><Icon name="clock" size={14} /> Coming up</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.statCard} ${styles.statSafe} ${urgencyFilter === 'safe' ? styles.statCardActive : ''}`}
                            onClick={() => setUrgencyFilter('safe')}
                            aria-pressed={urgencyFilter === 'safe'}
                        >
                            <span className={styles.statNum}>{safeCount}</span>
                            <span className={styles.statLabel}><Icon name="check" size={14} /> Later</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.statCard} ${styles.statTotal} ${urgencyFilter === 'all' ? styles.statCardActive : ''}`}
                            onClick={() => setUrgencyFilter('all')}
                            aria-pressed={urgencyFilter === 'all'}
                        >
                            <span className={styles.statNum}>{allActive.length}</span>
                            <span className={styles.statLabel}><Icon name="clipboard" size={14} /> Total</span>
                        </button>
                    </div>
                    <br></br>
                    <UrgencyLegend urgencyFilter={urgencyFilter} setUrgencyFilter={setUrgencyFilter} />
                    <br></br>
                </>
            )}

            {showHidden && (
                <div className={dashStyles.hiddenBanner}>
                    <span>
                        Showing {hiddenIds.size} hidden assessment{hiddenIds.size === 1 ? '' : 's'}. Click Restore
                        to bring them back.
                    </span>
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
                                <span className={styles.filterTag}>{getUrgencyFilterTag(urgencyFilter)}</span>
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
const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

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
    const match = UNIVERSITY_CONFIG.find((u) => u.url.toLowerCase().replace(/\/$/, '') === normalised);
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

    const prevMonth = () => {
        setSelectedDay(null);
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear((y) => y - 1);
        } else setViewMonth((m) => m - 1);
    };
    const nextMonth = () => {
        setSelectedDay(null);
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear((y) => y + 1);
        } else setViewMonth((m) => m + 1);
    };
    const goToday = () => {
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
        setSelectedDay(null);
    };

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const handleDayClick = (day) => {
        if (!day) return;
        const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        setSelectedDay((prev) => (prev?.key === key ? null : { key, day, assessments: assessmentsByDate[key] || [] }));
    };

    return (
        <div className={styles.calendarWrap}>
            <div className={styles.calNav}>
                <button className={styles.calNavBtn} onClick={prevMonth} aria-label="Previous month">
                    ‹
                </button>
                <div className={styles.calNavCenter}>
                    <span className={styles.calMonthLabel}>
                        {MONTHS[viewMonth]} {viewYear}
                    </span>
                    <button className={styles.calTodayBtn} onClick={goToday}>
                        Today
                    </button>
                </div>
                <button className={styles.calNavBtn} onClick={nextMonth} aria-label="Next month">
                    ›
                </button>
            </div>
            <br></br>

            <div className={styles.calLegend}>
                <span className={styles.calLegendItem}>
                    <span className={`${styles.calLegendDot} ${styles.dotToday}`} />
                    {' '}
                    Today
                </span>
                <span className={styles.calLegendItem}>
                    <span className={`${styles.calLegendDot} ${styles.dotUrgent}`} />
                    {' '}
                    ≤5 days
                </span>
                <span className={styles.calLegendItem}>
                    <span className={`${styles.calLegendDot} ${styles.dotWarning}`} />
                    {' '}   
                    ≤2 weeks
                </span>
                <span className={styles.calLegendItem}>
                    <span className={`${styles.calLegendDot} ${styles.dotSafe}`} />
                    {' '}
                    &gt;2 weeks
                </span>
            </div>

            <br></br>

            <div className={styles.calGrid}>
                {DAYS.map((d) => (
                    <div key={d} className={styles.calDayHeader}>
                        {d}
                    </div>
                ))}
                {(() => {
                    let emptyKeyCount = 0;
                    return cells.map((day) => {
                        if (!day) {
                            return (
                                <div
                                    key={`empty-${viewYear}-${viewMonth}-${emptyKeyCount++}`}
                                    className={styles.calEmptyCell}
                                />
                            );
                        }
                        const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isToday = key === todayStr;
                        const dayItems = assessmentsByDate[key] || [];
                        const isSelected = selectedDay?.key === key;
                        let dotUrgency = null;
                        if (dayItems.length > 0) {
                            if (dayItems.some((a) => getUrgency(a.dueTimestamp) === 'urgent')) dotUrgency = 'urgent';
                            else if (dayItems.some((a) => getUrgency(a.dueTimestamp) === 'warning'))
                                dotUrgency = 'warning';
                            else dotUrgency = 'safe';
                        }
                        return (
                            <button
                                key={key}
                                type="button"
                                className={[
                                    styles.calCell,
                                    isToday ? styles.calCellToday : '',
                                    isSelected ? styles.calCellSelected : '',
                                    dayItems.length > 0 ? styles.calCellHasItems : '',
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                                onClick={() => handleDayClick(day)}
                            >
                                <span className={styles.calDayNum}>{day}</span>
                                <div className={styles.calPills}>
                                    {dayItems.slice(0, 2).map((a) => {
                                        const pillUrgency = getUrgency(a.dueTimestamp);
                                        return (
                                            <div
                                                key={a.id}
                                                className={styles.calPill + ' ' + styles['calPill_' + pillUrgency]}
                                            >
                                                {formatTime(a.dueAt)} <FormattedTitle title={a.name} />
                                            </div>
                                        );
                                    })}
                                    {dayItems.length > 2 && (
                                        <div className={styles.calPillMore}>+{dayItems.length - 2} more</div>
                                    )}
                                </div>
                                {dotUrgency &&
                                    (() => {
                                        const dotClass = `dot_${dotUrgency}`;
                                        return <span className={`${styles.calDot} ${styles[dotClass]}`} />;
                                    })()}
                            </button>
                        );
                    });
                })()}
            </div>

            {selectedDay && (
                <div className={styles.calDetail}>
                    <div className={styles.calDetailHeader}>
                        <h3 className={styles.calDetailTitle}>
                            {selectedDay.day} {MONTHS[viewMonth]} {viewYear}
                        </h3>
                        <button className={styles.calDetailClose} onClick={() => setSelectedDay(null)}>
                            <Icon name="close" size={16} />
                        </button>
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
                                            <button
                                                className={styles.calDetailNameBtn}
                                                onClick={() => onOpenDetails(a)}
                                            >
                                                <FormattedTitle title={a.name} />
                                            </button>
                                            <div className={styles.calDetailMeta}>
                                                <span className={styles.calDetailCourse}>{a.courseName}</span>
                                                <span className={styles.calDetailTime}>
                                                    <Icon name="clock" size={14} /> <FormattedDueDate dateString={a.dueAt} />
                                                </span>
                                                {a.pointsPossible != null && (
                                                    <span className={styles.calDetailPts}>
                                                        <Icon name="star" size={14} /> {a.pointsPossible} pts
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className={dashStyles.cardActions}>
                                            <UrgencyBadge dueTimestamp={a.dueTimestamp} nowTick={nowTick} />
                                            <button
                                                className={dashStyles.hideBtn}
                                                onClick={() => onHide(a.id)}
                                                title="Hide"
                                            >
                                                <Icon name="close" size={14} />
                                            </button>
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

const TT_START_HOUR = 7; // 7 AM
const TT_END_HOUR = 22; // 10 PM
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
const TT_CLASS_COLORS_KEY = 'fr_tt_class_colors';

function toneIndexForSummary(summary) {
    const codeMatch = (summary || '').match(/[A-Z]{2,6}\d{3,5}[A-Z]?/);
    const key = codeMatch ? codeMatch[0] : (summary || 'Untitled Event').split(',')[0].trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = key.codePointAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % TT_BLOCK_TONES;
}

function timetableClassKey(event) {
    return event.className || (event.summary || '').split(',')[0] || event.summary || 'Untitled Event';
}

function getTimetableColorStyle(color) {
    if (!/^#[\da-f]{6}$/i.test(color || '')) return undefined;
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
    return {
        backgroundColor: color,
        borderColor: color,
        color: luminance > 155 ? '#17202a' : '#FFFFFF',
    };
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
    const [classColors, setClassColors] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(TT_CLASS_COLORS_KEY) || '{}');
            return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
        } catch {
            return {};
        }
    });
    const [use24Hour, setUse24Hour] = useState(() => {
        try {
            const saved = localStorage.getItem('fr_tt_time_format');
            if (saved === '12') return false;
            if (saved === '24') return true;
        } catch {
            // Ignore storage issues
        }
        return true;
    });

    useEffect(() => {
        try {
            localStorage.setItem('fr_tt_time_format', use24Hour ? '24' : '12');
        } catch {
            // Ignore storage issues
        }
    }, [use24Hour]);

    useEffect(() => {
        try {
            localStorage.setItem(TT_CLASS_COLORS_KEY, JSON.stringify(classColors));
        } catch {
            // Ignore storage issues
        }
    }, [classColors]);

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

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });

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

    const formatLocalTime = (value) =>
        new Date(value).toLocaleTimeString('en-AU', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: !use24Hour,
        });

    const localNowLabel = localNow.toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: !use24Hour,
    });

    const nowDecimalHour = localNow.getHours() + localNow.getMinutes() / 60 + localNow.getSeconds() / 3600;
    const isNowInTimetableRange = nowDecimalHour >= TT_START_HOUR && nowDecimalHour <= TT_END_HOUR;
    const nowMarkerPercent =
        ((Math.max(TT_START_HOUR, Math.min(TT_END_HOUR, nowDecimalHour)) - TT_START_HOUR) / TT_SPAN) * 100;

    const selectedDay = weekDays[Math.max(0, Math.min(6, dayOffset))] || weekDays[0];
    const selectedDayKey = toDateKey(selectedDay);
    const isSelectedDayToday = selectedDayKey === todayKey;
    const selectedDayEvents = [...(eventsByDate[selectedDayKey] || [])].sort(
        (a, b) => new Date(a.start) - new Date(b.start)
    );
    const selectedDayLabel = selectedDay.toLocaleDateString('en-AU', {
        weekday: 'long',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });

    const formatLocalDateTime = (value) =>
        new Date(value).toLocaleString('en-AU', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: !use24Hour,
        });

    const getEventStyle = (event) => getTimetableColorStyle(classColors[timetableClassKey(event)]);
    const savedSelectedClassColor = selectedClass && classColors[selectedClass.classKey];
    const selectedClassColor = getTimetableColorStyle(savedSelectedClassColor) ? savedSelectedClassColor : undefined;
    const selectedClassStyle = getTimetableColorStyle(selectedClassColor);
    const updateClassColor = (color) => {
        if (!selectedClass?.classKey) return;
        setClassColors((current) => ({ ...current, [selectedClass.classKey]: color }));
    };
    const resetClassColor = () => {
        if (!selectedClass?.classKey) return;
        setClassColors((current) => {
            const next = { ...current };
            delete next[selectedClass.classKey];
            return next;
        });
    };

    return (
        <div className={styles.timetableWrap}>
            <div className={styles.ttControls}>
                <span className={styles.ttLocalTime}>
                    <span className={styles.ttLocalTimeValue}>{localNowLabel}</span>
                </span>
                <button
                    type="button"
                    className={styles.ttTimeFormatBtn}
                    onClick={() => setUse24Hour((v) => !v)}
                    aria-label={`Switch to ${use24Hour ? '12-hour' : '24-hour'} time`}
                >
                    {use24Hour ? '24h' : '12h'}
                </button>
            </div>

            {timetableError && (
                <div className={styles.errorBanner}>
                    <span><Icon name="alert" size={16} /> {timetableError}</span>
                </div>
            )}

            {timetableLoading && (
                <div className={styles.loadingWrap}>
                    <span className={styles.spinnerLarge} />
                    <p className={styles.loadingText}>Syncing timetable…</p>
                </div>
            )}

            {!timetableLoading && timetableEvents.length === 0 && !timetableError && (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}><Icon name="book" size={32} /></div>
                    <p className={styles.emptyTitle}>No timetable events found</p>
                    <p className={styles.emptySub}>No timetable events are available for this account.</p>
                </div>
            )}

            {!timetableLoading && timetableEvents.length > 0 && (
                <div className={styles.ttOuter}>
                    {/* Week navigator */}
                    <div className={styles.ttWeekNav}>
                        <button
                            className={styles.ttNavBtn}
                            onClick={() => setWeekOffset((o) => o - 1)}
                            aria-label="Previous week"
                        >
                            ‹
                        </button>
                        <span className={styles.ttWeekLabel}>{weekLabel}</span>
                        <button
                            className={styles.ttNavBtn}
                            onClick={() => setWeekOffset((o) => o + 1)}
                            aria-label="Next week"
                        >
                            ›
                        </button>
                        {weekOffset !== 0 && (
                            <button className={styles.ttTodayBtn} onClick={() => setWeekOffset(0)}>
                                Today
                            </button>
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
                                                <div
                                                    className={`${styles.ttDayLabel} ${isToday ? styles.ttDayLabelToday : ''}`}
                                                >
                                                    <span className={styles.ttDayName}>
                                                        {day.toLocaleDateString('en-AU', { weekday: 'short' })}
                                                    </span>
                                                    <span className={styles.ttDayDate}>
                                                        {day.toLocaleDateString('en-AU', {
                                                            day: 'numeric',
                                                            month: 'numeric',
                                                        })}
                                                    </span>
                                                </div>

                                                {/* Timeline cell */}
                                                <div
                                                    className={`${styles.ttTimeline} ${isToday ? styles.ttTimelineToday : ''}`}
                                                >
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
                                                        <div
                                                            className={styles.ttNowMarker}
                                                            style={{ left: `${nowMarkerPercent}%` }}
                                                            aria-hidden="true"
                                                        />
                                                    )}

                                                    {/* Event blocks */}
                                                    {dayEvents.map((ev, idx) => {
                                                        const pos = positionBlock(ev.start, ev.end);
                                                        const classKey = timetableClassKey(ev);
                                                        const toneIndex = toneIndexForSummary(classKey);
                                                        const startFmt = formatLocalTime(ev.start);
                                                        const endFmt = formatLocalTime(ev.end);
                                                        const eventKey =
                                                            key + '-' + (ev.uid || ev.start + '-' + ev.end + '-' + idx);
                                                        const isSelected = selectedClass?.uid
                                                            ? selectedClass.uid === ev.uid
                                                            : selectedClass?.eventKey === eventKey;
                                                        const blockClassName =
                                                            styles.ttBlock +
                                                            ' ' +
                                                            styles[`ttBlockTone${toneIndex}`] +
                                                            (isSelected ? ' ' + styles.ttBlockActive : '');
                                                        const blockTitle =
                                                            ev.summary +
                                                            '\n' +
                                                            startFmt +
                                                            '–' +
                                                            endFmt +
                                                            (ev.location ? '\n' + ev.location : '');
                                                        return (
                                                            <button
                                                                key={eventKey}
                                                                type="button"
                                                                className={blockClassName}
                                                                style={{ left: pos.left, width: pos.width, ...getEventStyle(ev) }}
                                                                title={blockTitle}
                                                                onClick={() =>
                                                                    setSelectedClass({ ...ev, classKey, toneIndex, eventKey })
                                                                }
                                                            >
                                                                <span className={styles.ttBlockName}>
                                                                    <FormattedTitle title={ev.summary} />
                                                                </span>
                                                                {ev.location && (
                                                                    <span className={styles.ttBlockLoc}>
                                                                        {ev.location}
                                                                    </span>
                                                                )}
                                                                <span className={styles.ttBlockTime}>
                                                                    {startFmt} – {endFmt}
                                                                </span>
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
                                            <div
                                                className={styles.ttNowMarker}
                                                style={{ left: `${nowMarkerPercent}%` }}
                                                aria-hidden="true"
                                            />
                                        )}

                                        {selectedDayEvents.map((ev, idx) => {
                                            const pos = positionBlock(ev.start, ev.end);
                                            const classKey = timetableClassKey(ev);
                                            const toneIndex = toneIndexForSummary(classKey);
                                            const startFmt = formatLocalTime(ev.start);
                                            const endFmt = formatLocalTime(ev.end);
                                            const eventKey = `${selectedDayKey}-${idx}`;
                                            const isSelected = selectedClass?.uid
                                                ? selectedClass.uid === ev.uid
                                                : selectedClass?.eventKey === eventKey;

                                            const titleText = `${ev.summary}\n${startFmt}–${endFmt}${ev.location ? '\n' + ev.location : ''}`;
                                            const toneClass = styles['ttBlockTone' + toneIndex];
                                            return (
                                                <button
                                                    key={eventKey}
                                                    className={`${styles.ttBlock} ${styles.ttDayBlock} ${toneClass} ${isSelected ? styles.ttBlockActive : ''}`}
                                                    style={{ left: pos.left, width: pos.width, ...getEventStyle(ev) }}
                                                    title={titleText}
                                                    onClick={() => setSelectedClass({ ...ev, classKey, toneIndex, eventKey })}
                                                >
                                                    <span className={styles.ttBlockName}>
                                                        <FormattedTitle title={ev.summary} />
                                                    </span>
                                                    <span className={styles.ttBlockTime}>
                                                        {startFmt} – {endFmt}
                                                    </span>
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
                                                <span className={styles.ttDayVerticalHour}>
                                                    {formatHourLabel(h, use24Hour)}
                                                </span>
                                            </div>
                                        ))}

                                        {isSelectedDayToday && isNowInTimetableRange && (
                                            <div
                                                className={`${styles.ttNowMarker} ${styles.ttNowMarkerVertical}`}
                                                style={{ top: `${nowMarkerPercent}%` }}
                                                aria-hidden="true"
                                            />
                                        )}

                                        {selectedDayEvents.map((ev, idx) => {
                                            const pos = positionBlockVertical(ev.start, ev.end);
                                            const classKey = timetableClassKey(ev);
                                            const toneIndex = toneIndexForSummary(classKey);
                                            const toneClass = styles[`ttBlockTone${toneIndex}`];
                                            const eventKey = `${selectedDayKey}-${idx}`;
                                            const isSelected = selectedClass?.uid
                                                ? selectedClass.uid === ev.uid
                                                : selectedClass?.eventKey === eventKey;

                                            return (
                                                <button
                                                    key={`vertical-${eventKey}`}
                                                    type="button"
                                                    className={`${styles.ttBlock} ${styles.ttDayVerticalBlock} ${toneClass} ${isSelected ? styles.ttBlockActive : ''}`}
                                                    style={{ top: pos.top, height: pos.height, ...getEventStyle(ev) }}
                                                    onClick={() => setSelectedClass({ ...ev, classKey, toneIndex, eventKey })}
                                                >
                                                    <span className={styles.ttBlockName}>
                                                        <FormattedTitle title={ev.summary} />
                                                    </span>
                                                    <span className={styles.ttBlockTime}>
                                                        {formatLocalTime(ev.start)} - {formatLocalTime(ev.end)}
                                                    </span>
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
                                        const classKey = timetableClassKey(ev);
                                        const toneIndex = toneIndexForSummary(classKey);
                                        const eventKey = `${selectedDayKey}-${idx}`;
                                        const isSelected = selectedClass?.uid
                                            ? selectedClass.uid === ev.uid
                                            : selectedClass?.eventKey === eventKey;
                                        return (
                                            <li key={`activity-${eventKey}`} className={styles.ttActivityItem}>
                                                <button
                                                    className={`${styles.ttActivityBtn} ${isSelected ? styles.ttActivityBtnActive : ''}`}
                                                    onClick={() => setSelectedClass({ ...ev, classKey, toneIndex, eventKey })}
                                                >
                                                    <span className={styles.ttActivityTime}>
                                                        {formatLocalTime(ev.start)} - {formatLocalTime(ev.end)}
                                                    </span>
                                                    <span className={styles.ttActivityName}>
                                                        <FormattedTitle title={ev.summary} />
                                                    </span>
                                                    {ev.location && (
                                                        <span className={styles.ttActivityLocation}>{ev.location}</span>
                                                    )}
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
                                <div
                                    className={`${styles.ttDetailStripe} ${selectedClassStyle ? '' : styles['ttBlockTone' + selectedClass.toneIndex]}`}
                                    style={selectedClassStyle}
                                />
                                <div className={styles.eventDetailsSection} style={{ flex: 1 }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            justifyContent: 'space-between',
                                            gap: '0.75rem',
                                            marginBottom: '0.75rem',
                                        }}
                                    >
                                        <span className={styles.eventName}>
                                            <FormattedTitle title={selectedClass.className || selectedClass.summary} />
                                        </span>
                                        <button
                                            className={styles.calDetailClose}
                                            onClick={() => setSelectedClass(null)}
                                            aria-label="Close"
                                        >
                                            <Icon name="close" size={16} />
                                        </button>
                                    </div>

                                    <div className={styles.ttColorPicker}>
                                        <label htmlFor="timetable-class-color">Class colour</label>
                                        <input
                                            id="timetable-class-color"
                                            type="color"
                                            value={selectedClassColor || '#3C3489'}
                                            onChange={(event) => updateClassColor(event.target.value)}
                                            aria-label={`Choose colour for ${selectedClass.classKey}`}
                                        />
                                        <button
                                            type="button"
                                            className={styles.ttResetColorBtn}
                                            onClick={resetClassColor}
                                            disabled={!selectedClassColor}
                                        >
                                            Reset
                                        </button>
                                    </div>

                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                            gap: '0.625rem 1.5rem',
                                        }}
                                    >
                                        <div>
                                            <div className={styles.ttDetailLabel}>Start</div>
                                            <div className={styles.ttDetailValue}>
                                                {formatLocalDateTime(selectedClass.start)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className={styles.ttDetailLabel}>End</div>
                                            <div className={styles.ttDetailValue}>
                                                {formatLocalDateTime(selectedClass.end)}
                                            </div>
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
                                                <div className={styles.ttDetailValue}>
                                                    <FormattedTitle title={selectedClass.summary} />
                                                </div>
                                            </div>
                                        )}

                                        {selectedClass.description && (
                                            <div style={{ gridColumn: '1 / -1' }}>
                                                <div className={styles.ttDetailLabel}>Description</div>
                                                <div
                                                    className={styles.ttDetailValue}
                                                    style={{
                                                        whiteSpace: 'pre-wrap',
                                                        maxHeight: '120px',
                                                        overflowY: 'auto',
                                                    }}
                                                >
                                                    {selectedClass.description}
                                                </div>
                                            </div>
                                        )}

                                        {selectedClass.uid && (
                                            <div style={{ gridColumn: '1 / -1' }}>
                                                <div className={styles.ttDetailLabel}>UID</div>
                                                <div
                                                    className={styles.ttDetailValue}
                                                    style={{
                                                        fontFamily: 'IBM Plex Mono, monospace',
                                                        fontSize: '0.68rem',
                                                        wordBreak: 'break-all',
                                                        color: 'var(--text-muted)',
                                                    }}
                                                >
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

const UNIVERSITIES = [...UNIVERSITY_CONFIG, { label: 'Custom / Other university', url: '' }];

function SettingsModal({
    user,
    onClose,
    onSaved,
    inline = false,
}) {
    const defaultEnvUrl = 'https://rmit.instructure.com/api/v1/';
    const savedUrl = user?.canvasBaseUrl || defaultEnvUrl;
    const matchedPreset = UNIVERSITIES.find((u) => u.url && u.url.toLowerCase() === savedUrl.toLowerCase());
    const initialPreset = matchedPreset ? matchedPreset.url : '';

    const [form, setForm] = useState({ canvasApiToken: '', timetableLink: '', canvasBaseUrl: '' });
    const [uniPreset, setUniPreset] = useState(initialPreset);
    const [showCustomUrl, setShowCustomUrl] = useState(!matchedPreset && Boolean(user?.canvasBaseUrl));
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
        setError('');
        setSuccess('');
    };
    const handleUniSelect = (e) => {
        const val = e.target.value;
        setUniPreset(val);
        if (val === '') {
            setShowCustomUrl(true);
            setForm((f) => ({ ...f, canvasBaseUrl: '' }));
        } else {
            setShowCustomUrl(false);
            setForm((f) => ({ ...f, canvasBaseUrl: val }));
        }
        setError('');
        setSuccess('');
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');
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
            const res = await fetch('/api/auth/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || 'Failed to save.');
                return;
            }
            setSuccess('Settings saved!');
            onSaved?.(data.user);
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const currentDisplayUrl = user?.canvasBaseUrl || defaultEnvUrl;
    const handleExportCalendar = () => {
        const exportLink = document.createElement('a');
        exportLink.href = '/api/assessments/export.ics';
        exportLink.click();
    };

    const content = (
        <div className={inline ? dashStyles.settingsPanel : dashStyles.modal}>
            <div className={dashStyles.modalHeader}>
                <div>
                    <p className={dashStyles.modalEyebrow}>Workspace preferences</p>
                    <h2 className={dashStyles.modalTitle}>Settings</h2>
                </div>
                <button className={dashStyles.modalClose} onClick={onClose} aria-label="Close settings">
                    <Icon name="close" size={16} />
                </button>
            </div>
            <div className={inline ? `${dashStyles.modalBody} ${dashStyles.settingsPanelBody}` : dashStyles.modalBody}>
                <div className={dashStyles.userInfo}>
                    <div className={dashStyles.userAvatar}>{user?.username?.[0]?.toUpperCase() || '?'}</div>
                    <div>
                        <div className={dashStyles.userName}>{user?.username}</div>
                        <div className={dashStyles.userEmail}>{user?.email}</div>
                    </div>
                </div>
                <div className={dashStyles.settingsIntro}>
                    <div>
                        <strong>Make Final Reckoning yours</strong>
                        <p>Connect your Canvas account and tune how your dashboard keeps you on track.</p>
                    </div>
                </div>
                {error && (
                    <div className={dashStyles.settingsError}>
                        <span><Icon name="alert" size={16} /></span> {error}
                    </div>
                )}
                {success && (
                    <div className={dashStyles.settingsSuccess}>
                        <span><Icon name="check" size={16} /></span> {success}
                    </div>
                )}
                <div className={dashStyles.settingsWorkspace}>
                    <aside className={dashStyles.settingsNav} aria-label="Settings sections">
                        <p className={dashStyles.settingsNavTitle}>Settings</p>
                        <a href="#canvas-connection" className={dashStyles.settingsNavItem}>
                            <span></span>
                            <span>
                                <strong>Canvas connection</strong>
                                <small>Institution &amp; credentials</small>
                            </span>
                        </a>
                        <div className={dashStyles.settingsNavNote}>
                            <span></span>
                            <p>Your sensitive Canvas details are encrypted before storage.</p>
                        </div>
                    </aside>
                    <form onSubmit={handleSave} className={dashStyles.settingsForm}>
                        <div id="canvas-connection" className={dashStyles.settingsSectionHeading}>
                            <div>
                                <h3>Canvas connection</h3>
                                <p>Choose your institution and keep your credentials up to date.</p>
                            </div>
                        </div>
                        <div className={dashStyles.settingsField}>
                            <label htmlFor="uniPreset" className={dashStyles.settingsLabel}>
                                University / Canvas Instance{' '}
                                <span className={dashStyles.settingsLabelHint}>
                                    Current: <code className={dashStyles.urlCode}>{currentDisplayUrl}</code>
                                </span>
                            </label>
                            <select
                                id="uniPreset"
                                value={uniPreset}
                                onChange={handleUniSelect}
                                className={dashStyles.settingsSelect}
                            >
                                <option value="" disabled>
                                    Select your university…
                                </option>
                                {UNIVERSITIES.map((u) => (
                                    <option key={u.label} value={u.url}>
                                        {u.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {showCustomUrl && (
                            <div className={dashStyles.settingsField}>
                                <label htmlFor="canvasBaseUrl" className={dashStyles.settingsLabel}>
                                    Canvas API Base URL
                                </label>
                                <input
                                    id="canvasBaseUrl"
                                    name="canvasBaseUrl"
                                    type="url"
                                    value={form.canvasBaseUrl}
                                    onChange={handleChange}
                                    className={dashStyles.settingsInput}
                                    placeholder="https://your-university.instructure.com/api/v1/"
                                    autoComplete="off"
                                />
                            </div>
                        )}
                        <div className={dashStyles.settingsDivider} />
                        <div className={dashStyles.settingsField}>
                            <label htmlFor="canvasApiToken" className={dashStyles.settingsLabel}>
                                Canvas API Token{' '}
                                <span className={dashStyles.settingsLabelHint}>
                                    Canvas → Account → Settings → New Access Token
                                </span>
                            </label>
                            <div className={dashStyles.inputWithBadge}>
                                <input
                                    id="canvasApiToken"
                                    name="canvasApiToken"
                                    type="password"
                                    value={form.canvasApiToken}
                                    onChange={handleChange}
                                    className={dashStyles.settingsInput}
                                    placeholder={
                                        user?.hasCanvasToken
                                            ? '••••••••••••••• (saved — paste new to update)'
                                            : 'Paste your Canvas API token here'
                                    }
                                    autoComplete="off"
                                />
                            </div>
                        </div>
                        <div className={dashStyles.settingsField}>
                            <label htmlFor="timetableLink" className={dashStyles.settingsLabel}>
                                Timetable iCal Link <span className={dashStyles.settingsLabelHint}>Optional</span>
                            </label>
                            <div className={dashStyles.inputWithBadge}>
                                <input
                                    id="timetableLink"
                                    name="timetableLink"
                                    type="url"
                                    value={form.timetableLink}
                                    onChange={handleChange}
                                    className={dashStyles.settingsInput}
                                    placeholder={
                                        user?.hasTimetableLink
                                            ? 'https://... (saved — paste to update)'
                                            : 'https://your-timetable.ics'
                                    }
                                />
                                {user?.hasTimetableLink && (
                                    <span className={dashStyles.savedBadge}>Saved</span>
                                )}
                            </div>
                        </div>

                        <div className={dashStyles.settingsField}>
                            <label className={dashStyles.settingsLabel}>
                                Calendar export{' '}
                                <span className={dashStyles.settingsLabelHint}>
                                    Download upcoming assessments as .ics
                                </span>
                            </label>
                            <button
                                type="button"
                                className={`${dashStyles.settingsSave} ${dashStyles.settingsSecondary}`}
                                onClick={handleExportCalendar}
                            >
                                Export assessments (.ics)
                            </button>
                        </div>

                        <div className={dashStyles.settingsDivider} />

                        <button type="submit" className={dashStyles.settingsSave} disabled={saving}>
                            {saving ? 'Saving…' : 'Save settings'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );

    if (inline) return content;

    return (
        <div className={dashStyles.modalOverlay}>
            <button type="button" className={dashStyles.modalBackdrop} onClick={onClose} aria-label="Close settings" />
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
    onClose: PropTypes.func.isRequired,
    onSaved: PropTypes.func,
};
SettingsModal.propTypes.inline = PropTypes.bool;

function getAssessmentSubmissionStatus(isSubmitted, submittedAtTimestamp, dueAtTimestamp) {
    if (!isSubmitted) return 'overdue';
    if (Number.isFinite(dueAtTimestamp) && submittedAtTimestamp > dueAtTimestamp) return 'submittedLate';
    return 'submitted';
}

function getAssessmentStatusLabel(assessment, isMarked, isSubmitted) {
    if (isMarked) return 'Marked';
    if (isSubmitted) return 'Awaiting mark';
    if (assessment.dueTimestamp < Date.now()) return 'Overdue';
    return getDaysLeftLabel(assessment.dueTimestamp);
}

function getAssessmentDetailStatus(assessment) {
    const submittedAtTimestamp = assessment.submittedAt ? Date.parse(assessment.submittedAt) : Number.NaN;
    const dueAtTimestamp = assessment.dueAt ? Date.parse(assessment.dueAt) : Number.NaN;
    const isMarked = assessment.score !== null && assessment.score !== undefined;
    const isSubmitted = Number.isFinite(submittedAtTimestamp);
    const submissionStatus = getAssessmentSubmissionStatus(isSubmitted, submittedAtTimestamp, dueAtTimestamp);
    let statusCardClass = getUrgency(assessment.dueTimestamp);
    if (isSubmitted) statusCardClass = 'awaitingMark';
    if (isMarked) statusCardClass = 'marked';

    return {
        submittedAtTimestamp,
        isSubmitted,
        isPast: assessment.dueTimestamp < Date.now(),
        statusCardClass,
        submissionStatus,
        statusLabel: getAssessmentStatusLabel(assessment, isMarked, isSubmitted),
        submissionStatusLabel: {
            submittedLate: 'Late',
            submitted: 'Ontime',
        }[submissionStatus] || 'None',
    };
}

function AssessmentDetailModal({ assessment, onClose }) {
    if (!assessment) return null;

    const briefHtml = sanitizeBriefHtml(assessment.description);
    const scorePercentage = formatScorePercentage(assessment.score, assessment.pointsPossible);
    const {
        isPast,
        statusCardClass,
        statusLabel,
        submissionStatus,
        submissionStatusLabel,
    } = getAssessmentDetailStatus(assessment);

    return (
        <div className={dashStyles.modalOverlay}>
            <button
                type="button"
                className={dashStyles.modalBackdrop}
                onClick={onClose}
                aria-label="Close assessment details"
            />
            <dialog
                className={`${dashStyles.modal} ${dashStyles.assessmentModal}`}
                open
                aria-modal="true"
                aria-labelledby="assessment-detail-title"
            >
                <div className={dashStyles.assessmentModalHeader}>
                    <div className={dashStyles.assessmentHeaderIcon} aria-hidden="true">
                        <Icon name="check" size={20} />
                    </div>
                    <div className={dashStyles.assessmentHeaderCopy}>
                        <p className={dashStyles.modalEyebrow}>Assessment details</p>
                        <h2 id="assessment-detail-title" className={dashStyles.modalTitle}>
                            <FormattedTitle title={assessment.name} />
                        </h2>
                        <p className={dashStyles.assessmentCourse}>{assessment.courseName}</p>
                    </div>
                    <button className={dashStyles.modalClose} onClick={onClose} type="button" aria-label="Close details">
                        <Icon name="close" size={16} />
                    </button>
                </div>
                <div className={`${dashStyles.modalBody} ${dashStyles.assessmentModalBody}`}>
                    <div className={dashStyles.detailMetaGrid}>
                        <span className={dashStyles.detailMetaCard}>
                            <span className={dashStyles.detailMetaLabel}>Due</span>
                            <strong>
                                <FormattedDueDate dateString={assessment.dueAt} />
                            </strong>
                        </span>
                        <span
                            className={[dashStyles.detailMetaCard, dashStyles[`detailMetaCard_${statusCardClass}`]].join(' ')}
                        >
                            <span className={dashStyles.detailMetaLabel}>Status</span>
                                                        <strong>{statusLabel}</strong>
                        </span>
                        {!isPast &&
                            assessment.pointsPossible !== null &&
                            assessment.pointsPossible !== undefined && (
                            <span className={dashStyles.detailMetaCard}>
                                <span className={dashStyles.detailMetaLabel}>Points</span>
                                <strong>{assessment.pointsPossible}</strong>
                            </span>
                        )}
                        {assessment.score !== null && assessment.score !== undefined && (
                            <span className={dashStyles.detailMetaCard}>
                                <span className={dashStyles.detailMetaLabel}>Score</span>
                                <strong>
                                    {assessment.score}
                                    {assessment.pointsPossible !== null && assessment.pointsPossible !== undefined
                                        ? `/${assessment.pointsPossible}`
                                        : ''}
                                    {scorePercentage && ` (${scorePercentage})`}
                                </strong>
                            </span>
                        )}
                        <span
                            className={`${dashStyles.detailMetaCard} ${dashStyles['detailMetaCard_' + submissionStatus]}`}
                        >
                            <span className={dashStyles.detailMetaLabel}>Submission status</span>
                            <strong>{submissionStatusLabel}</strong>
                        </span>
                        {/* Submitted tag intentionally removed for V1 */}
                        {Array.isArray(assessment.submissionTypes) && assessment.submissionTypes.length > 0 && (
                            <span className={dashStyles.detailMetaCard}>
                                <span className={dashStyles.detailMetaLabel}>Submission Type</span>
                                <strong>{assessment.submissionTypes.map(formatSubmissionType).join(', ')}</strong>
                            </span>
                        )}
                    </div>

                    <section className={dashStyles.detailDescriptionSection} aria-labelledby="assessment-description-title">
                        <div className={dashStyles.detailSectionHeading}>
                            <span id="assessment-description-title">Brief</span>
                            <span className={dashStyles.detailSectionLine} />
                        </div>
                        {briefHtml ? (
                            <div
                                className={dashStyles.detailDescription}
                                dangerouslySetInnerHTML={{ __html: briefHtml }}
                            />
                        ) : (
                            <div className={dashStyles.detailDescription}>
                                No description available for this assessment.
                            </div>
                        )}
                    </section>

                    <div className={dashStyles.detailActions}>
                        <a
                            className={dashStyles.assessmentPrimaryAction}
                            href={assessment.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open in Canvas
                            {' '}
                            <span aria-hidden="true">↗</span>
                        </a>
                        <button className={dashStyles.assessmentSecondaryAction} onClick={onClose} type="button">
                            Done
                        </button>
                    </div>
                </div>
            </dialog>
        </div>
    );
}

AssessmentDetailModal.propTypes = {
    assessment: PropTypes.object,
    onClose: PropTypes.func.isRequired,
};

function getPredictorCourses(dueData) {
    return dueData.terms
        .flatMap((term) => term.courses)
        .sort((a, b) => a.courseName.localeCompare(b.courseName));
}

function getPredictorSemesters(dueData) {
    return dueData.terms
        .map((term) => ({
            termName: term.termName,
            courses: [...term.courses].sort((a, b) => a.courseName.localeCompare(b.courseName)),
            latestAssessmentTimestamp: Math.max(
                ...term.courses.flatMap((course) =>
                    course.assessments.map((assessment) => Number(assessment.dueTimestamp) || 0)
                ),
                0
            ),
        }))
        .filter((term) => term.courses.length > 0)
        .sort(
            (a, b) =>
                b.latestAssessmentTimestamp - a.latestAssessmentTimestamp ||
                b.termName.localeCompare(a.termName, undefined, { numeric: true })
        );
}

function getInitialAssessmentScore(assessment) {
    const score = Number(assessment.score);
    const pointsPossible = Number(assessment.pointsPossible);
    if (!Number.isFinite(score) || !Number.isFinite(pointsPossible) || pointsPossible <= 0) return '';
    return String(Math.round((score / pointsPossible) * 1000) / 10);
}

function getPredictionPoints(scorePercentage, pointsPossible) {
    const score = Number(scorePercentage);
    const points = Number(pointsPossible);
    if (!Number.isFinite(score) || !Number.isFinite(points) || points <= 0) return '';
    return String(Math.round(((score / 100) * points + Number.EPSILON) * 100) / 100);
}

function getPredictionPercentage(pointsEarned, pointsPossible) {
    const earned = Number(pointsEarned);
    const possible = Number(pointsPossible);
    if (pointsEarned === '' || !Number.isFinite(earned) || !Number.isFinite(possible) || possible <= 0) return '';
    return String(Math.min(100, Math.max(0, (earned / possible) * 100)));
}

function getRmitFinalGrade(percentage) {
    const result = Number(percentage);
    if (!Number.isFinite(result)) return null;
    if (result >= 80) return 'HD';
    if (result >= 70) return 'DI';
    if (result >= 60) return 'CR';
    if (result >= 50) return 'PA';
    return 'NN';
}

function createPredictorGroup(index = 1) {
    return {
        id: `group-${Date.now()}-${index}`,
        name: `Assessment group ${index}`,
        weight: 0,
        assessments: [],
    };
}

function PredictorTable({ rows, showWeight, assignmentById, onScoreChange, onWeightChange, onRemove }) {
    return (
        <div className={dashStyles.predictorRows}>
            <table className={dashStyles.predictorTable}>
                <colgroup>
                    <col className={dashStyles.predictorAssessmentColumn} />
                    <col className={dashStyles.predictorScoreColumn} />
                    {showWeight && <col className={dashStyles.predictorWeightColumn} />}
                    <col className={dashStyles.predictorActionColumn} />
                </colgroup>
                <thead><tr><th scope="col">Assessment</th><th scope="col">Score</th>{showWeight && <th scope="col">Weight %</th>}<th scope="col"><span className={dashStyles.visuallyHidden}>Actions</span></th></tr></thead>
                <tbody>
                    {rows.map((item) => {
                        const assignment = assignmentById.get(String(item.id));
                        const pointsPossible = Number(assignment?.pointsPossible);
                        const name = assignment?.name || 'Assessment unavailable';
                        return (
                            <tr key={item.id}>
                                <td className={dashStyles.predictorAssignment}>
                                    <strong title={name}>{name}</strong><small>{assignment?.score != null ? 'Graded' : 'Not graded · what-if'}</small>
                                </td>
                                <td>
                                    <div className={dashStyles.predictorScoreCell}>
                                        <input className={dashStyles.predictorScoreInput} type="int" min="0" max={Number.isFinite(pointsPossible) ? pointsPossible : undefined} step="1" value={getPredictionPoints(item.score, assignment?.pointsPossible)} placeholder="–" aria-label={`Score for ${name}`} onChange={(event) => onScoreChange(item.id, event.target.value, assignment)} />
                                        <span className={dashStyles.predictorPointsSuffix}>/ {assignment?.pointsPossible ?? '—'}</span>
                                    </div>
                                </td>
                                {showWeight && <td>
                                    <input className={dashStyles.predictorWeightInput} type="int" min="0" max="100" step="1" value={item.weight} placeholder="0" aria-label={`Weight for ${name}`} onChange={(event) => onWeightChange(item.id, event.target.value)} />
                                </td>}
                                <td className={dashStyles.predictorActionCell}>
                                    <button type="button" className={dashStyles.predictorRemove} onClick={() => onRemove(item.id)} aria-label={`Remove ${name}`}>
                                        <Icon name="close" size={14} />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function PredictorAddRow({ selectKey, available, pendingAssessmentIds, setPendingAssessmentIds, onAdd, trailing }) {
    const selectedId = pendingAssessmentIds[selectKey] || available[0]?.id || '';
    return (
        <div className={dashStyles.predictorGroupFooter}>
            <select className={dashStyles.predictorAssessmentSelect} value={selectedId} onChange={(event) => setPendingAssessmentIds((current) => ({ ...current, [selectKey]: event.target.value }))} disabled={available.length === 0} aria-label="Select an assessment to add">
                {available.length === 0 ? <option value="">All assessments added</option> : available.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.name}</option>)}
            </select>
            <button type="button" className={dashStyles.predictorAdd} onClick={() => onAdd(selectedId)} disabled={available.length === 0}>Add</button>
            <span className={dashStyles.predictorFooterNote}>{trailing}</span>
        </div>
    );
}

function PredictorGroupsView({ groups, results, groupAvailable, renderTable, renderAddRow, updateGroup, removeGroup, addAssessment, setGroups }) {
    return (
        <>
            {results.map((group) => (
                <article key={group.id} className={dashStyles.predictorGroup}>
                    <div className={dashStyles.predictorGroupHeader}>
                        <input className={dashStyles.predictorGroupName} value={group.name} onChange={(event) => updateGroup(group.id, { name: event.target.value })} aria-label="Group name" />
                        <label className={dashStyles.predictorWeight}>
                            <input type="int" min="0" max="100" step="1" value={group.weight} onChange={(event) => updateGroup(group.id, { weight: event.target.value })} aria-label="Group weight percent" />
                            <span>% of course</span>
                        </label>
                        <button type="button" className={dashStyles.predictorRemove} onClick={() => removeGroup(group.id)} disabled={groups.length === 1} aria-label="Remove group"><Icon name="close" size={14} /></button>
                    </div>
                    {group.assessments.length === 0 ? (
                        <p className={dashStyles.predictorGroupEmpty}>Add assessments below to build this group.</p>
                    ) : renderTable({
                        rows: group.assessments,
                        showWeight: false,
                        showAverage: false,
                        onScoreChange: (id, value, assignment) => updateGroup(group.id, { assessments: group.assessments.map((item) => item.id === id ? { ...item, score: getPredictionPercentage(value, assignment?.pointsPossible) } : item) }),
                        onRemove: (id) => updateGroup(group.id, { assessments: group.assessments.filter((item) => item.id !== id) }),
                    })}
                    {renderAddRow({ selectKey: group.id, available: groupAvailable, onAdd: (id) => addAssessment(group.id, id), trailing: group.average == null ? 'No scores yet' : `Group average ${group.average.toFixed(1)}%` })}
                </article>
            ))}
            <button type="button" className={dashStyles.predictorAddGroup} onClick={() => setGroups((current) => [...current, createPredictorGroup(current.length + 1)])}>+ Add group</button>
        </>
    );
}

function PredictorIndividualView({ individualAssessments, individualAvailableAssignments, individualTotalWeight, renderTable, renderAddRow, setIndividualAssessments, addIndividualAssessment }) {
    return (
        <article className={dashStyles.predictorGroup}>
            <div className={dashStyles.predictorGroupHeader}>
                <strong className={dashStyles.predictorGroupTitle}>Assessments</strong>
                <span className={dashStyles.predictorFooterNote}>Each one has its own weight</span>
            </div>
            {individualAssessments.length === 0 ? (
                <p className={dashStyles.predictorGroupEmpty}>Add an assessment below to get started.</p>
            ) : renderTable({
                rows: individualAssessments,
                showWeight: true,
                onScoreChange: (id, value, assignment) => setIndividualAssessments((current) => current.map((item) => item.id === id ? { ...item, score: getPredictionPercentage(value, assignment?.pointsPossible) } : item)),
                onWeightChange: (id, value) => setIndividualAssessments((current) => current.map((item) => item.id === id ? { ...item, weight: value } : item)),
                onRemove: (id) => setIndividualAssessments((current) => current.filter((item) => item.id !== id)),
            })}
            {renderAddRow({ selectKey: 'individual', available: individualAvailableAssignments, onAdd: addIndividualAssessment, trailing: `Weights total ${individualTotalWeight}%` })}
        </article>
    );
}

function PredictorSummary({ predictionMode, passPercent, setPassPercent, predictedResult, finalGrade, resultState, resultMessage, weightState, weightMessage, summaryRows, weightTotal }) {
    return (
        <aside className={dashStyles.predictorSummary}>
            <div className={dashStyles.predictorResult}>
                <div className={dashStyles.predictorResultHeader}>
                    <span className={dashStyles.predictorResultLabel}>Predicted result</span>
                    <label className={dashStyles.predictorPassMark}>
                        <span>Pass percent</span>
                        <input type="int" min="0" max="100" step="1" value={passPercent} aria-label="Pass mark percentage" onChange={(event) => {
                            const inputValue = event.target.value;
                            if (inputValue === '') {
                                setPassPercent('');
                                return;
                            }

                            const value = Number(inputValue);
                            setPassPercent(Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : passPercent);
                        }} />
                        <span>%</span>
                    </label>
                </div>
                <strong className={dashStyles.predictorResultValue}>{predictedResult == null ? '--' : <><span className={dashStyles.predictorGrade}>{finalGrade}</span>{` ${predictedResult.toFixed(1)}%`}</>}</strong>
                <div className={dashStyles.predictorMeter} data-state={resultState} aria-label={predictedResult == null ? 'Predicted result is incomplete' : `${predictedResult.toFixed(1)} percent predicted result`}>
                    <div className={dashStyles.predictorMeterFill} style={{ width: `${predictedResult == null ? 0 : Math.min(100, predictedResult)}%` }} />
                </div>
                <small className={dashStyles.predictorMeterText} data-state={resultState}>{resultMessage}</small>
                <small className={dashStyles.predictorWeightMessage} data-state={weightState}>{weightMessage}</small>
            </div>
            {summaryRows.length > 0 && <div className={dashStyles.predictorWeightSummary}>
                <h3>{predictionMode === 'groups' ? 'Group weights' : 'Assessment weights'}</h3>
                {summaryRows.map((row) => <div key={row.id} className={dashStyles.predictorWeightSummaryRow}><span title={row.label}>{row.label}</span><strong>{row.weight}%</strong></div>)}
                <div className={dashStyles.predictorWeightSummaryTotal}><span>Total</span><strong>{weightTotal}%</strong></div>
            </div>}
        </aside>
    );
}

function readPredictorCache(storageKey) {
    try {
        return JSON.parse(localStorage.getItem(storageKey) || 'null') || {};
    } catch {
        return {};
    }
}

function writePredictorCache(storageKey, data) {
    try {
        localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
        // Local storage may be unavailable in private browsing.
    }
}

function getCachedPredictorCourse(courses, saved, selectedCourseId) {
    const courseId =
        saved.selectedCourseId && courses.some((course) => String(course.courseId) === String(saved.selectedCourseId))
            ? String(saved.selectedCourseId)
            : String(courses[0].courseId);
    const cachedCourse = saved.courses?.[courseId];
    const hasFreshCache = cachedCourse && Date.now() - Number(cachedCourse.savedAt) < 60 * 60 * 1000;
    return { courseId, cachedCourse, hasFreshCache };
}

function getPredictorResult(predictionMode, results, totalGroupWeight, individualAssessments) {
    if (predictionMode === 'groups' && totalGroupWeight > 0) {
        return results.reduce((total, group) => total + (group.average ?? 0) * group.groupWeight, 0) / totalGroupWeight;
    }
    if (predictionMode !== 'individual') return null;
    const scored = individualAssessments.filter(
        (item) => Number.isFinite(Number(item.score)) && Number(item.score) >= 0
    );
    const totalWeight = scored.reduce((total, item) => total + (Number(item.weight) || 0), 0);
    return totalWeight > 0
        ? scored.reduce((total, item) => total + Number(item.score) * (Number(item.weight) || 0), 0) / totalWeight
        : null;
}

const AssessmentPredictor = memo(function AssessmentPredictor({ dueData }) { // NOSONAR
    const courses = useMemo(() => getPredictorCourses(dueData), [dueData]);
    const semesters = useMemo(() => getPredictorSemesters(dueData), [dueData]);
    const storageKey = 'fr_result_predictor_cache';
    const cacheDuration = 60 * 60 * 1000;
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [predictionMode, setPredictionMode] = useState('individual');
    const [passPercent, setPassPercent] = useState(50);
    const [groups, setGroups] = useState([createPredictorGroup()]);
    const [individualAssessments, setIndividualAssessments] = useState([]);
    const [pendingAssessmentIds, setPendingAssessmentIds] = useState({});
    const initialized = useRef(false);

    useEffect(() => {
        if (courses.length === 0 || initialized.current) return;
        initialized.current = true;
        const saved = readPredictorCache(storageKey);
        const { courseId, cachedCourse, hasFreshCache } = getCachedPredictorCourse(courses, saved);
        try {
            // Restores saved predictor state from localStorage once courses have loaded.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedCourseId(courseId);
            if (hasFreshCache && Number.isFinite(Number(cachedCourse.passPercent))) {
                setPassPercent(Math.min(100, Math.max(0, Number(cachedCourse.passPercent))));
            }
            if (hasFreshCache && cachedCourse?.mode === 'individual') setPredictionMode('individual');
            if (hasFreshCache && Array.isArray(cachedCourse.groups) && cachedCourse.groups.length > 0) {
                setGroups(cachedCourse.groups);
            }
            if (hasFreshCache && Array.isArray(cachedCourse.individualAssessments)) {
                setIndividualAssessments(cachedCourse.individualAssessments);
            }
        } catch {
            setSelectedCourseId(String(courses[0].courseId));
        }
    }, [courses, cacheDuration]);

    useEffect(() => {
        if (!selectedCourseId || !initialized.current) return;
        const saved = readPredictorCache(storageKey);
        const coursesCache = saved.courses || {};
        coursesCache[selectedCourseId] = { savedAt: Date.now(), mode: predictionMode, passPercent, groups, individualAssessments };
        writePredictorCache(storageKey, { selectedCourseId, courses: coursesCache });
    }, [groups, individualAssessments, passPercent, predictionMode, selectedCourseId]);

    const handleCourseChange = (nextCourseId) => {
        if (nextCourseId === selectedCourseId) return;
        const saved = readPredictorCache(storageKey);
        const coursesCache = saved.courses || {};
        if (selectedCourseId) {
            coursesCache[selectedCourseId] = { savedAt: Date.now(), mode: predictionMode, passPercent, groups, individualAssessments };
        }
        writePredictorCache(storageKey, { selectedCourseId: nextCourseId, courses: coursesCache });
        setSelectedCourseId(nextCourseId);
        setPredictionMode('individual');
        setPassPercent(50);
        setGroups([createPredictorGroup()]);
        setIndividualAssessments([]);
        setPendingAssessmentIds({});
    };

    const handlePredictionModeChange = (nextMode) => {
        setPredictionMode(nextMode);
        setPendingAssessmentIds({});
    };

    const selectedCourse = courses.find((course) => String(course.courseId) === String(selectedCourseId));
    const assignments = useMemo(() => selectedCourse?.assessments || [], [selectedCourse?.assessments]);
    const assignmentById = useMemo(
        () => new Map(assignments.map((assessment) => [String(assessment.id), assessment])),
        [assignments]
    );

    const updateGroup = (groupId, updates) => {
        setGroups((current) => current.map((group) => (group.id === groupId ? { ...group, ...updates } : group)));
    };

    const updateAssessment = (groupId, assessmentId, updates) => {
        setGroups((current) =>
            current.map((group) =>
                group.id !== groupId
                    ? group
                    : {
                          ...group,
                          assessments: group.assessments.map((item) =>
                              item.id === assessmentId ? { ...item, ...updates } : item
                          ),
                      }
            )
        );
    };

    const addAssessment = (groupId, assessmentId) => {
        const group = groups.find((item) => item.id === groupId);
        const usedIds = new Set(groups.flatMap((item) => item.assessments.map((assessment) => String(assessment.id))));
        const nextAssignment = assignments.find(
            (assessment) => String(assessment.id) === String(assessmentId) && !usedIds.has(String(assessment.id))
        );
        if (!group || !nextAssignment) return;
        updateGroup(groupId, {
            assessments: [
                ...group.assessments,
                {
                    id: String(nextAssignment.id),
                    score: getInitialAssessmentScore(nextAssignment),
                },
            ],
        });
    };

    const removeGroup = (groupId) => {
        setGroups((current) => {
            if (current.length === 1) return current;
            return current.filter((group) => group.id !== groupId);
        });
    };

    const addIndividualAssessment = (assessmentId) => {
        const nextAssignment = assignments.find(
            (assessment) =>
                String(assessment.id) === String(assessmentId) &&
                !individualAssessments.some((item) => String(item.id) === String(assessment.id))
        );
        if (!nextAssignment) return;
        setIndividualAssessments((current) => [
            ...current,
            {
                id: String(nextAssignment.id),
                score: getInitialAssessmentScore(nextAssignment),
                weight: 0,
            },
        ]);
    };

    const individualAvailableAssignments = assignments.filter(
        (assignment) => !individualAssessments.some((item) => String(item.id) === String(assignment.id))
    );
    const individualTotalWeight = individualAssessments.reduce((total, item) => total + (Number(item.weight) || 0), 0);

    const results = groups.map((group) => {
        const groupWeight = Number(group.weight) || 0;
        const scored = group.assessments
            .map((item) => ({ ...item, assignment: assignmentById.get(String(item.id)) }))
            .filter((item) => item.assignment && Number.isFinite(Number(item.score)) && Number(item.score) >= 0);
        const average =
            scored.length > 0 ? scored.reduce((total, item) => total + Number(item.score), 0) / scored.length : null;
        return { ...group, groupWeight, scored, average };
    });
    const totalGroupWeight = results.reduce((total, group) => total + group.groupWeight, 0);
    const predictedResult = getPredictorResult(predictionMode, results, totalGroupWeight, individualAssessments);
    let resultState;
    if (predictedResult == null || passPercent === '') {
        resultState = 'incomplete';
    } else if (predictedResult >= passPercent) {
        resultState = 'passed';
    } else {
        resultState = 'failed';
    }
    const finalGrade = getRmitFinalGrade(predictedResult);
    let resultMessage;
    if (resultState === 'incomplete') {
        resultMessage = 'Add scores and complete the weights to see your result';
    } else if (resultState === 'passed') {
        resultMessage = `Passing result — ${finalGrade} grade`;
    } else {
        resultMessage = `Below pass mark — ${finalGrade} grade`;
    }

    // ─────────────────────────────────────────────────────────────────────────
// In AssessmentPredictor, KEEP everything down to and including
// `const predictedResult = ...;` exactly as it is.
//
// REPLACE everything after that (from `if (courses.length === 0) {` to the
// end of the component) with the code below.
// ─────────────────────────────────────────────────────────────────────────

    const weightTotal = predictionMode === 'groups' ? totalGroupWeight : individualTotalWeight;
    let weightState;
    if (weightTotal === 100) {
        weightState = 'complete';
    } else if (weightTotal > 100) {
        weightState = 'over';
    } else {
        weightState = 'under';
    }
    const weightMessage = {
        complete: 'Weights add up to 100%',
        over: `${weightTotal - 100}% over — reduce a weight`,
        under: `${100 - weightTotal}% left to assign`,
    }[weightState];

    const summaryRows =
        predictionMode === 'groups'
            ? results.map((group) => ({
                  id: group.id,
                  label: group.name || 'Unnamed group',
                  weight: group.groupWeight,
              }))
            : individualAssessments.map((item) => ({
                  id: item.id,
                  label: assignmentById.get(String(item.id))?.name || 'Assessment unavailable',
                  weight: Number(item.weight) || 0,
              }));

    const renderTable = (props) => <PredictorTable assignmentById={assignmentById} {...props} />;
    const renderAddRow = (props) => (
        <PredictorAddRow
            pendingAssessmentIds={pendingAssessmentIds}
            setPendingAssessmentIds={setPendingAssessmentIds}
            {...props}
        />
    );

    if (courses.length === 0) {
        return (
            <div className={dashStyles.predictorEmpty}>
                <div className={dashStyles.predictorEmptyIcon}><Icon name="tag" size={32} /></div>
                <h2>No assessments yet</h2>
                <p>Connect your Canvas account or refresh your assessments to start predicting your result.</p>
            </div>
        );
    }

    const usedInGroups = new Set(groups.flatMap((g) => g.assessments.map((a) => String(a.id))));
    const groupAvailable = assignments.filter((a) => !usedInGroups.has(String(a.id)));

    return (
        <section className={dashStyles.predictor}>
            <header className={dashStyles.predictorHeader}>
                <h2>Result predictor</h2>
                <p>Canvas scores are filled in for you. Enter a score on any ungraded assessment to see what-if results.</p>
            </header>

            <div className={dashStyles.predictorToolbar}>
                <label className={dashStyles.predictorCourse}>
                    <span className={dashStyles.predictorFieldLabel}>Course</span>
                    <select value={selectedCourseId} onChange={(event) => handleCourseChange(event.target.value)}>
                        {semesters.map((semester) => (
                            <optgroup key={semester.termName} label={semester.termName}>
                                {semester.courses.map((course) => (
                                    <option key={course.courseId} value={course.courseId}>
                                        {course.courseName}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </label>

                <fieldset className={dashStyles.predictorMode}>
                    <legend className={dashStyles.predictorFieldLabel}>Prediction mode</legend>
                    <button
                        type="button"
                        className={predictionMode === 'individual' ? dashStyles.predictorModeActive : ''}
                        aria-pressed={predictionMode === 'individual'}
                        onClick={() => handlePredictionModeChange('individual')}
                    >
                        Individually
                    </button>
                    <button
                        type="button"
                        className={predictionMode === 'groups' ? dashStyles.predictorModeActive : ''}
                        aria-pressed={predictionMode === 'groups'}
                        onClick={() => handlePredictionModeChange('groups')}
                    >
                        By group
                    </button>
                    
                </fieldset>
            </div>

            <div className={dashStyles.predictorLayout}>
                <div className={dashStyles.predictorMain}>
                    {predictionMode === 'groups' ? (
                        <>
                            {results.map((group) => (
                                <article key={group.id} className={dashStyles.predictorGroup}>
                                    <div className={dashStyles.predictorGroupHeader}>
                                        <input
                                            className={dashStyles.predictorGroupName}
                                            value={group.name}
                                            onChange={(event) => updateGroup(group.id, { name: event.target.value })}
                                            aria-label="Group name"
                                        />
                                        <label className={dashStyles.predictorWeight}>
                                            <input
                                                type="int"
                                                min="0"
                                                max="100"
                                                step="1"
                                                value={group.weight}
                                                onChange={(event) => updateGroup(group.id, { weight: event.target.value })}
                                                aria-label="Group weight percent"
                                            />
                                            <span>% of course</span>
                                        </label>
                                        <button
                                            type="button"
                                            className={dashStyles.predictorRemove}
                                            onClick={() => removeGroup(group.id)}
                                            disabled={groups.length === 1}
                                            aria-label="Remove group"
                                        >
                                            <Icon name="close" size={14} />
                                        </button>
                                    </div>

                                    {group.assessments.length === 0 ? (
                                        <p className={dashStyles.predictorGroupEmpty}>
                                            Add assessments below to build this group.
                                        </p>
                                    ) : (
                                        renderTable({
                                            rows: group.assessments,
                                            showWeight: false,
                                            onScoreChange: (id, value, assignment) =>
                                                updateAssessment(group.id, id, {
                                                    score: getPredictionPercentage(value, assignment?.pointsPossible),
                                                }),
                                            onRemove: (id) =>
                                                updateGroup(group.id, {
                                                    assessments: group.assessments.filter((a) => a.id !== id),
                                                }),
                                        })
                                    )}

                                    {renderAddRow({
                                        selectKey: group.id,
                                        available: groupAvailable,
                                        onAdd: (id) => addAssessment(group.id, id),
                                        trailing:
                                            group.average == null
                                                ? 'No scores yet'
                                                : `Group average ${group.average.toFixed(1)}%`,
                                    })}
                                </article>
                            ))}
                            <button
                                type="button"
                                className={dashStyles.predictorAddGroup}
                                onClick={() => setGroups((current) => [...current, createPredictorGroup(current.length + 1)])}
                            >
                                + Add group
                            </button>
                        </>
                    ) : (
                        <article className={dashStyles.predictorGroup}>
                            <div className={dashStyles.predictorGroupHeader}>
                                <strong className={dashStyles.predictorGroupTitle}>Assessments</strong>
                                <span className={dashStyles.predictorFooterNote}>Each one has its own weight</span>
                            </div>

                            {individualAssessments.length === 0 ? (
                                <p className={dashStyles.predictorGroupEmpty}>Add an assessment below to get started.</p>
                            ) : (
                                renderTable({
                                    rows: individualAssessments,
                                    showWeight: true,
                                    onScoreChange: (id, value, assignment) =>
                                        setIndividualAssessments((current) =>
                                            current.map((a) =>
                                                a.id === id
                                                    ? {
                                                          ...a,
                                                          score: getPredictionPercentage(value, assignment?.pointsPossible),
                                                      }
                                                    : a
                                            )
                                        ),
                                    onWeightChange: (id, value) =>
                                        setIndividualAssessments((current) =>
                                            current.map((a) => (a.id === id ? { ...a, weight: value } : a))
                                        ),
                                    onRemove: (id) =>
                                        setIndividualAssessments((current) => current.filter((a) => a.id !== id)),
                                })
                            )}

                            {renderAddRow({
                                selectKey: 'individual',
                                available: individualAvailableAssignments,
                                onAdd: addIndividualAssessment,
                                trailing: `Weights total ${individualTotalWeight}%`,
                            })}
                        </article>
                    )}
                </div>

                <aside className={dashStyles.predictorSummary}>
                    <div className={dashStyles.predictorResult}>
                        <div className={dashStyles.predictorResultHeader}>
                            <span className={dashStyles.predictorResultLabel}>Predicted result</span>
                            <label className={dashStyles.predictorPassMark}>
                                <span>Pass percent</span>
                                <input
                                    type="int"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={passPercent}
                                    aria-label="Pass mark percentage"
                                    onChange={(event) => {
                                        const value = Number(event.target.value);
                                        let nextPassPercent = passPercent;
                                        if (event.target.value === '') {
                                            nextPassPercent = '';
                                        } else if (Number.isFinite(value)) {
                                            nextPassPercent = Math.min(100, Math.max(0, value));
                                        }
                                        setPassPercent(nextPassPercent);
                                    }}
                                />
                                <span>%</span>
                            </label>
                        </div>
                        <strong className={dashStyles.predictorResultValue}>
                            {predictedResult == null ? '--' : (
                                <>
                                    <span className={dashStyles.predictorGrade}>{finalGrade}</span>
                                    {` ${predictedResult.toFixed(1)}%`}
                                </>
                            )}
                        </strong>
                        <div
                            className={dashStyles.predictorMeter}
                            data-state={resultState}
                            aria-label={
                                predictedResult == null
                                    ? 'Predicted result is incomplete'
                                    : `${predictedResult.toFixed(1)} percent predicted result`
                            }
                        >
                            <div
                                className={dashStyles.predictorMeterFill}
                                style={{ width: `${predictedResult == null ? 0 : Math.min(100, predictedResult)}%` }}
                            />
                        </div>
                        <small className={dashStyles.predictorMeterText} data-state={resultState}>
                            {resultMessage}
                        </small>
                        <small className={dashStyles.predictorWeightMessage} data-state={weightState}>
                            {weightMessage}
                        </small>
                    </div>

                    {summaryRows.length > 0 && (
                        <div className={dashStyles.predictorWeightSummary}>
                            <h3>{predictionMode === 'groups' ? 'Group weights' : 'Assessment weights'}</h3>
                            {summaryRows.map((row) => (
                                <div key={row.id} className={dashStyles.predictorWeightSummaryRow}>
                                    <span title={row.label}>{row.label}</span>
                                    <strong>{row.weight}%</strong>
                                </div>
                            ))}
                            <div className={dashStyles.predictorWeightSummaryTotal}>
                                <span>Total</span>
                                <strong>{weightTotal}%</strong>
                            </div>
                        </div>
                    )}
                </aside>
            </div>
        </section>
    );
});

AssessmentPredictor.propTypes = {
    dueData: PropTypes.shape({ terms: PropTypes.array }).isRequired,
};

// ─── MAIN DASHBOARD PAGE ───────────────────────────────────────────────────

const isAssessmentTab = (tab) => ['active', 'passedYear', 'pastClasses'].includes(tab);

const isListOrCalendarTab = (tab) => isAssessmentTab(tab) || tab === 'calendar' || tab === 'hidden';

function DashboardAssessmentModal({ assessment, onClose }) {
    if (!assessment) return null;
    return <AssessmentDetailModal assessment={assessment} onClose={onClose} />;
}

DashboardAssessmentModal.propTypes = {
    assessment: PropTypes.object,
    onClose: PropTypes.func.isRequired,
};

const countActiveFilters = (filters) =>
    ['years', 'terms', 'courseIds', 'courseCodes'].reduce(
        (count, key) => count + (filters[key]?.length || 0),
        0
    );

export default function Dashboard() { // NOSONAR
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
    const [selectedAssessment, setSelectedAssessment] = useState(null);
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const searchInputRef = useRef(null);

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [filters, setFilters] = useState({
        years: [],
        terms: [],
        courseIds: [],
        courseCodes: [],
        sortBy: 'dueDate',
        sortDir: 'asc',
    });

    const [hiddenIds, setHiddenIds] = useState(() => loadHidden());

    useEffect(() => {
        const timer = setInterval(() => {
            setNowTick(Date.now());
        }, 30 * 1000);
        return () => clearInterval(timer);
    }, []);

    const hideAssessment = useCallback((id) => {
        setHiddenIds((prev) => {
            const next = new Set(prev);
            next.add(String(id));
            saveHidden(next);
            return next;
        });
    }, []);

    const unhideAssessment = useCallback((id) => {
        setHiddenIds((prev) => {
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

    const hideCourseAssessments = useCallback(
        (courseId) => {
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
        },
        [dueData, addCourseAssessmentIds]
    );

    useEffect(() => {
        fetch('/api/auth/session')
            .then((r) => r.json())
            .then((data) => {
                if (data.authenticated) {
                    setUser(data.user);
                    setAuthChecked(true);
                    if (router.query.welcome === '1') {
                        setSetupBanner('Welcome! Add your Canvas API token in Settings to get started.');
                    }
                } else {
                    void router.replace('/login');
                }
            })
            .catch(() => router.replace('/login'));
    }, [router]);

    useEffect(() => {
        router.prefetch('/dashboard').catch(() => {});
    }, [router]);

    const fetchDueAssessments = useCallback(async (queryText = '') => {
        setLoading(true);
        setError(null);
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
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authChecked) return;
        const debounce = setTimeout(() => {
            fetchDueAssessments(searchText.trim());
        }, 320);
        return () => clearTimeout(debounce);
    }, [authChecked, searchText, fetchDueAssessments]);

    const handleClearFilter = () => {
        setSearchText('');
    };

    useEffect(() => {
        if (showSearch) searchInputRef.current?.focus();
    }, [showSearch]);

    const fetchTimetableData = useCallback(async () => {
        setTimetableLoading(true);
        setTimetableError('');
        try {
            const response = await fetch('/api/timetable');
            if (!response.ok) throw new Error(`Error ${response.status}: Failed to fetch timetable`);
            const data = await response.json();
            const sortedEvents = data.events.sort((a, b) => new Date(a.start) - new Date(b.start));
            setTimetableEvents(sortedEvents);
        } catch (err) {
            setTimetableError(err.message || 'Failed to sync timetable');
            setTimetableEvents([]);
        } finally {
            setTimetableLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!(activeTab === 'timetable' && authChecked)) return;
        // defer the fetch to avoid setting state synchronously within the effect
        const id = setTimeout(() => {
            fetchTimetableData();
        }, 0);
        return () => clearTimeout(id);
    }, [activeTab, authChecked, fetchTimetableData]);

    const handleRefresh = () => {
        fetchDueAssessments(searchText.trim());
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        await router.push('/');
    };

    const activeFilterCount = countActiveFilters(filters);

    const quickLinks = useMemo(() => getQuickLinks(user?.canvasBaseUrl), [user?.canvasBaseUrl]);

    if (!authChecked) {
        return (
            <div
                style={{
                    minHeight: '100vh',
                    background: '#0b0f1e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <span className={styles.spinnerLarge} />
            </div>
        );
    }

    const isAssessmentView = isAssessmentTab(activeTab);
    const isListOrCalendar = isListOrCalendarTab(activeTab);

    return (
        <div className={styles.root}>
            <DashboardAssessmentModal
                assessment={selectedAssessment}
                onClose={() => setSelectedAssessment(null)}
            />

            <div className={styles.bgDecor} aria-hidden="true">
                <div className={styles.blob1} />
                <div className={styles.blob2} />
                <div className={styles.blob3} />
            </div>

            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <div className={styles.logoRow}>
                        <SiteLogo size={32} />
                        <div>
                            <h1 className={styles.siteTitle}>
                                <span className={styles.desktopBrand}>Final Reckoning</span>
                                <span className={styles.mobileGreeting}>
                                    {getTimeAwareGreeting()}, {user?.username?.split(' ')[0] || 'there'}
                                </span>
                            </h1>
                            <p className={styles.siteSub}>
                                <span className={styles.desktopBrand}>Upcoming assessments at a glance</span>
                                <span className={styles.mobileGreeting}>
                                    {new Date().toLocaleDateString('en-AU', {
                                        weekday: 'long',
                                        day: 'numeric',
                                        month: 'long',
                                    })}
                                </span>
                            </p>
                        </div>
                    </div>
                    <div className={styles.headerRight}>
                        {lastUpdated && (
                            <span className={styles.lastUpdated}>
                                Updated{' '}
                                {lastUpdated.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}

                        <button
                            className={styles.searchBtn}
                            onClick={() => {
                                setShowSearch((open) => !open);
                                setShowHeaderMenu(false);
                            }}
                            aria-expanded={showSearch}
                            aria-controls="dashboard-search"
                        >
                            <Icon name="search" size={16} />
                            <span>Search</span>
                        </button>

                        <button
                            className={styles.menuBtn}
                            onClick={() => {
                                setShowHeaderMenu((open) => !open);
                                setShowSearch(false);
                            }}
                            aria-expanded={showHeaderMenu}
                            aria-haspopup="menu"
                        >
                            <span className={styles.desktopMenuLabel}><Icon name="menu" size={16} /> Menu</span>
                            <span className={styles.mobileMenuLabel}>•••</span>
                        </button>

                        {showSearch && (
                            <div className={styles.searchPanel} id="dashboard-search">
                                <div className={styles.searchForm}>
                                    <div className={styles.inputWrapper}>
                                        <span className={styles.inputIcon}><Icon name="search" size={16} /></span>
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            value={searchText}
                                            onChange={(e) => setSearchText(e.target.value)}
                                            placeholder="Search classes, quizzes, or semester"
                                            aria-label="Search assessments"
                                            className={styles.searchInput}
                                        />
                                    </div>
                                    <div className={styles.btnGroup}>
                                        <button
                                            type="button"
                                            onClick={handleClearFilter}
                                            disabled={loading}
                                            className={styles.btnSecondary}
                                        >
                                            Clear search
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleRefresh}
                                            disabled={loading}
                                            className={styles.btnPrimary}
                                        >
                                            {loading ? (
                                                <>
                                                    <span className={styles.spinner} /> Refreshing…
                                                </>
                                            ) : (
                                                'Refresh'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {showHeaderMenu && (
                            <>
                                <button
                                    className={styles.menuBackdrop}
                                    onClick={() => setShowHeaderMenu(false)}
                                    aria-label="Close menu"
                                />
                                <div className={styles.menuPanel} role="menu" aria-label="Dashboard menu">
                                    <div className={styles.menuProfile}>
                                        <div className={styles.menuAvatar}>
                                            {user?.username?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div className={styles.menuProfileCopy}>
                                            <strong>{user?.username || 'Canvas student'}</strong>
                                            <span>{user?.email || 'Account settings'}</span>
                                        </div>
                                    </div>
                                    <div className={styles.menuDivider} />
                                    <div className={styles.menuSection}>Workspace</div>
                                    <button
                                        className={`${styles.menuAction} ${styles.menuActionFeatured}`}
                                        onClick={() => {
                                            setShowHeaderMenu(false);
                                            setActiveTab('settings');
                                        }}
                                    >
                                        <span>
                                            <strong>Settings</strong>
                                            <br />
                                            <small>Manage Canvas and timetable</small>
                                        </span>
                                    </button>
                                    <div className={styles.menuSection}>Quick links</div>
                                    {quickLinks.map((link, index) => (
                                        <a
                                            key={`menu-${link.label}`}
                                            href={link.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={styles.menuLink}
                                            onClick={() => setShowHeaderMenu(false)}
                                        >
                                            <span>{link.label}</span>
                                            <span className={styles.menuExternal}>↗</span>
                                        </a>
                                    ))}
                                    <div className={styles.menuDivider} />
                                    <button
                                        className={styles.menuActionDanger}
                                        onClick={() => {
                                            setShowHeaderMenu(false);
                                            void handleLogout();
                                        }}
                                    >
                                        <span>Sign out</span>
                                    </button>
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
                        <button className={dashStyles.setupBannerBtn} onClick={() => setActiveTab('settings')}>
                            Open Settings
                        </button>
                        <button className={dashStyles.setupBannerClose} onClick={() => setSetupBanner('')}>
                            <Icon name="close" size={16} />
                        </button>
                    </div>
                </div>
            )}

            <main className={styles.main}>
                {activeTab !== 'settings' && (
                <div className={dashStyles.tabsAndFilter}>
                    <div className={dashStyles.tabNavigation}>
                        <div className={`${styles.tabRow} ${dashStyles.primaryTabRow}`} aria-label="Main dashboard views">
                            <button
                                className={`${styles.tabBtn} ${isAssessmentView || activeTab === 'hidden' ? styles.tabBtnActive : ''}`}
                                onClick={() => {
                                    setActiveTab('active');
                                }}
                            >
                                <Icon name="clipboard" size={16} /> Assessments
                            </button>
                            <button
                                className={`${styles.tabBtn} ${activeTab === 'calendar' ? styles.tabBtnActive : ''}`}
                                onClick={() => {
                                    setActiveTab('calendar');
                                }}
                            >
                                <Icon name="calendar" size={16} /> Calendar
                            </button>
                            <button
                                className={`${styles.tabBtn} ${activeTab === 'timetable' ? styles.tabBtnActive : ''}`}
                                onClick={() => {
                                    setActiveTab('timetable');
                                }}
                            >
                                <Icon name="clock" size={16} /> Timetable
                            </button>
                            <button
                                className={`${styles.tabBtn} ${activeTab === 'predictor' ? styles.tabBtnActive : ''}`}
                                onClick={() => {
                                    setActiveTab('predictor');
                                }}
                            >
                                <Icon name="tag" size={16} /> Result Predictor
                            </button>
                        </div>

                        {(isAssessmentView || activeTab === 'hidden') && (
                            <div className={dashStyles.secondaryNavigation}>
                                <div className={`${styles.tabRow} ${dashStyles.secondaryTabRow}`} aria-label="Assessment views">
                                    <button
                                        className={`${styles.tabBtn} ${dashStyles.secondaryTabBtn} ${activeTab === 'active' ? styles.tabBtnActive : ''}`}
                                        onClick={() => {
                                            setActiveTab('active');
                                        }}
                                    >
                                        <Icon name="clipboard" size={16} /> Upcoming
                                    </button>
                                    <button
                                        className={`${styles.tabBtn} ${dashStyles.secondaryTabBtn} ${activeTab === 'passedYear' ? styles.tabBtnActive : ''}`}
                                        onClick={() => {
                                            setActiveTab('passedYear');
                                        }}
                                    >
                                        <Icon name="check" size={16} /> Passed This Year
                                    </button>
                                    <button
                                        className={`${styles.tabBtn} ${dashStyles.secondaryTabBtn} ${activeTab === 'pastClasses' ? styles.tabBtnActive : ''}`}
                                        onClick={() => {
                                            setActiveTab('pastClasses');
                                        }}
                                    >
                                        <Icon name="folder" size={16} /> Past Classes
                                    </button>
                                    <button
                                        className={`${styles.tabBtn} ${dashStyles.secondaryTabBtn} ${activeTab === 'hidden' ? styles.tabBtnActive : ''} ${dashStyles.hiddenTab}`}
                                        onClick={() => {
                                            setActiveTab('hidden');
                                        }}
                                    >
                                        <Icon name="eye" size={16} /> Hidden
                                        {hiddenIds.size > 0 && <span className={dashStyles.hiddenBadge}>{hiddenIds.size}</span>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {isListOrCalendar && (
                        <button
                            className={`${dashStyles.filterToggleBtn} ${activeFilterCount > 0 ? dashStyles.filterToggleBtnActive : ''}`}
                            onClick={() => setSidebarOpen((o) => !o)}
                            aria-expanded={sidebarOpen}
                            aria-controls="dashboard-filters"
                        >
                            <Icon name="filter" size={16} /> Filters
                            {activeFilterCount > 0 && (
                                <span className={dashStyles.filterBadge}>{activeFilterCount}</span>
                            )}
                        </button>
                    )}
                </div>
                )}

                {error && (
                    <div className={styles.errorBanner}>
                        <span><Icon name="alert" size={16} /> {error}</span>
                        <button onClick={() => fetchDueAssessments(searchText)} className={styles.retryBtn}>
                            Retry
                        </button>
                    </div>
                )}

                <div
                    className={`${dashStyles.contentWithSidebar} ${sidebarOpen && isListOrCalendar ? dashStyles.contentWithSidebarOpen : ''}`}
                >
                    {isListOrCalendar && sidebarOpen && (
                        <FilterSidebar
                            id="dashboard-filters"
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
                                            <Icon name="trash" size={16} /> Clear all hidden ({hiddenIds.size})
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
                        {activeTab === 'predictor' && <AssessmentPredictor dueData={dueData} />}
                        {activeTab === 'settings' && (
                            <div className={dashStyles.settingsPageShell}>
                                <SettingsModal
                                    inline
                                    user={user}
                                    onClose={() => setActiveTab('active')}
                                    onSaved={(updatedUser) => {
                                        setUser(updatedUser);
                                        setSetupBanner('');
                                        setTimeout(() => {
                                            setActiveTab('active');
                                            fetchDueAssessments('');
                                        }, 800);
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
                        <a
                            key={`footer-${link.label}`}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.footerLink}
                        >
                            {link.label}
                        </a>
                    ))}
                </div>
                <p>Final Reckoning · RajLogic</p>
            </footer>
        </div>
    );
}
