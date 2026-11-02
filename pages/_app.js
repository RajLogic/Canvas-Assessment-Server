import '../styles/globals.css';
import Head from 'next/head';
import PropTypes from 'prop-types';

export default function MyApp({ Component, pageProps }) {
    return (
        <>
            <Head>
                <title>Final Reckoning</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <Component {...pageProps} />
        </>
    );
}

MyApp.propTypes = {
    Component: PropTypes.elementType.isRequired,
    pageProps: PropTypes.object,
};