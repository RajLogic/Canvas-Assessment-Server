import '../styles/globals.css';
import Head from 'next/head';
import { ThemeProvider } from '../lib/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import styles from '../styles/AppShell.module.css';

export default function MyApp({ Component, pageProps }) {
    return (
        <ThemeProvider>
            <Head>
                <title>Final Reckoning</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <Component {...pageProps} />
            <div className={styles.floatingToggle}>
                <ThemeToggle />
            </div>
        </ThemeProvider>
    );
}