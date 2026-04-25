import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext({
    theme: 'light',
    themeMode: 'system',
    setThemeMode: () => { },
    toggleTheme: () => { },
});

const THEME_MODES = ['light', 'dark', 'system'];

function resolveSystemTheme() {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
l
function getInitialThemeMode() {
    if (typeof window === 'undefined') return 'system';
    const savedMode = localStorage.getItem('ct_theme_mode');
    const savedLegacyTheme = localStorage.getItem('ct_theme');

    if (THEME_MODES.includes(savedMode)) return savedMode;
    if (savedLegacyTheme === 'dark' || savedLegacyTheme === 'light') return savedLegacyTheme;
    return 'system';
}

export function ThemeProvider({ children }) {
    const [themeMode, setThemeMode] = useState(getInitialThemeMode);
    const [systemTheme, setSystemTheme] = useState(resolveSystemTheme);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const listener = (event) => setSystemTheme(event.matches ? 'dark' : 'light');

        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', listener);
        } else {
            media.addListener(listener);
        }

        return () => {
            if (typeof media.removeEventListener === 'function') {
                media.removeEventListener('change', listener);
            } else {
                media.removeListener(listener);
            }
        };
    }, []);

    const theme = useMemo(() => {
        if (themeMode === 'system') return systemTheme;
        return themeMode;
    }, [themeMode, systemTheme]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('ct_theme_mode', themeMode);
        localStorage.setItem('ct_theme', theme);
    }, [theme, themeMode]);

    const toggleTheme = () => {
        setThemeMode((current) => {
            const idx = THEME_MODES.indexOf(current);
            return THEME_MODES[(idx + 1) % THEME_MODES.length];
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}