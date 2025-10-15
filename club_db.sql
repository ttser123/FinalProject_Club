-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 15, 2025 at 08:14 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `club_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `bookings`
--

CREATE TABLE `bookings` (
  `book_id` int(11) NOT NULL,
  `book_name` varchar(255) NOT NULL,
  `place_id` int(11) NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `date` date NOT NULL,
  `time` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bookings`
--

INSERT INTO `bookings` (`book_id`, `book_name`, `place_id`, `student_id`, `date`, `time`) VALUES
(4, 'จอง', 1, '65160251', '2025-09-24', '08:30-11:00'),
(6, '....', 1, '65160251', '2025-09-25', '08:00-11:30'),
(7, 'ทำงาน', 2, '65160251', '2025-10-20', '09:30-10:30'),
(8, 'test02', 2, '65160251', '2025-10-30', '12:30-15:30');

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `name`) VALUES
(21, 'Cybersecurity'),
(22, 'Data/AI'),
(23, 'Game Dev'),
(31, 'การตลาด'),
(41, 'การเกษตร/ปลูกผัก'),
(30, 'การเงิน/ลงทุน'),
(1, 'กีฬา'),
(6, 'ขับร้อง/วง'),
(15, 'คณิตศาสตร์'),
(32, 'จิตอาสา'),
(5, 'ดนตรี'),
(12, 'ถ่ายภาพ'),
(38, 'ทำอาหาร'),
(29, 'ผู้ประกอบการ'),
(2, 'ฟิตเนส/วิ่ง'),
(9, 'ภาพยนตร์'),
(26, 'ภาษาจีน'),
(25, 'ภาษาญี่ปุ่น'),
(24, 'ภาษาอังกฤษ'),
(27, 'ภาษาเกาหลี'),
(17, 'มนุษยศาสตร์'),
(8, 'ละครเวที'),
(36, 'วรรณกรรม/อ่านหนังสือ'),
(28, 'วัฒนธรรม/แลกเปลี่ยน'),
(10, 'วาด/เพนต์'),
(14, 'วิทยาศาสตร์'),
(16, 'วิศวกรรม'),
(40, 'ศาสนา/ความเชื่อ'),
(4, 'ศิลปะการต่อสู้'),
(18, 'สังคมศาสตร์'),
(34, 'สาธารณสุข'),
(33, 'สิ่งแวดล้อม/รักษ์โลก'),
(13, 'สื่อ/นิเทศ'),
(20, 'หุ่นยนต์/IoT'),
(11, 'ออกแบบ/กราฟิก'),
(37, 'เกม/eSports'),
(39, 'เดินป่า/ท่องเที่ยว'),
(7, 'เต้น'),
(35, 'โต้วาที/พูดในที่สาธารณะ'),
(19, 'โปรแกรมมิ่ง'),
(3, 'โยคะ');

-- --------------------------------------------------------

--
-- Table structure for table `club_members`
--

