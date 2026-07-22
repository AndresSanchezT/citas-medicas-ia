-- AlterTable
ALTER TABLE `waitlist_entries` ADD COLUMN `specialty_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `waitlist_entries` ADD CONSTRAINT `waitlist_entries_specialty_id_fkey` FOREIGN KEY (`specialty_id`) REFERENCES `specialties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
