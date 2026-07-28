import type { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg
            {...props}
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path
                d="M24 42C14.4 42 7 34.55 7 25.2V8.8c0-1.16.94-2.1 2.1-2.1h29.8c1.16 0 2.1.94 2.1 2.1v16.4C41 34.55 33.6 42 24 42Z"
                fill="currentColor"
                opacity=".15"
            />
            <path
                d="M24 42C14.4 42 7 34.55 7 25.2V8.8c0-1.16.94-2.1 2.1-2.1h29.8c1.16 0 2.1.94 2.1 2.1v16.4C41 34.55 33.6 42 24 42Z"
                stroke="currentColor"
                strokeWidth="2.5"
            />
            <path
                d="M17 26.5h14M17 32h9"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
            <path
                d="M24 22c-5.2-2.7-7.5-5.25-7.5-8.05 0-2.1 1.55-3.7 3.65-3.7 1.65 0 2.9.9 3.85 2.25.95-1.35 2.2-2.25 3.85-2.25 2.1 0 3.65 1.6 3.65 3.7 0 2.8-2.3 5.35-7.5 8.05Z"
                fill="currentColor"
            />
        </svg>
    );
}
