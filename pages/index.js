import React, { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
    const [dueData, setDueData] = useState({ terms: [], totalAssessments: 0 });
    const [termFilter, setTermFilter] = useState('First semester 2026');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchDueAssessments = async () => {
        setLoading(true);
        setError(null);
        try {
            const query = termFilter.trim() ? `?term=${encodeURIComponent(termFilter.trim())}` : '';
            const response = await fetch(`/api/assessments/due${query}`);
            if (!response.ok) throw new Error('Failed to fetch due assessments');
            const data = await response.json();
            setDueData(data);
        } catch (err) {
            setError(err.message);
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDueAssessments();
    }, []);

    const formatDueDate = (dateString) => {
        return new Date(dateString).toLocaleString('en-AU', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleFilterSubmit = (event) => {
        event.preventDefault();
        fetchDueAssessments();
    };

    const clearFilter = () => {
        setTermFilter('');
        setLoading(true);
        setError(null);

        fetch('/api/assessments/due')
            .then((response) => {
                if (!response.ok) throw new Error('Failed to fetch due assessments');
                return response.json();
            })
            .then((data) => setDueData(data))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    };

    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <h1 className={styles.title}>Canvas Assessment Server</h1>

                <p className={styles.description}>
                    View upcoming assessments sorted by due date and grouped by semester and class
                </p>

                <div className={styles.grid}>
                    <div className={styles.card}>
                        <h2>Due Assessments &rarr;</h2>
                        <p>Filter by active semester (for example: First semester 2026)</p>

                        <form className={styles.filterForm} onSubmit={handleFilterSubmit}>
                            <input
                                type="text"
                                value={termFilter}
                                onChange={(event) => setTermFilter(event.target.value)}
                                placeholder="e.g. First semester 2026"
                                className={styles.input}
                            />
                            <div className={styles.buttonRow}>
                                <button type="submit" disabled={loading}>
                                    {loading ? 'Loading...' : 'Apply Filter'}
                                </button>
                                <button type="button" onClick={clearFilter} disabled={loading} className={styles.secondaryButton}>
                                    Show All
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className={styles.card}>
                        <h2>API Endpoint &rarr;</h2>
                        <code>/api/assessments/due</code> - Upcoming due assessments
                        <br />
                        <code>/api/assessments/due?term=First semester 2026</code>
                    </div>
                </div>

                {error && (
                    <div className={styles.error}>
                        <p>Error: {error}</p>
                    </div>
                )}

                {!loading && dueData.terms?.length === 0 && !error && (
                    <div className={styles.emptyState}>
                        <p>No upcoming assessments found for this filter.</p>
                    </div>
                )}

                {dueData.terms?.length > 0 && (
                    <div className={styles.coursesList}>
                        <h2>
                            Upcoming Assessments ({dueData.totalAssessments})
                        </h2>

                        {dueData.terms.map((termSection) => (
                            <section key={termSection.termName} className={styles.termSection}>
                                <h3 className={styles.termTitle}>
                                    {termSection.termName} ({termSection.totalAssessments})
                                </h3>

                                {termSection.courses.map((course) => (
                                    <div key={course.courseId} className={styles.courseSection}>
                                        <h4 className={styles.courseTitle}>
                                            {course.courseName} ({course.totalAssessments})
                                        </h4>

                                        <ul className={styles.assessmentList}>
                                            {course.assessments.map((assessment) => (
                                                <li key={assessment.id} className={styles.assessmentItem}>
                                                    <div>
                                                        <strong>{assessment.name}</strong>
                                                        {assessment.pointsPossible !== null && assessment.pointsPossible !== undefined && (
                                                            <span className={styles.points}> • {assessment.pointsPossible} pts</span>
                                                        )}
                                                    </div>
                                                    <div className={styles.dueDate}>
                                                        Due: {formatDueDate(assessment.dueAt)}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </section>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
