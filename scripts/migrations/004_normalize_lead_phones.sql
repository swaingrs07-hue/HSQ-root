-- Migration: Normalize all lead phone numbers to canonical +91XXXXXXXXXX format
-- Run once to fix existing unnormalized phone data

-- Step 1: Normalize 10-digit phones (e.g., "9582555301" -> "+919582555301")
UPDATE leads 
SET phone = '+91' || regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL 
  AND phone != '' 
  AND phone !~ '^\+91[0-9]{10}$'
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10;

-- Step 2: Normalize phones with country code but wrong format
-- (e.g., "919582555301", "+91 95825 55301" -> "+919582555301")
UPDATE leads 
SET phone = '+91' || right(regexp_replace(phone, '[^0-9]', '', 'g'), 10)
WHERE phone IS NOT NULL 
  AND phone != '' 
  AND phone !~ '^\+91[0-9]{10}$'
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) > 10;

-- Step 3: Normalize phones with leading 0 (e.g., "09582555301" -> "+919582555301")
UPDATE leads 
SET phone = '+91' || right(regexp_replace(phone, '[^0-9]', '', 'g'), 10)
WHERE phone IS NOT NULL 
  AND phone != '' 
  AND phone !~ '^\+91[0-9]{10}$'
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) = 11
  AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE '0%';
