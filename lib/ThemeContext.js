import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
    theme: 'light',
    themeMode: 'system',
    toggleTheme: () => { },
    setThemeMode: () => { },
    cycleThemeMode: () => { },
});

function getSystemPrefersDark() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getInitialThemeMode() {
    if (typeof window === 'undefined') return 'system';

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
    const theme = themeMode === 'system' ? (prefersDark ? 'dark' : 'light') : themeMode;

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (event) => {
            setPrefersDark(event.matches);
        };
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('ct_theme_mode', themeMode);
        localStorage.setItem('ct_theme', theme);
    }, [theme, themeMode]);

    const toggleTheme = () => {
        setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'));
    };

    const cycleThemeMode = () => {
        setThemeMode((current) => {
            if (current === 'light') return 'dark';
            if (current === 'dark') return 'system';
            return 'light';
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, themeMode, toggleTheme, setThemeMode, cycleThemeMode }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}