-- Reversa manual de 0011 (drizzle no ejecuta reversas; este archivo no está en el journal). Borra el Área de Inglés:
-- material, textos de los grados y códigos de acceso. Los archivos subidos quedan en ALESYA_DATA_DIR/ingles y se borran a mano.
-- Ejecutar contra la base y luego borrar la fila de 0011 en `__drizzle_migrations` (y en `alesya_migrations`) si se quiere volver a aplicar.
DROP INDEX IF EXISTS `idx_english_resources_grade`;
DROP TABLE IF EXISTS `english_resources`;
DROP TABLE IF EXISTS `english_levels`;
DROP INDEX IF EXISTS `idx_english_codes_created`;
DROP INDEX IF EXISTS `idx_english_codes_code_unique`;
DROP TABLE IF EXISTS `english_access_codes`;
