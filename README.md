🚑 HealthPal — Unified Digital Healthcare Platform for Palestine








HealthPal is a unified digital healthcare platform designed to support patients, doctors, NGOs, volunteers, and donors in Palestine.
It provides remote consultations, medical case sponsorships, medication coordination, and real-time communication.

📌 Full documentation and technical details are available in the project Wiki.

📚 Table of Contents

Project Overview

Tech Stack

How to Run the Project

Install Dependencies

Create .env

Start Server

Access API

Credits

🌍 Project Overview

HealthPal helps deliver accessible and reliable healthcare through:

Remote medical consultations

Donor-funded case sponsorship

Medication & equipment coordination

NGO medical mission support

Mental health support

Real-time chat and notifications

All optimized for low-resource environments, poor connectivity, and crisis situations.

🛠️ Tech Stack

Node.js + Express.js

MySQL (healthpal_db)

JWT Authentication

Socket.io Real-Time Messaging

Dotenv (Environment Config)

Nodemon (Dev Mode)

🚀 How to Run the Project
1️⃣ Install Dependencies

Open PowerShell:

PS C:\Users\hp\healthpal-backend> npm install

2️⃣ Create a .env File

Create .env in the project root with your exact values:

DB_NAME=healthpal_db
DB_USER=root
DB_PASSWORD=123456789
DB_HOST=localhost
DB_PORT=3306

PORT=3100

JWT_SECRET=mySuperSecretKey
JWT_ACCESS_SECRET=mySuperSecretKey
JWT_ACCESS_EXPIRES=1000h

3️⃣ Start the Server (Development Mode)
PS C:\Users\hp\healthpal-backend> npm run dev


Expected successful output:

> healthpal-backend@1.0.0 dev
> nodemon server.js

[nodemon] starting `node server.js`
[dotenv] injecting env from .env
MYSQL DB Connected
Server + WebSocket Running on port 3100
MYSQL Connected ✅

4️⃣ Access the API

Base URL:

http://localhost:3100


Use Postman, browser, or frontend to test endpoints.

🤝 Credits

Developed for supporting accessible, transparent, and reliable healthcare for Palestinian communities.
