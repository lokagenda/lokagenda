-- ============================================
-- Project Leo - Schema Fase 1
-- Sistema de Locação de Brinquedos (Multi-empresa)
-- ============================================

-- Enable extensions
create extension if not exists "uuid-ossp";

-- ============================================
-- 1. EMPRESAS
-- ============================================
create table public.companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  document text, -- CNPJ ou CPF
  phone text,
  email text,
  address text,
  city text,
  state text,
  zip_code text,
  logo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 2. PERFIS DE USUARIO (vinculado ao auth.users)
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  full_name text not null,
  role text not null default 'operator' check (role in ('owner', 'admin', 'operator')),
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 3. PRODUTOS / BRINQUEDOS
-- ============================================
create table public.products (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  price numeric(10,2) not null default 0,
  stock integer not null default 1,
  status text not null default 'active' check (status in ('active', 'inactive', 'maintenance')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 4. CLIENTES
-- ============================================
create table public.customers (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  document text, -- CPF
  address text,
  city text,
  state text,
  zip_code text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 5. ORCAMENTOS
-- ============================================
create table public.quotes (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  -- dados do cliente inline (caso nao tenha cadastro)
  customer_name text not null,
  customer_phone text,
  customer_email text,
  event_date date not null,
  event_address text,
  event_city text,
  event_state text,
  event_zip_code text,
  delivery_time time,
  pickup_time time,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired', 'converted')),
  total numeric(10,2) not null default 0,
  discount numeric(10,2) default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 6. ITENS DO ORCAMENTO
-- ============================================
create table public.quote_items (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null,
  subtotal numeric(10,2) not null
);

-- ============================================
-- 7. LOCACOES (convertidas de orcamentos ou diretas)
-- ============================================
create table public.rentals (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  customer_document text,
  event_date date not null,
  event_address text,
  event_city text,
  event_state text,
  event_zip_code text,
  delivery_time time,
  pickup_time time,
  notes text,
  status text not null default 'confirmed' check (status in ('confirmed', 'delivered', 'returned', 'cancelled')),
  total numeric(10,2) not null default 0,
  discount numeric(10,2) default 0,
  contract_html text, -- contrato gerado
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 8. ITENS DA LOCACAO
-- ============================================
create table public.rental_items (
  id uuid primary key default uuid_generate_v4(),
  rental_id uuid not null references public.rentals(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null,
  subtotal numeric(10,2) not null
);

-- ============================================
-- 9. MODELO DE CONTRATO (por empresa)
-- ============================================
create table public.contract_templates (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null default 'Contrato Padrão',
  content text not null, -- HTML com variáveis tipo {{nome_cliente}}
  is_default boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- INDEXES
-- ============================================
create index idx_profiles_company on public.profiles(company_id);
create index idx_products_company on public.products(company_id);
create index idx_customers_company on public.customers(company_id);
create index idx_quotes_company on public.quotes(company_id);
create index idx_quotes_event_date on public.quotes(event_date);
create index idx_quotes_status on public.quotes(status);
create index idx_rentals_company on public.rentals(company_id);
create index idx_rentals_event_date on public.rentals(event_date);
create index idx_rentals_status on public.rentals(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.rentals enable row level security;
alter table public.rental_items enable row level security;
alter table public.contract_templates enable row level security;

-- Helper: get current user's company_id
create or replace function public.get_user_company_id()
returns uuid
language sql
stable
security definer
as $$
  select company_id from public.profiles where id = auth.uid()
$$;

-- Companies: users can only see their own company
create policy "Users can view own company"
  on public.companies for select
  using (id = public.get_user_company_id());

create policy "Owners can update own company"
  on public.companies for update
  using (id = public.get_user_company_id());

-- Profiles: users can see profiles of same company
create policy "Users can view company profiles"
  on public.profiles for select
  using (company_id = public.get_user_company_id());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Products: company-scoped
create policy "Users can view company products"
  on public.products for select
  using (company_id = public.get_user_company_id());

create policy "Users can insert company products"
  on public.products for insert
  with check (company_id = public.get_user_company_id());

create policy "Users can update company products"
  on public.products for update
  using (company_id = public.get_user_company_id());

create policy "Users can delete company products"
  on public.products for delete
  using (company_id = public.get_user_company_id());

-- Customers: company-scoped
create policy "Users can view company customers"
  on public.customers for select
  using (company_id = public.get_user_company_id());

create policy "Users can insert company customers"
  on public.customers for insert
  with check (company_id = public.get_user_company_id());

create policy "Users can update company customers"
  on public.customers for update
  using (company_id = public.get_user_company_id());

create policy "Users can delete company customers"
  on public.customers for delete
  using (company_id = public.get_user_company_id());

-- Quotes: company-scoped
create policy "Users can view company quotes"
  on public.quotes for select
  using (company_id = public.get_user_company_id());

create policy "Users can insert company quotes"
  on public.quotes for insert
  with check (company_id = public.get_user_company_id());

create policy "Users can update company quotes"
  on public.quotes for update
  using (company_id = public.get_user_company_id());

create policy "Users can delete company quotes"
  on public.quotes for delete
  using (company_id = public.get_user_company_id());

-- Quote Items: through quote's company
create policy "Users can view quote items"
  on public.quote_items for select
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id and q.company_id = public.get_user_company_id()
    )
  );

create policy "Users can insert quote items"
  on public.quote_items for insert
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id and q.company_id = public.get_user_company_id()
    )
  );

create policy "Users can update quote items"
  on public.quote_items for update
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id and q.company_id = public.get_user_company_id()
    )
  );

create policy "Users can delete quote items"
  on public.quote_items for delete
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id and q.company_id = public.get_user_company_id()
    )
  );

