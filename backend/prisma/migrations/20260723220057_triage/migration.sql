-- CreateTable
CREATE TABLE `triage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `appointment_id` INTEGER NOT NULL,
    `presion_sistolica` INTEGER NULL,
    `presion_diastolica` INTEGER NULL,
    `frecuencia_cardiaca` INTEGER NULL,
    `temperatura` DOUBLE NULL,
    `frecuencia_respiratoria` INTEGER NULL,
    `saturacion_oxigeno` INTEGER NULL,
    `peso` DOUBLE NULL,
    `talla` DOUBLE NULL,
    `prioridad` ENUM('LEVE', 'MODERADO', 'URGENTE', 'CRITICO') NULL,
    `notas` TEXT NULL,
    `registrado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `triage_appointment_id_key`(`appointment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `triage` ADD CONSTRAINT `triage_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
