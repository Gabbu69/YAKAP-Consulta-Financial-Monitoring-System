import type { Auth } from '@/types/auth';
import type { Facility } from '@/types/yakap';

declare module 'react' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            sidebarOpen: boolean;
            facility?: Facility | null;
            demoMode?: boolean;
            flash?: {
                success?: string | null;
                error?: string | null;
            };
            [key: string]: unknown;
        };
    }
}
