import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    createEncounterItem,
    EncounterComposer,
    encounterItemsTotal,
} from '@/components/yakap/encounter-composer';
import type { ServiceOption } from '@/components/yakap/encounter-composer';

const services: ServiceOption[] = [
    {
        id: 1,
        code: 'CONS-01',
        name: 'Primary care consultation',
        classification: 'consultation',
        unit: 'encounter',
        default_cost_centavos: 25_000,
        is_active: true,
    },
    {
        id: 2,
        code: 'LAB-01',
        name: 'Fasting blood sugar',
        classification: 'laboratory',
        unit: 'test',
        default_cost_centavos: 18_000,
        is_active: true,
    },
];

describe('EncounterComposer', () => {
    it('calculates a centavo-safe encounter total from catalog snapshots', () => {
        const items = [
            createEncounterItem({ service_id: '1', quantity: 2 }),
            createEncounterItem({ service_id: '2', quantity: 1 }),
        ];

        expect(encounterItemsTotal(items, services)).toBe(68_000);
    });

    it('renders the formatted total and adds a service line', () => {
        const onChange = vi.fn();
        const item = createEncounterItem({ service_id: '1', quantity: 2 });

        render(
            <EncounterComposer
                services={services}
                items={[item]}
                onChange={onChange}
            />,
        );

        expect(screen.getAllByText('₱500.00')).toHaveLength(2);
        fireEvent.click(
            screen.getByRole('button', { name: /add service line/i }),
        );

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0]).toHaveLength(2);
    });

    it('disables additional lines when no active service is available', () => {
        render(
            <EncounterComposer
                services={services.map((service) => ({
                    ...service,
                    is_active: false,
                }))}
                items={[createEncounterItem()]}
                onChange={vi.fn()}
            />,
        );

        expect(screen.getByText('No active services')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /add service line/i }),
        ).toBeDisabled();
    });
});
