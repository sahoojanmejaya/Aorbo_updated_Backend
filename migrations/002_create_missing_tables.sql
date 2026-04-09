CREATE TABLE IF NOT EXISTS approvals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trek_id VARCHAR(50) NOT NULL,
    agent_name VARCHAR(255),
    agent_id VARCHAR(50),
    time DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_trek_id (trek_id)
);

CREATE TABLE IF NOT EXISTS trek_source_cities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trek_id VARCHAR(50) NOT NULL,
    city_name VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_trek_id (trek_id)
);

CREATE TABLE IF NOT EXISTS captains (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    contact VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trek_id VARCHAR(50) NOT NULL,
    price_per_slot DECIMAL(10,2) DEFAULT 0,
    total_commission DECIMAL(10,2) DEFAULT 0,
    total_platform_fee DECIMAL(10,2) DEFAULT 0,
    total_platform_share DECIMAL(10,2) DEFAULT 0,
    revenue_bookings DECIMAL(10,2) DEFAULT 0,
    revenue_cancellations DECIMAL(10,2) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_trek_id (trek_id)
);
