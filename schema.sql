-- PostgreSQL Schema for Local Government Revenue Management Platform

-- 1. States Table
CREATE TABLE IF NOT EXISTS states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(10) NOT NULL UNIQUE,
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Local Governments Table (Tenants)
CREATE TABLE IF NOT EXISTS local_governments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_id UUID NOT NULL REFERENCES states(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) NOT NULL,
    jurisdiction TEXT,
    address TEXT,
    phone VARCHAR(30),
    email VARCHAR(150),
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT lg_state_name_unique UNIQUE (state_id, name),
    CONSTRAINT lg_state_code_unique UNIQUE (state_id, code)
);

-- 3. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lg_id UUID REFERENCES local_governments(id) ON DELETE SET NULL, -- Nullable for Super Admins
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(30),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'lg_admin', 'lg_account_officer')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Clients Table (Portfolios)
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lg_id UUID NOT NULL REFERENCES local_governments(id) ON DELETE RESTRICT,
    reference_number VARCHAR(100) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(30) NOT NULL,
    email_address VARCHAR(150),
    address TEXT NOT NULL,
    ward VARCHAR(150),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT lg_client_ref_unique UNIQUE (lg_id, reference_number)
);

-- 5. Demand Bills Table
CREATE TABLE IF NOT EXISTS demand_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number VARCHAR(100) NOT NULL,
    lg_id UUID NOT NULL REFERENCES local_governments(id) ON DELETE RESTRICT,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    levy_items JSONB NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    arrears DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    penalty DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    amount_in_words TEXT NOT NULL,
    year_of_billing INTEGER NOT NULL,
    due_date DATE NOT NULL,
    payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN ('unpaid', 'paid')) DEFAULT 'unpaid',
    payment_method VARCHAR(30) CHECK (payment_method IN ('flutterwave', 'bank_transfer')),
    flutterwave_transaction_id VARCHAR(100),
    manual_payment_bank VARCHAR(100),
    manual_payment_teller_ref VARCHAR(100),
    manual_payment_date DATE,
    manual_payment_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT lg_bill_ref_unique UNIQUE (lg_id, reference_number)
);

-- 6. Demand Bill Status Logs Table
CREATE TABLE IF NOT EXISTS demand_bill_status_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demand_bill_id UUID NOT NULL REFERENCES demand_bills(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('unpaid', 'paid', 'overdue')),
    changed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_by_label VARCHAR(150) NOT NULL,
    change_type VARCHAR(30) NOT NULL CHECK (change_type IN ('created', 'manual_payment', 'qr_payment', 'overdue_flagged')),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES demand_bills(id) ON DELETE RESTRICT,
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
    status VARCHAR(30) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    raw_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Receipts Table
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID UNIQUE NOT NULL REFERENCES demand_bills(id) ON DELETE RESTRICT,
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
