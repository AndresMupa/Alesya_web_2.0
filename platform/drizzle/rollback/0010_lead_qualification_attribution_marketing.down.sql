-- Reversa manual de 0010 (drizzle no ejecuta reversas; este archivo no está en el journal). Solo quita columnas e índice añadidos.
-- Ejecutar contra la base y luego borrar la fila de 0010 en `__drizzle_migrations` si se quiere volver a aplicar.
DROP INDEX IF EXISTS `idx_leads_unsubscribe_token`;
ALTER TABLE `leads` DROP COLUMN `landing_page`;
ALTER TABLE `leads` DROP COLUMN `referrer`;
ALTER TABLE `leads` DROP COLUMN `utm_term`;
ALTER TABLE `leads` DROP COLUMN `utm_content`;
ALTER TABLE `leads` DROP COLUMN `utm_campaign`;
ALTER TABLE `leads` DROP COLUMN `utm_medium`;
ALTER TABLE `leads` DROP COLUMN `utm_source`;
ALTER TABLE `leads` DROP COLUMN `unsubscribe_token`;
ALTER TABLE `leads` DROP COLUMN `marketing_opt_out_at`;
ALTER TABLE `leads` DROP COLUMN `marketing_channels`;
ALTER TABLE `leads` DROP COLUMN `marketing_consent_version`;
ALTER TABLE `leads` DROP COLUMN `marketing_consent_at`;
ALTER TABLE `leads` DROP COLUMN `consent_version`;
