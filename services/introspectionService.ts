import { TableInfo, DbDialect } from "../types";

export async function introspectDatabase(config: { 
  host?: string; 
  database?: string; 
  username?: string; 
  dialect: DbDialect;
  shopifyUrl?: string;
}): Promise<TableInfo[]> {
  // Simulating a network delay for DB or API introspection
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Handle Shopify Virtual Schema
  if (config.dialect === 'shopify') {
    return [
      { 
        name: 'shopify_orders', 
        schema: 'id (int), customer_id (int), total_price (decimal), subtotal_price (decimal), total_tax (decimal), currency (string), financial_status (string), fulfillment_status (string), created_at (timestamp), cancelled_at (timestamp)', 
        selected: true 
      },
      { 
        name: 'shopify_products', 
        schema: 'id (int), title (string), body_html (text), vendor (string), product_type (string), created_at (timestamp), status (string), total_inventory (int)', 
        selected: true 
      },
      { 
        name: 'shopify_customers', 
        schema: 'id (int), first_name (string), last_name (string), email (string), orders_count (int), state (string), total_spent (decimal), last_order_id (int)', 
        selected: true 
      },
      { 
        name: 'shopify_line_items', 
        schema: 'id (int), order_id (int), product_id (int), variant_id (int), quantity (int), price (decimal), sku (string), name (string)', 
        selected: false 
      },
      { 
        name: 'shopify_inventory_levels', 
        schema: 'inventory_item_id (int), location_id (int), available (int), updated_at (timestamp)', 
        selected: false 
      }
    ];
  }

  // If the user connects to a "Production" sounding DB, give them more complex tables
  if (config.database?.toLowerCase().includes('prod') || config.database?.toLowerCase().includes('sales')) {
    return [
      { name: 'sales_transactions', schema: 'transaction_id (int), customer_id (int), product_id (int), amount (decimal), sale_date (timestamp), region_id (int)', selected: true },
      { name: 'customers', schema: 'customer_id (int), first_name (string), last_name (string), email (string), segment (string), signup_date (date)', selected: true },
      { name: 'products', schema: 'product_id (int), sku (string), category (string), base_price (decimal), inventory_count (int)', selected: true },
      { name: 'regions', schema: 'region_id (int), name (string), country_code (string), manager_id (int)', selected: false },
      { name: 'discounts', schema: 'discount_id (int), code (string), percentage (decimal), expires_at (date)', selected: false }
    ];
  }

  // Default mock schema for any other DB name
  return [
    { name: 'users', schema: 'id (int), username (string), email (string), created_at (timestamp), last_login (timestamp)', selected: true },
    { name: 'posts', schema: 'id (int), author_id (int), title (string), body (text), status (string), published_at (date)', selected: true },
    { name: 'comments', schema: 'id (int), post_id (int), user_id (int), content (text), score (int)', selected: false },
    { name: 'analytics_events', schema: 'event_id (uuid), user_id (int), event_type (string), timestamp (timestamp), metadata (json)', selected: false }
  ];
}