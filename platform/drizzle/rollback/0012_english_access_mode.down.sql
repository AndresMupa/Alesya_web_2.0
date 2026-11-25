-- Revierte 0012: quita el modo de acceso por grado (vuelve a exigir código siempre).
ALTER TABLE `english_levels` DROP COLUMN `access_mode`;
