alter table public.products
  add column if not exists product_weight numeric check(product_weight is null or product_weight>0),
  add column if not exists weight_unit text check(weight_unit is null or weight_unit in ('g','kg','ml','l','piece')),
  add column if not exists price numeric(12,2) check(price is null or price>=0),
  add column if not exists currency text;
