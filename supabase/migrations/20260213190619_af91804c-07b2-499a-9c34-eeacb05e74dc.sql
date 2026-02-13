
-- Grant table-level permissions to authenticated role
GRANT SELECT ON public.questions TO authenticated;
GRANT INSERT ON public.questions TO authenticated;
GRANT UPDATE ON public.questions TO authenticated;
