-- DropForeignKey
ALTER TABLE `appointments` DROP FOREIGN KEY `appointments_slot_id_fkey`;

-- DropIndex
DROP INDEX `appointments_slot_id_key` ON `appointments`;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_slot_id_fkey` FOREIGN KEY (`slot_id`) REFERENCES `appointment_slots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
