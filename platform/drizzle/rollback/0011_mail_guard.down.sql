-- Reversa manual de 0011 (drizzle no ejecuta reversas; este archivo no está en el journal). Solo quita las columnas del guardián.
-- Ejecutar contra la base y luego borrar la fila de 0011 en `__drizzle_migrations` si se quiere volver a aplicar.
-- Antes, devolver los correos en cuarentena a "omitido" para que el panel anterior los muestre.
UPDATE `inbound_emails` SET `result` = 'skipped' WHERE `result` = 'quarantined';
ALTER TABLE `inbound_emails` DROP COLUMN `risk_signals`;
ALTER TABLE `inbound_emails` DROP COLUMN `risk_level`;
ALTER TABLE `inbound_emails` DROP COLUMN `risk_score`;
