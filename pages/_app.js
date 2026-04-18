import '../styles/globals.css';
import { ThemeProvider } from '../lib/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import styles from '../styles/AppShell.module.css';

export default function MyApp({ Component, pageProps }) {
    return (
        <ThemeProvider>
            <Component {...pageProps} />
            <div className={styles.floatingToggle}>
                <ThemeToggle />
            </div>
        </ThemeProvider>
    );
}