import React, { useState, useEffect, useCallback, memo } from 'react';
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

const UrgencyBadge = memo(function UrgencyBadge({ dueTimestamp }) {
    const urgency = getUrgency(dueTimestamp);
    const label = urgency === 'urgent' ? '≤5 days' : urgency === 'warning' ? '≤2 weeks' : '>2 weeks';
    return (
        <span className={`${styles.badge} ${styles[`badge_${urgency}`]}`}>
            {urgency === 'urgent' ? '🔴' : urgency === 'warning' ? '🟡' : '🟢'} {label}
        </span>
    );
});

// ─── LIST VIEW ─────────────────────────────────────────────────────────────

const AssessmentCard = memo(function AssessmentCard({ assessment }) {
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

const ListView = memo(function ListView({ dueData, urgencyFilter, setUrgencyFilter }) {
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
});

// ─── CALENDAR VIEW ─────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const QUICK_LINKS = [
    { label: 'Canvas', href: 'https://rmit.instructure.com/' },
    { label: 'Timetable', href: 'https://mytimetable.rmit.edu.au/even/student' },
    { label: 'GitHub', href: 'https://github.com/RajLogic/Canvas-Assessment-Server' },
];

const CalendarView = memo(function CalendarView({ dueData }) {
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
});

// ─── TIMETABLE VIEW ───────────────────────────────────────────────────────────

const TIMETABLE_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#22c55e', '#10b981',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#a855f7',
];

function getSubjectColor(subjectName, index) {
    if (!subjectName) return TIMETABLE_COLORS[index % TIMETABLE_COLORS.length];
    const hash = subjectName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return TIMETABLE_COLORS[hash % TIMETABLE_COLORS.length];
}

function getWeekDates() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(date.getDate() + i);
        weekDates.push(date);
    }
    return weekDates;
}

