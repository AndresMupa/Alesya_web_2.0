import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(), name: text("name").notNull(), organization: text("organization").notNull(), email: text("email"), phone: text("phone"), message: text("message").notNull(), source: text("source").notNull().default("website"), stage: text("stage").notNull().default("new"), owner: text("owner"), externalId: text("external_id"), city: text("city"), priority: text("priority").notNull().default("medium"), website: text("website"), notes: text("notes").notNull().default(""), lastContact: text("last_contact"), nextFollowUp: text("next_follow_up"), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_leads_stage_created").on(table.stage, table.createdAt), index("idx_leads_email").on(table.email), uniqueIndex("idx_leads_external_id").on(table.externalId), index("idx_leads_follow_up").on(table.nextFollowUp)]);

export const products = sqliteTable("products", {
  id: text("id").primaryKey(), slug: text("slug").notNull(), sku: text("sku").notNull(), name: text("name").notNull(), description: text("description").notNull(), category: text("category").notNull(), priceInCents: integer("price_in_cents").notNull(), stock: integer("stock").notNull().default(0), status: text("status").notNull().default("draft"), imageUrl: text("image_url"), position: integer("position").notNull().default(0), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("idx_products_slug_unique").on(table.slug), uniqueIndex("idx_products_sku_unique").on(table.sku), index("idx_products_status_category").on(table.status, table.category), index("idx_products_category_position").on(table.category, table.position)]);

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(), reference: text("reference").notNull(), customerName: text("customer_name").notNull(), customerEmail: text("customer_email").notNull(), customerPhone: text("customer_phone").notNull(), shippingCity: text("shipping_city").notNull(), shippingAddress: text("shipping_address").notNull(), subtotalInCents: integer("subtotal_in_cents").notNull(), shippingInCents: integer("shipping_in_cents").notNull().default(0), totalInCents: integer("total_in_cents").notNull(), currency: text("currency").notNull().default("COP"), status: text("status").notNull().default("payment_pending"), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("idx_orders_reference_unique").on(table.reference), index("idx_orders_status_created").on(table.status, table.createdAt), index("idx_orders_customer_email").on(table.customerEmail)]);

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull().references(() => orders.id), productSlug: text("product_slug").notNull(), productName: text("product_name").notNull(), quantity: integer("quantity").notNull().default(1), unitPriceInCents: integer("unit_price_in_cents").notNull(), lineTotalInCents: integer("line_total_in_cents").notNull(),
}, (table) => [index("idx_order_items_order_id").on(table.orderId)]);

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull().references(() => orders.id), provider: text("provider").notNull().default("wompi"), providerTransactionId: text("provider_transaction_id"), reference: text("reference").notNull(), method: text("method"), status: text("status").notNull().default("pending"), amountInCents: integer("amount_in_cents").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("idx_payments_reference_unique").on(table.reference), index("idx_payments_provider_transaction").on(table.providerTransactionId), index("idx_payments_order_id").on(table.orderId)]);

export const inventoryEvents = sqliteTable("inventory_events", {
  id: text("id").primaryKey(), productId: text("product_id").notNull(), quantityDelta: integer("quantity_delta").notNull(), reason: text("reason").notNull(), orderId: text("order_id"), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_inventory_product_created").on(table.productId, table.createdAt)]);

export const contentItems = sqliteTable("content_items", {
  id: text("id").primaryKey(), slug: text("slug").notNull(), title: text("title").notNull(), type: text("type").notNull(), status: text("status").notNull().default("draft"), excerpt: text("excerpt").notNull().default(""), body: text("body").notNull().default(""), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("idx_content_slug_unique").on(table.slug), index("idx_content_status_type").on(table.status, table.type)]);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: integer("reset_at", { mode: "number" }).notNull(),
}, (table) => [index("idx_rate_limits_reset_at").on(table.resetAt)]);
