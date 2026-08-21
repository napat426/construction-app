-- Migration to add slump_tolerance column to concrete_pours
ALTER TABLE public.concrete_pours 
ADD COLUMN slump_tolerance numeric DEFAULT 2.5;
