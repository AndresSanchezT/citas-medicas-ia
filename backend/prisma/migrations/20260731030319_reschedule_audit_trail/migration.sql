-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `cita_origen_id` INTEGER NULL,
    ADD COLUMN `motivo_reprogramacion` VARCHAR(255) NULL,
    ADD COLUMN `reprogramada_por_user_id` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `appointments_cita_origen_id_key` ON `appointments`(`cita_origen_id`);

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_cita_origen_id_fkey` FOREIGN KEY (`cita_origen_id`) REFERENCES `appointments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_reprogramada_por_user_id_fkey` FOREIGN KEY (`reprogramada_por_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
