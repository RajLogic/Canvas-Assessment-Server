import { useEffect } from 'react';

function MyApp({ Component, pageProps }) {
    useEffect(() => {
        // Initialize app
        console.log('Canvas Assessment Server loaded');
    }, []);

    return <Component {...pageProps} />;
}

export default MyApp;
