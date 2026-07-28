import { usePage } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { FlashToast } from '@/types/ui';

type FlashPayload = {
    success?: string | null;
    error?: string | null;
    toast?: FlashToast | null;
};

export function useFlashToast(): void {
    const flash = (usePage().props.flash ?? {}) as FlashPayload;
    const lastMessage = useRef<string | null>(null);

    useEffect(() => {
        const legacy = flash.toast;
        const message = legacy?.message ?? flash.success ?? flash.error ?? null;

        if (!message || message === lastMessage.current) {
            return;
        }

        lastMessage.current = message;

        if (legacy) {
            toast[legacy.type](legacy.message);
        } else if (flash.error) {
            toast.error(flash.error);
        } else {
            toast.success(message);
        }
    }, [flash.error, flash.success, flash.toast]);
}
