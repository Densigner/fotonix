-- demo tenant
insert into tenants (name, slug)
values ('Fotonix Demo', 'fotonix-demo')
on conflict (slug) do nothing;

-- verify an address identity
insert into email_identities (tenant_id, type, identity, is_verified)
select t.id, 'address', 'no-reply@fotonix.example', true
from tenants t where t.slug='fotonix-demo'
on conflict do nothing;

-- smtp creds (replace with real host/user/pass)
insert into smtp_credentials (tenant_id, provider, host, port, username, password_encrypted, from_name, from_address, use_tls, use_starttls, rate_limit_per_minute)
select t.id, 'smtp', 'localhost', 1025, 'smtpuser', 'smtppass', 'Fotonix', 'no-reply@fotonix.example', false, false, 0
from tenants t where t.slug='fotonix-demo'
on conflict do nothing;

-- basic template
insert into email_templates (tenant_id, name, version, subject, html, text, is_active)
select t.id, 'welcome', 1, 'Welcome to Fotonix',
       '<h1>Hi {{name}}</h1><p>Thanks for joining Fotonix.</p>',
       'Hi {{name}}\nThanks for joining Fotonix.',
       true
from tenants t where t.slug='fotonix-demo'
on conflict do nothing;
