import { useTheme } from '../lib/ThemeContext';
import { useEffect, useState } from 'react';
import styles from '../styles/ThemeToggle.module.css';

export default function ThemeToggle() {
    const { theme, themeMode, cycleThemeMode } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);

    if (!mounted) return null; // 🔥 prevents hydration mismatch

    const isDark = theme === 'dark';

    const modeLabel =
        themeMode === 'system' ? 'System' :
            themeMode === 'dark' ? 'Dark' : 'Light';

    const modeIcon =
        themeMode === 'system' ? '🖥️' :
            isDark ? '🌙' : '☀️';

    const nextModeLabel =
        themeMode === 'light' ? 'Dark' :
            themeMode === 'dark' ? 'System' : 'Light';

    return (
        <button
            className={styles.toggle}
            onClick={cycleThemeMode}
            aria-label={`Theme mode: ${modeLabel}. Switch to ${nextModeLabel} mode`}
            title={`Theme mode: ${modeLabel}. Click to switch to ${nextModeLabel}`}
        >
            <span className={styles.track}>
                <span className={`${styles.thumb} ${isDark ? styles.thumbDark : ''}`} />
            </span>
            <span className={styles.modeLabel}>{modeLabel}</span>
            <span className={styles.icon} aria-hidden="true">
                {modeIcon}
            </span>
        </button>
    );
}