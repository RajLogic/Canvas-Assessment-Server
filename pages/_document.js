import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
    return (
        <Html lang="en">
            <Head>
                <meta charSet="utf-8" />
                <meta name="description" content="Canvas Assessment Tracker — upcoming assessments at a glance" />
                <link rel="icon" href="/hell.png" />

            </Head>
            <body>
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}