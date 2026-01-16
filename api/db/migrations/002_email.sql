-- db/migrations/002_email.sql
-- Multi-tenant email schema (Postgres 13+)

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  -- db/migrations/002_email.sql
  -- Tenants (orgs/workspaces that own email settings)
  create table if not exists tenants (
    id         bigserial primary key,
    name       text not null,
    slug       text not null unique,
    created_at timestamptz not null default now()
  );

  -- Identities (domains or specific from/return-path addresses)
  create table if not exists email_identities (
    id          bigserial primary key,
    tenant_id   bigint not null references tenants(id) on delete cascade,
    type        text   not null check (type in ('domain','address')),
    identity    text   not null,
    is_verified boolean not null default false,
    created_at  timestamptz not null default now(),
    unique (tenant_id, identity)
  );
  create index if not exists idx_email_identities_tenant on email_identities (tenant_id);

  -- SMTP / Provider credentials per tenant
  create table if not exists smtp_credentials (
    id                     bigserial primary key,
    tenant_id              bigint not null references tenants(id) on delete cascade,
    provider               text   not null check (provider in ('smtp','ses','mailgun','sendgrid')),
    host                   text,
    port                   integer,
    username               text,
    password_encrypted     text,
    from_name              text,
    from_address           text   not null,
    use_tls                boolean not null default true,
    use_starttls           boolean not null default true,
    rate_limit_per_minute  integer not null default 0,
    created_at             timestamptz not null default now(),
    unique (tenant_id, from_address)
  );
  create index if not exists idx_smtp_credentials_tenant on smtp_credentials (tenant_id);

  -- Templates (versioned)
  create table if not exists email_templates (
    id         bigserial primary key,
    tenant_id  bigint not null references tenants(id) on delete cascade,
    name       text   not null,
    version    integer not null default 1,
    subject    text not null,
    html       text,
    text       text,
    is_active  boolean not null default true,
    created_at timestamptz not null default now(),
    unique (tenant_id, name, version)
  );
  create index if not exists idx_email_templates_tenant on email_templates (tenant_id);
  -- ensure only one active version per (tenant_id, name)
  create unique index if not exists uq_email_templates_active_one
    on email_templates (tenant_id, name)
    where is_active = true;

  -- Messages (outbound instances)
  create table if not exists email_messages (
    id                   bigserial primary key,
    tenant_id            bigint not null references tenants(id) on delete cascade,
    template_id          bigint references email_templates(id),
    from_address         text   not null,
    to_address           text   not null,
    subject              text   not null,
    html                 text,
    text                 text,
    status               text   not null check (status in ('queued','sending','sent','failed','bounced','complained','suppressed')),
    provider_message_id  text,
    error                text,
    meta                 jsonb  not null default '{}'::jsonb,
    created_at           timestamptz not null default now(),
    queued_at            timestamptz,
    sent_at              timestamptz,
    opened_at            timestamptz,
    clicked_at           timestamptz
  );
  create index if not exists idx_email_messages_tenant_created on email_messages (tenant_id, created_at desc);
  create index if not exists idx_email_messages_tenant_status on email_messages (tenant_id, status);
  create index if not exists idx_email_messages_provider_id on email_messages (provider_message_id);

  -- Events (provider webhooks / internal transitions)
  create table if not exists email_events (
    id          bigserial primary key,
    message_id  bigint not null references email_messages(id) on delete cascade,
    tenant_id   bigint not null references tenants(id) on delete cascade,
    event_type  text   not null check (event_type in ('queued','sending','sent','open','click','bounce','complaint','unsubscribe','failure')),
    payload     jsonb  not null,
    occurred_at timestamptz not null default now(),
    created_at  timestamptz not null default now()
  );
  create index if not exists idx_email_events_message on email_events (message_id, occurred_at);
  create index if not exists idx_email_events_tenant on email_events (tenant_id, occurred_at desc);

  -- Suppressions (don’t send to these)
  create table if not exists email_suppressions (
    id         bigserial primary key,
    tenant_id  bigint not null references tenants(id) on delete cascade,
    address    text   not null,
    reason     text   not null check (reason in ('bounce','complaint','manual','unsubscribe')),
    detail     text,
    created_at timestamptz not null default now(),
    unique (tenant_id, address)
  );
  create index if not exists idx_email_suppressions_tenant on email_suppressions (tenant_id);

  -- Helpful views / constraints

  -- Guard: if a message is suppressed, it should have no sent_at
  create or replace function check_suppressed_no_sent()
  returns trigger language plpgsql as $$
  begin
    if new.status = 'suppressed' and new.sent_at is not null then
      raise exception 'suppressed messages cannot have sent_at';
    end if;
    return new;
  end$$;

  drop trigger if exists trg_email_messages_suppressed_guard on email_messages;
  create trigger trg_email_messages_suppressed_guard
  before insert or update on email_messages
  for each row execute function check_suppressed_no_sent();

  -- Convenience: fast lookup of active template by name for a tenant
  create or replace view v_active_templates as
  select id, tenant_id, name, subject, html, text, created_at
  from email_templates
  where is_active = true;
