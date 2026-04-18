import { useTheme } from '../lib/ThemeContext';
import styles from '../styles/ThemeToggle.module.css';

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <button
            className={styles.toggle}
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
        >
            <span className={styles.track}>
                <span className={`${styles.thumb} ${isDark ? styles.thumbDark : ''}`} />
            </span>
            <span className={styles.icon} aria-hidden="true">
                {isDark ? '🌙' : '☀️'}
            </span>
        </button>
    );
}