const TimetableView = memo(function TimetableView({ timetableEvents, timetableLoading, timetableError, onFetchTimetable }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDateKey, setSelectedDateKey] = useState(null);

    const handleSync = () => {
        onFetchTimetable();
    };

    const toDateKey = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formatDateLabel = (date) => {
        return date.toLocaleDateString('en-AU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
        setSelectedDateKey(null);
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
        setSelectedDateKey(null);
    };

    const handleToday = () => {
        const today = new Date();
        setCurrentMonth(today);
        setSelectedDateKey(toDateKey(today));
    };

    const groupEventsByDate = () => {
        const grouped = {};
        timetableEvents
            .sort((a, b) => new Date(a.start) - new Date(b.start))
            .forEach((event) => {
                const date = new Date(event.start);
                const dateKey = toDateKey(date);
                if (!grouped[dateKey]) {
                    grouped[dateKey] = {
                        label: formatDateLabel(date),
                        events: [],
                    };
                }
                grouped[dateKey].events.push(event);
            });
        return grouped;
    };

    const getDaysInMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const renderCalendarGrid = (groupedEvents) => {
        const daysInMonth = getDaysInMonth(currentMonth);
        const firstDay = getFirstDayOfMonth(currentMonth);
        const days = [];
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === currentMonth.getFullYear() && today.getMonth() === currentMonth.getMonth();
        const todayDate = isCurrentMonth ? today.getDate() : -1;

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className={styles.calEmptyDay}></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const isToday = day === todayDate;
            const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
            const dayKey = toDateKey(dayDate);
            const isSelected = selectedDateKey === dayKey;
            const hasEvents = Boolean(groupedEvents[dayKey]?.events?.length);
            days.push(
                <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDateKey((prev) => (prev === dayKey ? null : dayKey))}
                    className={`${styles.calDay} ${isToday ? styles.calDayToday : ''} ${isSelected ? styles.calDaySelected : ''} ${hasEvents ? styles.calDayHasEvents : ''}`}
                    title={formatDateLabel(dayDate)}
                >
                    {day}
                </button>
            );
        }

        return days;
    };

    const groupedEvents = groupEventsByDate();
    const visibleDateEntries = selectedDateKey
        ? [[
            selectedDateKey,
            groupedEvents[selectedDateKey] || {
                label: formatDateLabel(new Date(
                    Number(selectedDateKey.slice(0, 4)),
                    Number(selectedDateKey.slice(5, 7)) - 1,
                    Number(selectedDateKey.slice(8, 10)),
                )),
                events: [],
            },
        ]]
        : Object.entries(groupedEvents);

    return (
        <div className={styles.timetableWrap}>
            {/* Sync button */}
            <div className={styles.syncButtonWrap}>
                <button onClick={handleSync} disabled={timetableLoading} className={styles.btnSync}>
                    {timetableLoading ? 'Syncing...' : '🔄 Sync Timetable'}
                </button>
            </div>

            {timetableError && (
                <div className={styles.errorBanner}>
                    <span>⚠️ {timetableError}</span>
                </div>
            )}

            {timetableLoading && (
                <div className={styles.loadingWrap}>
                    <span className={styles.spinnerLarge} />
                    <p className={styles.loadingText}>Syncing timetable…</p>
                </div>
            )}

            {!timetableLoading && timetableEvents.length > 0 && (
                <>
                    {/* Calendar Header */}
                    <div className={styles.calendarHeaderWrap}>
                        <div className={styles.calMonthNav}>
                            <button onClick={handlePrevMonth} className={styles.calNavBtn}>❮</button>
                            <div className={styles.calMonthLabel}>
                                {currentMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
                            </div>
                            <button onClick={handleNextMonth} className={styles.calNavBtn}>❯</button>
                            <button onClick={handleToday} className={styles.calTodayBtn}>Today</button>
                        </div>

                        {/* Mini calendar grid */}
                        <div className={styles.miniCalendar}>
                            <div className={styles.calDayHeaders}>
                                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
                                    <div key={day} className={styles.calHeaderDay}>{day}</div>
                                ))}
                            </div>
                            <div className={styles.calDaysGrid}>
                                {renderCalendarGrid(groupedEvents)}
                            </div>
                        </div>
                    </div>

                    {/* Events List */}
                    <div className={styles.eventsListWrapper}>
                        {selectedDateKey && (
                            <p className={styles.selectedDayHint}>
                                Showing classes for {visibleDateEntries[0][1].label}
                            </p>
                        )}
                        {visibleDateEntries.map(([dateKey, dayGroup]) => (
                            <div key={dateKey} className={styles.dateGroup}>
                                <h3 className={styles.dateGroupTitle}>{dayGroup.label}</h3>
                                <div className={styles.eventsList}>
                                    {dayGroup.events.map((event, idx) => {
                                        const startTime = new Date(event.start);
                                        const endTime = new Date(event.end);
                                        const durationMs = endTime - startTime;
                                        const durationHours = Math.round(durationMs / (1000 * 60 * 60) * 10) / 10;
                                        return (
                                            <div key={idx} className={styles.eventCard}>
                                                <div className={styles.eventTimeSection}>
                                                    <div className={styles.eventStartTime}>
                                                        {startTime.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                    </div>
                                                    <div className={styles.eventDuration}>
                                                        {durationHours} hr
                                                    </div>
                                                </div>
                                                <div className={styles.eventDetailsSection}>
                                                    <div className={styles.eventName}>{event.summary}</div>
                                                    <div className={styles.eventMeta}>
                                                        {event.location || <span>-</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {dayGroup.events.length === 0 && (
                                        <div className={styles.eventEmptyState}>No classes running on this day.</div>
                                    )}
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
                    <p className={styles.emptySub}>Your timetable is synced but no events found.</p>
                </div>
            )}
        </div>
    );
});

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function Home() {
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

    const fetchDueAssessments = useCallback(async (queryText = '') => {
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
    }, []);

    useEffect(() => { fetchDueAssessments(''); }, [fetchDueAssessments]);

    const handleSubmit = (e) => { e.preventDefault(); fetchDueAssessments(searchText); };
    const handleClearFilter = () => { setSearchText(''); fetchDueAssessments(''); };

    const fetchTimetableData = useCallback(async () => {
        setTimetableLoading(true);
        setTimetableError('');
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
        } catch (err) {
            setTimetableError(err.message || 'Failed to sync timetable');
            setTimetableEvents([]);
        } finally {
            setTimetableLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'timetable') {
            fetchTimetableData();
        }
    }, [activeTab, fetchTimetableData]);

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
                    <div className={styles.headerRight}>
                        <nav className={styles.topLinks} aria-label="Quick links">
                            {QUICK_LINKS.map((link) => (
                                <a
                                    key={link.label}
                                    href={link.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.topLink}
                                >
                                    {link.label}
                                </a>
                            ))}
                        </nav>
                        {lastUpdated && (
                            <span className={styles.lastUpdated}>
                                Updated {lastUpdated.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>
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
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'timetable' ? styles.tabBtnActive : ''}`}
                        onClick={() => setActiveTab('timetable')}
                    >
                        🕐 Timetable
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
                {!loading && !error && activeTab !== 'timetable' && (
                    activeTab === 'list'
                        ? <ListView dueData={dueData} urgencyFilter={urgencyFilter} setUrgencyFilter={setUrgencyFilter} />
                        : <CalendarView dueData={dueData} />
                )}
                {activeTab === 'timetable' && (
                    <TimetableView
                        timetableEvents={timetableEvents}
                        timetableLoading={timetableLoading}
                        timetableError={timetableError}
                        onFetchTimetable={fetchTimetableData}
                    />
                )}
            </main>

            <footer className={styles.footer}>
                <div className={styles.footerLinks}>
                    {QUICK_LINKS.map((link) => (
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
                <p>Canvas Assessment Tracker • RajLogic</p>
            </footer>
        </div>
    );
}