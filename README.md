🚀 How to Run the Project

Follow these steps to run the HealthPal backend:

1️⃣ Install Dependencies

Open PowerShell inside your project folder:

PS C:\Users\hp\healthpal-backend> npm install

2️⃣ Add Your Environment Variables

Create a .env file at the root:

      PORT=3100
      DB_HOST=localhost
      DB_USER=root
      DB_PASSWORD=yourpassword
      DB_NAME=healthpal
      JWT_SECRET=yourSecretKey
      EMAIL_USER=yourEmail
      EMAIL_PASS=yourEmailPassword


(Replace values with your real credentials.)

3️⃣ Start the Server (Development Mode)

Run this command in PowerShell:

PS C:\Users\hp\healthpal-backend> npm run dev


You should see:

> healthpal-backend@1.0.0 dev
> nodemon server.js

[nodemon] starting `node server.js`
[dotenv@17.2.3] injecting env (9) from .env
MYSQL DB Connected
Server + WebSocket Running on port 3100
MYSQL Connected ✅


This means the server and WebSocket are running successfully.

4️⃣ Access the API

Your backend is now running at:

http://localhost:3100


Use Postman, your frontend, or browser to test endpoints.
