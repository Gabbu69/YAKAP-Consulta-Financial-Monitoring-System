import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SapStatusControl } from '@/components/yakap/sap-status-control';

describe('SapStatusControl', () => {
    it('submits the valid default transition with reviewer context', () => {
        const onUpdate = vi.fn();
        render(<SapStatusControl currentStatus="draft" onUpdate={onUpdate} />);

        fireEvent.change(screen.getByLabelText(/transition note/i), {
            target: { value: 'Ready for finance review' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: /update batch status/i }),
        );

        expect(onUpdate).toHaveBeenCalledWith({
            status: 'submitted',
            notes: 'Ready for finance review',
        });
    });

    it('prevents further manual transitions from a terminal state', () => {
        render(<SapStatusControl currentStatus="paid" onUpdate={vi.fn()} />);

        expect(screen.getByText(/terminal status/i)).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /update batch status/i }),
        ).not.toBeInTheDocument();
    });

    it('does not offer a manual cancellation after a partial payment', () => {
        render(
            <SapStatusControl
                currentStatus="partially_paid"
                onUpdate={vi.fn()}
            />,
        );

        expect(screen.getByText(/terminal status/i)).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /update batch status/i }),
        ).not.toBeInTheDocument();
    });

    it('converts a submitted gross peso amount to integer centavos', () => {
        const onUpdate = vi.fn();
        render(
            <SapStatusControl
                currentStatus="draft"
                expectedGrossCentavos={170_000}
                onUpdate={onUpdate}
            />,
        );

        fireEvent.change(
            screen.getByLabelText('Submitted gross amount (PHP)'),
            {
                target: { value: '1600.25' },
            },
        );
        fireEvent.click(
            screen.getByRole('button', { name: /update batch status/i }),
        );

        expect(onUpdate).toHaveBeenCalledWith({
            status: 'submitted',
            notes: '',
            submitted_gross_centavos: 160_025,
        });
    });

    it('disables the transition action while processing', () => {
        render(
            <SapStatusControl
                currentStatus="submitted"
                processing
                onUpdate={vi.fn()}
            />,
        );

        expect(
            screen.getByRole('button', { name: /update batch status/i }),
        ).toBeDisabled();
    });

    it('shows server field errors beside the affected transition field', () => {
        render(
            <SapStatusControl
                currentStatus="submitted"
                submittedGrossCentavos={100_000}
                errors={{
                    approved_gross_centavos:
                        'The approved gross amount is invalid.',
                }}
                onUpdate={vi.fn()}
            />,
        );

        const input = screen.getByLabelText('Approved gross amount (PHP)');

        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(
            screen.getByText('The approved gross amount is invalid.'),
        ).toHaveAttribute('role', 'alert');
    });
});
