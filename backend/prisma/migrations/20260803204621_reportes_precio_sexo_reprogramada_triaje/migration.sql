-- AlterTable
ALTER TABLE `appointments` MODIFY `estado` ENUM('PENDIENTE', 'CONFIRMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'NO_ASISTIO', 'REPROGRAMADA') NOT NULL DEFAULT 'PENDIENTE';

-- AlterTable
ALTER TABLE `patients` ADD COLUMN `sexo` ENUM('MASCULINO', 'FEMENINO') NULL;

-- AlterTable
ALTER TABLE `specialties` ADD COLUMN `precio_consulta` DOUBLE NULL;

-- AlterTable
ALTER TABLE `triage` ADD COLUMN `fin_triaje_en` DATETIME(3) NULL,
    ADD COLUMN `inicio_triaje_en` DATETIME(3) NULL;