-- Rentals: company-scoped
create policy "Users can view company rentals"
  on public.rentals for select
  using (company_id = public.get_user_company_id());

create policy "Users can insert company rentals"
  on public.rentals for insert
  with check (company_id = public.get_user_company_id());

create policy "Users can update company rentals"
  on public.rentals for update
  using (company_id = public.get_user_company_id());

create policy "Users can delete company rentals"
  on public.rentals for delete
  using (company_id = public.get_user_company_id());

-- Rental Items: through rental's company
create policy "Users can view rental items"
  on public.rental_items for select
  using (
    exists (
      select 1 from public.rentals r
      where r.id = rental_id and r.company_id = public.get_user_company_id()
    )
  );

create policy "Users can insert rental items"
  on public.rental_items for insert
  with check (
    exists (
      select 1 from public.rentals r
      where r.id = rental_id and r.company_id = public.get_user_company_id()
    )
  );

create policy "Users can update rental items"
  on public.rental_items for update
  using (
    exists (
      select 1 from public.rentals r
      where r.id = rental_id and r.company_id = public.get_user_company_id()
    )
  );

create policy "Users can delete rental items"
  on public.rental_items for delete
  using (
    exists (
      select 1 from public.rentals r
      where r.id = rental_id and r.company_id = public.get_user_company_id()
    )
  );

-- Contract Templates: company-scoped
create policy "Users can view company templates"
  on public.contract_templates for select
  using (company_id = public.get_user_company_id());

create policy "Users can insert company templates"
  on public.contract_templates for insert
  with check (company_id = public.get_user_company_id());

create policy "Users can update company templates"
  on public.contract_templates for update
  using (company_id = public.get_user_company_id());

-- ============================================
-- STORAGE BUCKETS
-- ============================================
insert into storage.buckets (id, name, public) values ('logos', 'logos', true);
insert into storage.buckets (id, name, public) values ('products', 'products', true);

-- Storage policies
create policy "Anyone can view logos"
  on storage.objects for select
  using (bucket_id = 'logos');

create policy "Authenticated users can upload logos"
  on storage.objects for insert
  with check (bucket_id = 'logos' and auth.role() = 'authenticated');

create policy "Anyone can view product images"
  on storage.objects for select
  using (bucket_id = 'products');

create policy "Authenticated users can upload product images"
  on storage.objects for insert
  with check (bucket_id = 'products' and auth.role() = 'authenticated');

-- Backups bucket (private - only service role can access)
insert into storage.buckets (id, name, public) values ('backups', 'backups', false);

-- ============================================
-- TRIGGER: updated_at
-- ============================================
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.companies
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.products
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.customers
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.quotes
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.rentals
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.contract_templates
  for each row execute function public.handle_updated_at();

-- ============================================
-- TRIGGER: criar perfil ao registrar usuario
-- ============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'owner'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
