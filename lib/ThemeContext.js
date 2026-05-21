import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

const ThemeContext = createContext({
    theme: 'light',
    themeMode: 'system',
    toggleTheme: () => { },
    setThemeMode: () => { },
    cycleThemeMode: () => { },
});

function getSystemPrefersDark() {
    if (globalThis.window === undefined) return false;
    return globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getInitialThemeMode() {
    if (globalThis.window === undefined) return 'system';

    const savedMode = localStorage.getItem('ct_theme_mode');
    if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
        return savedMode;
    }

    // Backward compatibility for older versions that persisted only ct_theme.
    const saved = localStorage.getItem('ct_theme');
    if (saved === 'dark' || saved === 'light') {
        return saved;
    }

    return 'system';
}

export function ThemeProvider({ children }) {
    const [themeMode, setThemeMode] = useState(getInitialThemeMode);
    const [prefersDark, setPrefersDark] = useState(getSystemPrefersDark);
    let theme;
    if (themeMode === 'system') {
        theme = prefersDark ? 'dark' : 'light';
    } else {
        theme = themeMode;
    }

    useEffect(() => {
        if (globalThis.window === undefined) return undefined;
        const media = globalThis.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (event) => {
            setPrefersDark(event.matches);
        };
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('ct_theme_mode', themeMode);
        localStorage.setItem('ct_theme', theme);
    }, [theme, themeMode]);

    const toggleTheme = () => {
        setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'));
    };

    const cycleThemeMode = () => {
        setThemeMode((current) => {
            if (current === 'light') return 'dark';
            return 'light';
        });
    };

    const value = useMemo(
        () => ({ theme, themeMode, toggleTheme, setThemeMode, cycleThemeMode }),
        [theme, themeMode],
    );

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}

ThemeProvider.propTypes = {
    children: PropTypes.node,
};