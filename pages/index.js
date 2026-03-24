import React, { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchCourses = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/courses');
            if (!response.ok) throw new Error('Failed to fetch courses');
            const data = await response.json();
            setCourses(data);
        } catch (err) {
            setError(err.message);
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCourses();
    }, []);

    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <h1 className={styles.title}>Canvas Assessment Server</h1>

                <p className={styles.description}>
                    A Next.js powered backend application for fetching Canvas course data
                </p>

                <div className={styles.grid}>
                    <div className={styles.card}>
                        <h2>Courses API &rarr;</h2>
                        <p>Access Canvas course data through the API endpoints</p>
                        <button onClick={fetchCourses} disabled={loading}>
                            {loading ? 'Loading...' : 'Fetch Courses'}
                        </button>
                    </div>

                    <div className={styles.card}>
                        <h2>API Endpoints &rarr;</h2>
                        <code>/api/courses</code> - Get all courses
                        <br />
                        <code>/api/courses/[courseId]/assignments</code> - Get assignments for a course
                    </div>
                </div>

                {error && (
                    <div className={styles.error}>
                        <p>Error: {error}</p>
                    </div>
                )}

                {courses.length > 0 && (
                    <div className={styles.coursesList}>
                        <h2>Courses ({courses.length})</h2>
                        <ul>
                            {courses.map((course) => (
                                <li key={course.id}>
                                    <strong>{course.name}</strong> (ID: {course.id})
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </main>
        </div>
    );
}
