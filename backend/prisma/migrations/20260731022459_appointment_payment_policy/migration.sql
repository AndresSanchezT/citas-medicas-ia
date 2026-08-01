-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `monto` DOUBLE NULL,
    ADD COLUMN `pagado` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `reembolso` ENUM('NO_APLICA', 'REEMBOLSADO', 'PERDIDO') NOT NULL DEFAULT 'NO_APLICA',
    ADD COLUMN `reprogramacion_gratuita_usada` BOOLEAN NOT NULL DEFAULT false;
