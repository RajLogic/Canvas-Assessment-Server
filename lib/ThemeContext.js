import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'light', toggleTheme: () => { } });

function getInitialTheme() {
    if (typeof window === 'undefined') return 'light';

    const saved = localStorage.getItem('ct_theme');
    if (saved === 'dark' || saved === 'light') {
        return saved;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(getInitialTheme);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('ct_theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}