CREATE TABLE `club_members` (
  `id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `role` enum('member','admin','leader') NOT NULL DEFAULT 'member'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `club_members`
--

INSERT INTO `club_members` (`id`, `post_id`, `user_id`, `status`, `created_at`, `role`) VALUES
(1, 1, 1, 'approved', '2025-09-24 11:00:01', 'admin'),
(2, 1, 2, 'approved', '2025-09-24 11:00:01', 'leader'),
(5, 1, 3, 'approved', '2025-09-24 11:05:42', 'member');

-- --------------------------------------------------------

--
-- Table structure for table `events`
--

CREATE TABLE `events` (
  `id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `booking_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `time_start` varchar(5) NOT NULL,
  `time_end` varchar(5) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `capacity` int(11) DEFAULT NULL,
  `is_open` tinyint(1) NOT NULL DEFAULT 1,
  `is_canceled` tinyint(1) NOT NULL DEFAULT 0,
  `is_ended` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `events`
--

INSERT INTO `events` (`id`, `post_id`, `title`, `description`, `booking_id`, `date`, `time_start`, `time_end`, `created_at`, `capacity`, `is_open`, `is_canceled`, `is_ended`) VALUES
(1, 1, 'ทำงาน', 'ทำงาน', 7, '2025-10-20', '09:30', '10:30', '2025-10-15 16:29:28', NULL, 0, 0, 0),
(2, 1, 'test2', 'test2', 8, '2025-10-30', '12:30', '15:30', '2025-10-15 17:00:03', 10, 0, 1, 1);

-- --------------------------------------------------------

--
-- Table structure for table `event_participants`
--

CREATE TABLE `event_participants` (
  `id` int(11) NOT NULL,
  `event_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `status` enum('joined','attended','absent') NOT NULL DEFAULT 'joined',
  `points` int(11) NOT NULL DEFAULT 0,
  `joined_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `event_participants`
--

INSERT INTO `event_participants` (`id`, `event_id`, `user_id`, `status`, `points`, `joined_at`) VALUES
(1, 1, 2, 'attended', 10, '2025-10-15 16:29:32'),
(3, 1, 3, 'attended', 10, '2025-10-15 16:34:24'),
(10, 2, 3, 'attended', 20, '2025-10-15 17:01:55'),
(12, 2, 2, 'joined', 0, '2025-10-15 17:02:49');

-- --------------------------------------------------------

--
-- Table structure for table `files`
--

CREATE TABLE `files` (
  `id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  `filename` varchar(255) NOT NULL,
  `originalname` varchar(255) NOT NULL,
  `display_name` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `size` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `news`
--

CREATE TABLE `news` (
  `id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `category` enum('ประชุม','กิจกรรม','แจ้งเตือน') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `news`
--

INSERT INTO `news` (`id`, `post_id`, `title`, `content`, `category`, `created_at`, `updated_at`) VALUES
(1, 1, 'ประกาศ 001', 'กหฟกฟ', 'ประชุม', '2025-10-15 17:08:24', '2025-10-15 17:08:24'),
(2, 1, 'ฟหกฟห', 'กฟหกฟหก', 'แจ้งเตือน', '2025-10-15 17:09:01', '2025-10-15 17:09:01'),
(3, 1, 'กฟหกฟหก', 'กฟหกฟหก', 'กิจกรรม', '2025-10-15 17:09:06', '2025-10-15 17:09:06'),
(4, 1, 'กหฟกฟห', 'กฟหกฟห', 'แจ้งเตือน', '2025-10-15 17:09:11', '2025-10-15 17:09:11');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `post_id`, `message`, `is_read`, `created_at`) VALUES
(1, 1, 1, 'user0001 user0001 สมัครเข้าชมรม ชมรมถ่ายภาพธรรมชาติ', 1, '2025-09-24 11:03:02'),
(2, 1, 1, 'user0001 user0001 สมัครเข้าชมรม ชมรมถ่ายภาพธรรมชาติ', 1, '2025-09-24 11:03:44'),
(3, 1, 1, 'user0001 user0001 สมัครเข้าชมรม ชมรมถ่ายภาพธรรมชาติ', 1, '2025-09-24 11:05:42'),
(4, 3, 1, 'การสมัครเข้าชมรม ชมรมถ่ายภาพธรรมชาติ ได้รับการอนุมัติแล้ว', 0, '2025-09-24 11:06:01');

-- --------------------------------------------------------

--
-- Table structure for table `places`
--

CREATE TABLE `places` (
  `place_id` int(11) NOT NULL,
  `place_name` varchar(255) NOT NULL,
  `status` enum('available','booked') DEFAULT 'available'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `places`
--

INSERT INTO `places` (`place_id`, `place_name`, `status`) VALUES
(1, 'DMI Lab', 'available'),
(2, '701 ตึกIT', 'available');

-- --------------------------------------------------------

--
-- Table structure for table `posts`
--

CREATE TABLE `posts` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `user_id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `cover_image` varchar(255) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `member_limit` int(11) NOT NULL DEFAULT 50,
  `line_group_url` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `posts`
--

INSERT INTO `posts` (`id`, `title`, `content`, `user_id`, `category_id`, `created_at`, `cover_image`, `updated_at`, `member_limit`, `line_group_url`) VALUES
(1, 'ชมรมถ่ายภาพธรรมชาติ', 'ถ่ายภาพธรรมชาติ', 1, 12, '2025-09-24 11:00:01', NULL, '2025-10-15 17:33:29', 19, 'https://discord.gg/HBAc7ez9');

-- --------------------------------------------------------

--
-- Table structure for table `role_history`
--

CREATE TABLE `role_history` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  `old_role` varchar(50) DEFAULT NULL,
  `new_role` varchar(50) NOT NULL,
  `changed_by` int(11) NOT NULL,
  `changed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `username` varchar(20) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `f_name` varchar(100) DEFAULT NULL,
  `l_name` varchar(100) DEFAULT NULL,
  `role` enum('member','admin','leader') NOT NULL DEFAULT 'member',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `student_id`, `username`, `email`, `password`, `phone`, `f_name`, `l_name`, `role`, `created_at`) VALUES
(1, '65160258', 'admintoey', '65160258@go.buu.ac.th', '$2b$10$7IvMOpcorkkxIF3m0sg32OPrmhCzSLA9vFl/bDIBihQcCPiigOAIe', '0957743139', 'admintoey', 'admintoey', 'admin', '2025-09-24 10:49:49'),
(2, '65160251', 'leaderpao', '65160251@go.buu.ac.th', '$2b$10$lEFYvw0mgzb2WJN4vR5FJubyskPW4w4OqqIeDEUgmdpFGh.KI3hkm', '0957743138', 'leaderpao', 'leaderpao', 'leader', '2025-09-24 10:50:41'),
(3, '65160001', 'user0001', '65160001@go.buu.ac.th', '$2b$10$TBxcwKY7fecBzZKREaP./e0i9itjvuNkm3dmX4t6f/sjD7PMy5IUu', '0957743137', 'user0001', 'user0001', 'member', '2025-09-24 10:51:14'),
(4, '65160002', 'user0002', '65160002@go.buu.ac.th', '$2b$10$PU7.XvtwU8UH4eDir3/j7el1.GhCes2x1OnXJPmDXjlk1Tv8frPCq', '0957743136', 'user0002', 'user0002', 'member', '2025-09-24 10:51:50'),
(5, '65160003', 'user0003', '65160003@go.buu.ac.th', '$2b$10$JOpmp1ctz3mQ6g/59SlTsOMLEuQgDPcLTkCrJy8awWkU3miTjmaxm', '0957743131', 'user0003', 'user0003', 'member', '2025-09-24 10:52:26'),
(6, '65160004', 'user0004', '65160004@go.buu.ac.th', '$2b$10$Wgng3QJi/rPh6I0gTAXkUuUzaQmiyZONE1Z9zdtrUXtRxxak2/w9G', '0957743132', 'user0004', 'user0004', 'member', '2025-09-24 10:52:53'),
(7, '65160005', 'user0005', '65160005@go.buu.ac.th', '$2b$10$YYBzVgIqfntjOFlXzKfbwuGAq5wovlMI3lcb71U9XvdblSz2Q8pX.', '0957743133', 'user0005', 'user0005', 'member', '2025-09-24 10:54:02');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `bookings`
--
ALTER TABLE `bookings`
  ADD PRIMARY KEY (`book_id`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `club_members`
--
ALTER TABLE `club_members`
  ADD PRIMARY KEY (`id`),
  ADD KEY `post_id` (`post_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `events`
--
ALTER TABLE `events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `post_id` (`post_id`),
  ADD KEY `booking_id` (`booking_id`);

--
-- Indexes for table `event_participants`
--
ALTER TABLE `event_participants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_event_user` (`event_id`,`user_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `files`
--
ALTER TABLE `files`
  ADD PRIMARY KEY (`id`),
  ADD KEY `post_id` (`post_id`);

--
-- Indexes for table `news`
--
ALTER TABLE `news`
  ADD PRIMARY KEY (`id`),
  ADD KEY `post_id` (`post_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `post_id` (`post_id`);

--
-- Indexes for table `places`
--
ALTER TABLE `places`
  ADD PRIMARY KEY (`place_id`);

--
-- Indexes for table `posts`
--
ALTER TABLE `posts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `category_id` (`category_id`);

--
-- Indexes for table `role_history`
--
ALTER TABLE `role_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `post_id` (`post_id`),
  ADD KEY `changed_by` (`changed_by`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `bookings`
--
ALTER TABLE `bookings`
  MODIFY `book_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=42;

--
-- AUTO_INCREMENT for table `club_members`
--
ALTER TABLE `club_members`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `events`
--
ALTER TABLE `events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `event_participants`
--
ALTER TABLE `event_participants`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `files`
--
ALTER TABLE `files`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `news`
--
ALTER TABLE `news`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `places`
--
ALTER TABLE `places`
  MODIFY `place_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `posts`
--
ALTER TABLE `posts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `role_history`
--
ALTER TABLE `role_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `club_members`
--
ALTER TABLE `club_members`
  ADD CONSTRAINT `club_members_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `club_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `events`
--
ALTER TABLE `events`
  ADD CONSTRAINT `events_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `events_ibfk_2` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`book_id`);

--
-- Constraints for table `event_participants`
--
ALTER TABLE `event_participants`
  ADD CONSTRAINT `event_participants_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `event_participants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `files`
--
ALTER TABLE `files`
  ADD CONSTRAINT `files_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `news`
--
ALTER TABLE `news`
  ADD CONSTRAINT `news_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `role_history`
--
ALTER TABLE `role_history`
  ADD CONSTRAINT `role_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `role_history_ibfk_2` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `role_history_ibfk_3` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
