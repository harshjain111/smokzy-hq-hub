-- Re-add unique constraint on sales_reports after column rename (hookah_category -> category_id)
CREATE UNIQUE INDEX IF NOT EXISTS sales_reports_venue_date_category_uniq
  ON public.sales_reports (venue_id, report_date, category_id);
