-- anon key itu publik (ada di bundle browser). Batasi kolom product_durations
-- yang bisa dibaca anon/authenticated ke kolom etalase saja; provider_item_id
-- (ID varian provider upstream) hanya bisa dibaca server via service_role.
revoke select on public.product_durations from anon, authenticated;
grant select (id, product_id, label, days, price, stock_mode)
  on public.product_durations to anon, authenticated;
