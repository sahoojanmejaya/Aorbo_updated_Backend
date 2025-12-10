-- Raw SQL ALTER TABLE syntax to add vendor_id foreign key to coupons table

-- Step 1: Add the vendor_id column
ALTER TABLE coupons 
ADD COLUMN vendor_id INTEGER NOT NULL;

-- Step 2: Add the foreign key constraint
ALTER TABLE coupons 
ADD CONSTRAINT coupons_vendor_id_fkey 
FOREIGN KEY (vendor_id) 
REFERENCES vendors(id) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- Step 3: Add an index for better query performance
CREATE INDEX coupons_vendor_id_idx ON coupons(vendor_id);

-- Step 4: Add a comment to the column (PostgreSQL specific)
COMMENT ON COLUMN coupons.vendor_id IS 'Reference to the vendor who created this coupon';

-- Optional: If you need to populate existing coupons with a default vendor
-- (Only run this if you have existing coupons and want to assign them to a specific vendor)
-- UPDATE coupons SET vendor_id = 1 WHERE vendor_id IS NULL;
-- (Replace 1 with the actual vendor ID you want to use as default)
