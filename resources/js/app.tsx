import { createInertiaApp } from '@inertiajs/react';
import '@fontsource-variable/inter';
import '@fontsource-variable/manrope';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';

const appName =
    import.meta.env.VITE_APP_NAME ||
    'YAKAP Consulta Financial Monitoring System';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
                return null;
            case name.startsWith('auth/'):
                return AuthLayout;
            case [
                'settings/profile',
                'settings/security',
                'settings/appearance',
            ].includes(name):
                return [AppLayout, SettingsLayout];
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return <TooltipProvider delayDuration={0}>{app}</TooltipProvider>;
    },
    progress: {
        color: '#276f69',
    },
});

// This will set light / dark mode on load...
initializeTheme();
