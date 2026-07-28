export type Money = number;

export type Paginator<T> = {
    data: T[];
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
    from?: number | null;
    to?: number | null;
    links?: Array<{
        url: string | null;
        label: string;
        active: boolean;
    }>;
};

export type PaginatedOrArray<T> = Paginator<T> | T[];

export type Facility = {
    id?: number;
    name: string;
    type?: 'public' | 'private';
    facility_code?: string;
    city?: string;
    province?: string;
    address?: string | null;
    contact_email?: string | null;
    contact_number?: string | null;
    is_demo?: boolean;
};

export type BeneficiaryReadiness = {
    year: number;
    selected: boolean;
    fpe_completed: boolean;
    pcu_verified: boolean;
    yes_confirmed: boolean;
    ready?: boolean;
};

export type Beneficiary = {
    id: number;
    reference: string;
    full_name?: string;
    first_name?: string;
    middle_name?: string | null;
    last_name?: string;
    suffix?: string | null;
    masked_pin?: string;
    philhealth_pin_masked?: string;
    masked_philhealth_pin?: string;
    patient_type?: string;
    beneficiary_type?: string;
    sex?: string;
    birth_date?: string;
    barangay?: string;
    mobile?: string | null;
    contact_number?: string | null;
    address?: string | null;
    archived_at?: string | null;
    readiness?: BeneficiaryReadiness | null;
    yearly_status?: BeneficiaryReadiness | null;
    created_at?: string;
};

export type ServiceClassification =
    | 'consultation'
    | 'laboratory'
    | 'antibiotic'
    | 'ncd_medicine'
    | 'other_drug'
    | 'other';

export type Service = {
    id: number;
    code: string;
    name: string;
    classification?: ServiceClassification | string;
    unit_cost_centavos?: Money;
    default_cost_centavos?: Money;
    unit?: string;
    category?: {
        id?: number;
        name: string;
        classification: ServiceClassification | string;
    };
    is_active?: boolean;
};

export type EncounterLine = {
    id?: number;
    service_id?: number;
    service_name: string;
    service_classification?: string;
    classification?: string;
    quantity: number;
    unit_cost_centavos: Money;
    total_centavos?: Money;
    is_repeat_lab?: boolean;
};

export type Encounter = {
    id: number;
    reference: string;
    encounter_date: string;
    beneficiary?: Beneficiary;
    beneficiary_name?: string;
    status: 'draft' | 'posted' | 'void' | string;
    total_centavos: Money;
    lines?: EncounterLine[];
    creator?: { name: string };
    void_reason?: string | null;
    created_at?: string;
};

export type SapBatch = {
    id: number;
    reference: string;
    tranche: 1 | 2 | 'SAP1' | 'SAP2' | string | number;
    year: number;
    period?: string;
    month?: number;
    status: string;
    beneficiary_count?: number;
    eligible_beneficiary_count?: number;
    expected_centavos?: Money;
    expected_gross_centavos?: Money;
    submitted_centavos?: Money;
    submitted_gross_centavos?: Money;
    approved_centavos?: Money;
    approved_gross_centavos?: Money;
    approved_net_centavos?: Money;
    withholding_tax_centavos?: Money;
    paid_centavos?: Money;
    outstanding_centavos?: Money;
    performance_factor?: number | null;
    performance_factor_bps?: number | null;
    submitted_at?: string | null;
    approved_at?: string | null;
    created_at?: string;
    policy?: PolicyVersion;
    beneficiaries?: SapBatchSnapshot[];
    payments?: Payment[];
};

export type SapBatchSnapshot = {
    id: number;
    beneficiary_id?: number;
    beneficiary_reference_snapshot: string;
    beneficiary_name_snapshot: string;
    pin_masked_snapshot?: string;
    readiness_snapshot?: Record<string, boolean | string | null>;
    allocated_amount_centavos: Money;
};

export type PerformanceRule = {
    key: string;
    label: string;
    target: number;
    weight: number;
};

export type PolicyVersion = {
    id: number;
    effective_year: number;
    source_circular: string;
    source_url?: string | null;
    per_capita_rate_centavos: Money;
    sap1_percentage_bps: number;
    sap2_percentage_bps: number;
    withholding_tax_bps: number;
    copayment_cap_centavos: Money;
    performance_rules: PerformanceRule[];
    locked_at?: string | null;
    created_at?: string;
};

export type Payment = {
    id: number;
    reference: string;
    batch?: SapBatch;
    batch_reference?: string;
    amount_centavos: Money;
    paid_at: string;
    method?: string;
    external_reference?: string | null;
    notes?: string | null;
    voided_at?: string | null;
    void_reason?: string | null;
};

export type Copayment = {
    id: number;
    reference: string;
    beneficiary?: Beneficiary;
    beneficiary_name?: string;
    encounter_id?: number | null;
    amount_centavos: Money;
    collected_at?: string;
    paid_at?: string;
    year?: number;
    notes?: string | null;
    receipt_number?: string | null;
    voided_at?: string | null;
};

export type AuditEvent = {
    id: number;
    event?: string;
    action?: string;
    actor?: { name: string };
    user_name?: string;
    subject_type?: string;
    subject_label?: string;
    description?: string;
    created_at: string;
    ip_address?: string | null;
};
