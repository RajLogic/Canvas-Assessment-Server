import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
    return (
        <Html lang="en">
            <Head>
                <meta charSet="utf-8" />
                <meta name="description" content="Final Reckoning — upcoming assessments at a glance" />
                <link rel="icon" href="/hell.png" />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function () {
                                if (typeof window === 'undefined') return;
                                if (!window.ethereum) {
                                    window.ethereum = { selectedAddress: undefined };
                                }
                            })();
                        `,
                    }}
                />

            </Head>
            <body>
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}