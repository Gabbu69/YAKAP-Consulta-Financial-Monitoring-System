import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import AlertError from '@/components/alert-error';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { titleCase, toCentavos, toPesoInput } from '@/lib/yakap';

const statusTransitions: Record<string, string[]> = {
    draft: ['submitted', 'cancelled'],
    submitted: ['approved', 'returned', 'cancelled'],
    approved: ['cancelled'],
    partially_paid: [],
    returned: ['submitted', 'cancelled'],
    paid: [],
    cancelled: [],
};

export type SapStatusUpdate = {
    status: string;
    notes: string;
    submitted_gross_centavos?: number;
    approved_gross_centavos?: number;
};

export function SapStatusControl({
    currentStatus,
    expectedGrossCentavos,
    submittedGrossCentavos,
    processing = false,
    errors = {},
    onUpdate,
}: {
    currentStatus: string;
    expectedGrossCentavos?: number;
    submittedGrossCentavos?: number;
    processing?: boolean;
    errors?: Record<string, string | undefined>;
    onUpdate: (update: SapStatusUpdate) => void;
}) {
    const options = statusTransitions[currentStatus] ?? [];
    const [status, setStatus] = useState(options[0] ?? '');
    const [notes, setNotes] = useState('');
    const initialGrossCentavos =
        options[0] === 'submitted'
            ? expectedGrossCentavos
            : options[0] === 'approved'
              ? submittedGrossCentavos
              : undefined;
    const [grossPesos, setGrossPesos] = useState(() =>
        initialGrossCentavos === undefined
            ? ''
            : toPesoInput(initialGrossCentavos),
    );
    const configuredGrossCentavos =
        status === 'submitted'
            ? expectedGrossCentavos
            : status === 'approved'
              ? submittedGrossCentavos
              : undefined;
    const requiresGrossAmount = configuredGrossCentavos !== undefined;
    const grossCentavos = toCentavos(grossPesos);
    const grossAmountInvalid = requiresGrossAmount && grossCentavos < 1;
    const grossField =
        status === 'submitted'
            ? 'submitted_gross_centavos'
            : 'approved_gross_centavos';
    const grossError =
        errors[grossField] ??
        (grossAmountInvalid
            ? 'Enter a gross amount greater than zero.'
            : undefined);
    const fieldErrorKeys = new Set([
        'status',
        'notes',
        'submitted_gross_centavos',
        'approved_gross_centavos',
    ]);
    const generalErrors = Object.entries(errors)
        .filter(([key]) => !fieldErrorKeys.has(key))
        .map(([, error]) => error)
        .filter((error): error is string => Boolean(error));

    const changeStatus = (nextStatus: string) => {
        setStatus(nextStatus);

        const nextGrossCentavos =
            nextStatus === 'submitted'
                ? expectedGrossCentavos
                : nextStatus === 'approved'
                  ? submittedGrossCentavos
                  : undefined;
        setGrossPesos(
            nextGrossCentavos === undefined
                ? ''
                : toPesoInput(nextGrossCentavos),
        );
    };

    if (options.length === 0) {
        return (
            <p className="text-sm leading-6 text-muted-foreground">
                This batch is in a terminal status and has no further manual
                transitions.
            </p>
        );
    }

    return (
        <form
            className="space-y-4"
            onSubmit={(event) => {
                event.preventDefault();

                if (status) {
                    const update: SapStatusUpdate = { status, notes };

                    if (status === 'submitted' && requiresGrossAmount) {
                        update.submitted_gross_centavos = grossCentavos;
                    }

                    if (status === 'approved' && requiresGrossAmount) {
                        update.approved_gross_centavos = grossCentavos;
                    }

                    onUpdate(update);
                }
            }}
        >
            {generalErrors.length > 0 ? (
                <AlertError
                    errors={generalErrors}
                    title="Batch status was not updated."
                />
            ) : null}
            <div className="grid gap-2">
                <Label htmlFor="sap-next-status">New batch status</Label>
                <Select value={status} onValueChange={changeStatus}>
                    <SelectTrigger
                        id="sap-next-status"
                        className="w-full"
                        aria-label="New batch status"
                        aria-describedby={
                            errors.status ? 'sap-next-status-error' : undefined
                        }
                        aria-invalid={Boolean(errors.status)}
                    >
                        <SelectValue placeholder="Choose a status" />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((option) => (
                            <SelectItem key={option} value={option}>
                                {titleCase(option)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <InputError
                    id="sap-next-status-error"
                    role="alert"
                    aria-live="polite"
                    message={errors.status}
                />
            </div>
            {requiresGrossAmount ? (
                <div className="grid gap-2">
                    <Label htmlFor="sap-gross-amount">
                        {status === 'submitted'
                            ? 'Submitted gross amount (PHP)'
                            : 'Approved gross amount (PHP)'}
                    </Label>
                    <Input
                        id="sap-gross-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        value={grossPesos}
                        onChange={(event) => setGrossPesos(event.target.value)}
                        aria-describedby={`sap-gross-amount-help${grossError ? ' sap-gross-amount-error' : ''}`}
                        aria-invalid={Boolean(grossError)}
                        required
                    />
                    <p
                        id="sap-gross-amount-help"
                        className="text-xs leading-5 text-muted-foreground"
                    >
                        Confirm the actual gross amount for variance tracking.
                        It is stored as integer centavos.
                    </p>
                    <InputError
                        id="sap-gross-amount-error"
                        role="alert"
                        aria-live="polite"
                        message={grossError}
                    />
                </div>
            ) : null}
            <div className="grid gap-2">
                <Label htmlFor="sap-status-reason">
                    Transition note{' '}
                    <span className="font-normal text-muted-foreground">
                        (optional)
                    </span>
                </Label>
                <Textarea
                    id="sap-status-reason"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Add context for finance reviewers"
                    rows={3}
                    aria-describedby={
                        errors.notes ? 'sap-status-reason-error' : undefined
                    }
                    aria-invalid={Boolean(errors.notes)}
                />
                <InputError
                    id="sap-status-reason-error"
                    role="alert"
                    aria-live="polite"
                    message={errors.notes}
                />
            </div>
            <Button
                type="submit"
                disabled={processing || !status || grossAmountInvalid}
            >
                {processing ? (
                    <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                ) : (
                    <ArrowRight className="size-4" />
                )}
                Update batch status
            </Button>
        </form>
    );
}
