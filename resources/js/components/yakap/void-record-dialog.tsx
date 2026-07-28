import { useForm } from '@inertiajs/react';
import { Ban, LoaderCircle } from 'lucide-react';
import { useId, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function VoidRecordDialog({
    endpoint,
    recordType,
    reference,
}: {
    endpoint: string;
    recordType: 'payment' | 'co-payment';
    reference: string;
}) {
    const [open, setOpen] = useState(false);
    const reasonId = useId();
    const form = useForm({ reason: '' });
    const validReason = form.data.reason.trim().length >= 5;
    const errorId = `${reasonId}-error`;
    const helpId = `${reasonId}-help`;
    const voidErrors = form.errors as Record<string, string | undefined>;
    const voidError =
        voidErrors.reason ??
        voidErrors.payment ??
        voidErrors.copayment ??
        voidErrors.general;

    const close = () => {
        setOpen(false);
        form.reset();
        form.clearErrors();
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    setOpen(true);
                } else {
                    close();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                    <Ban className="size-3.5" />
                    Void
                    <span className="sr-only">
                        {' '}
                        {recordType} {reference}
                    </span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();

                        if (!validReason) {
                            return;
                        }

                        form.patch(endpoint, {
                            preserveScroll: true,
                            onSuccess: close,
                        });
                    }}
                    className="space-y-5"
                >
                    <DialogHeader>
                        <DialogTitle>
                            Void {recordType} {reference}?
                        </DialogTitle>
                        <DialogDescription>
                            This preserves the original record and excludes it
                            from active financial totals. The action and reason
                            are written to the audit log.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                        <Label htmlFor={reasonId}>Reason for voiding</Label>
                        <Textarea
                            id={reasonId}
                            value={form.data.reason}
                            onChange={(event) =>
                                form.setData('reason', event.target.value)
                            }
                            placeholder="Explain the correction in at least 5 characters"
                            minLength={5}
                            maxLength={500}
                            rows={4}
                            aria-describedby={`${helpId}${voidError ? ` ${errorId}` : ''}`}
                            aria-invalid={Boolean(voidError)}
                            required
                            autoFocus
                        />
                        <p
                            id={helpId}
                            className="text-xs leading-5 text-muted-foreground"
                        >
                            Use at least 5 characters. The reason becomes part
                            of the permanent audit history.
                        </p>
                        <InputError
                            id={errorId}
                            role="alert"
                            aria-live="polite"
                            message={voidError}
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Keep record
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={form.processing || !validReason}
                        >
                            {form.processing ? (
                                <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                            ) : (
                                <Ban className="size-4" />
                            )}
                            Void {recordType}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
