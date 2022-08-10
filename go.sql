SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";

SET AUTOCOMMIT = 0;

START TRANSACTION;

SET time_zone = "+00:00";

CREATE TABLE
    `stickers` (
        `id` varchar(255) NOT NULL,
        `keyword` varchar(255) NOT NULL,
        `unique_id` varchar(255) NOT NULL
    ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

ALTER TABLE `stickers`
ADD PRIMARY KEY (`id`),
ADD UNIQUE KEY `id` (`id`),
ADD
    UNIQUE KEY `md5` (`unique_id`);

COMMIT;